const { Op } = require("sequelize");
const {
  sequelize,
  Conversation,
  ConversationMember,
  Message,
  MessageAttachment,
  User,
  Role,
  Notification
} = require("../models");
const pushService = require("../services/push.service");
const env = require("../config/env");

function normalizePair(a, b) {
  return Number(a) < Number(b) ? [Number(a), Number(b)] : [Number(b), Number(a)];
}

function uniqueIds(ids = []) {
  return [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function canModerateMessages(req) {
  const perms = req.user?.Role?.permissions?.map((p) => p.permission_key) || [];
  const isAdmin = req.user?.Role?.role_name === "Super Admin";
  return isAdmin || perms.includes("messages.moderate") || perms.includes("messages.delete");
}

const memberUserInclude = {
  model: User,
  as: "user",
  attributes: ["id", "full_name", "email", "profile_pic", "role_id"],
  include: [{ model: Role, attributes: ["id", "role_name"] }]
};

const senderInclude = {
  model: User,
  as: "Sender",
  attributes: ["id", "full_name", "profile_pic"]
};

const attachmentInclude = {
  model: MessageAttachment,
  as: "attachments",
  required: false
};

function buildReplyInclude() {
  return {
    model: Message,
    as: "ReplyTo",
    required: false,
    attributes: [
      "id",
      "body",
      "sender_id",
      "deleted_at",
      "message_type",
      "attachment_url",
      "is_edited"
    ],
    include: [
      { model: User, as: "Sender", attributes: ["id", "full_name", "profile_pic"] },
      {
        model: MessageAttachment,
        as: "attachments",
        required: false
      }
    ]
  };
}

async function getActiveMemberIds(conversationId) {
  const rows = await ConversationMember.findAll({
    where: { conversation_id: conversationId, left_at: null },
    attributes: ["user_id"]
  });
  return rows.map((r) => r.user_id);
}

async function findAccessibleConversation(conversationId, userId) {
  const conv = await Conversation.findByPk(conversationId);
  if (!conv) return null;

  if (conv.type === "group") {
    const membership = await ConversationMember.findOne({
      where: {
        conversation_id: conversationId,
        user_id: userId,
        left_at: null
      }
    });
    if (!membership) return null;
    return { conversation: conv, membership };
  }

  if (conv.user1_id !== userId && conv.user2_id !== userId) return null;
  return { conversation: conv, membership: null };
}

async function isGroupAdmin(conversationId, userId) {
  const membership = await ConversationMember.findOne({
    where: {
      conversation_id: conversationId,
      user_id: userId,
      left_at: null,
      role: "admin"
    }
  });
  return Boolean(membership);
}

async function serializeMembers(conversationId) {
  const members = await ConversationMember.findAll({
    where: { conversation_id: conversationId, left_at: null },
    include: [memberUserInclude],
    order: [["joined_at", "ASC"]]
  });

  return members.map((m) => {
    const json = m.toJSON();
    return {
      id: json.id,
      user_id: json.user_id,
      role: json.role,
      joined_at: json.joined_at,
      user: json.user
        ? {
            id: json.user.id,
            full_name: json.user.full_name,
            email: json.user.email,
            profile_pic: json.user.profile_pic,
            role_name: json.user.Role?.role_name || null
          }
        : null
    };
  });
}

function serializeMessage(message, userId) {
  const j = message.toJSON ? message.toJSON() : { ...message };
  const deleted = Boolean(j.deleted_at);
  const replyTo = j.ReplyTo
    ? {
        id: j.ReplyTo.id,
        sender_id: j.ReplyTo.sender_id,
        Sender: j.ReplyTo.Sender,
        deleted_at: j.ReplyTo.deleted_at,
        is_edited: j.ReplyTo.is_edited,
        message_type: j.ReplyTo.message_type,
        attachment_url: j.ReplyTo.deleted_at ? null : j.ReplyTo.attachment_url,
        attachments: j.ReplyTo.deleted_at ? [] : j.ReplyTo.attachments || [],
        body: j.ReplyTo.deleted_at ? "This message was deleted" : j.ReplyTo.body
      }
    : null;

  return {
    ...j,
    body: deleted ? "This message was deleted" : j.body,
    attachment_url: deleted ? null : j.attachment_url,
    attachments: deleted ? [] : j.attachments || [],
    is_deleted: deleted,
    is_mine: j.sender_id === userId,
    ReplyTo: replyTo,
    reply_to: replyTo
  };
}

async function loadFullMessage(messageId, userId) {
  const full = await Message.findByPk(messageId, {
    include: [senderInclude, { ...attachmentInclude }, buildReplyInclude()]
  });
  if (!full) return null;
  return serializeMessage(full, userId);
}

async function getUnreadCount(conv, userId, membership) {
  if (conv.type === "group") {
    const since = membership?.last_read_at || new Date(0);
    return Message.count({
      where: {
        conversation_id: conv.id,
        sender_id: { [Op.ne]: userId },
        deleted_at: null,
        created_at: { [Op.gt]: since }
      }
    });
  }

  return Message.count({
    where: {
      conversation_id: conv.id,
      receiver_id: userId,
      is_read: false,
      deleted_at: null
    }
  });
}

function previewBody(message) {
  if (!message) return null;
  if (message.deleted_at) return "This message was deleted";
  if (message.body) return message.body;
  if (message.message_type === "image") return "Sent an image";
  if (message.message_type === "document") return "Sent a document";
  if (message.message_type === "mixed" || message.attachment_url) return "Sent an attachment";
  return "";
}

async function serializeConversation(conv, userId) {
  const lastMsg = await Message.findOne({
    where: { conversation_id: conv.id },
    order: [["created_at", "DESC"]],
    include: [senderInclude, attachmentInclude]
  });

  const base = conv.toJSON ? conv.toJSON() : { ...conv };
  const type = base.type || "direct";
  const lastSerialized = lastMsg
    ? {
        ...serializeMessage(lastMsg, userId),
        body: previewBody(lastMsg)
      }
    : null;

  if (type === "group") {
    const membership = await ConversationMember.findOne({
      where: { conversation_id: conv.id, user_id: userId, left_at: null }
    });
    const members = await serializeMembers(conv.id);
    const unreadCount = await getUnreadCount(conv, userId, membership);

    return {
      ...base,
      type: "group",
      other_user: null,
      members,
      member_count: members.length,
      my_role: membership?.role || "member",
      last_message: lastSerialized,
      unread_count: unreadCount
    };
  }

  let user1 = conv.User1;
  let user2 = conv.User2;
  if (!user1 || !user2) {
    const withUsers = await Conversation.findByPk(conv.id, {
      include: [
        { model: User, as: "User1", attributes: ["id", "full_name", "email", "profile_pic"] },
        { model: User, as: "User2", attributes: ["id", "full_name", "email", "profile_pic"] }
      ]
    });
    user1 = withUsers?.User1;
    user2 = withUsers?.User2;
  }

  const otherUser = base.user1_id === userId ? user2 : user1;
  const unreadCount = await getUnreadCount(conv, userId, null);

  return {
    ...base,
    type: "direct",
    other_user: otherUser,
    members: [],
    member_count: 2,
    my_role: null,
    last_message: lastSerialized,
    unread_count: unreadCount
  };
}

async function notifyUsers({
  io,
  userIds,
  senderId,
  senderName,
  body,
  conversationId,
  isGroup,
  groupName,
  attachmentHint
}) {
  const recipients = userIds.filter((id) => id !== senderId);
  const previewText = attachmentHint || String(body || "").substring(0, 80);
  const title = isGroup ? `${groupName || "Group"}` : senderName;
  const notifBody = isGroup ? `${senderName}: ${previewText}` : previewText;
  const link = `/messages?conversation=${conversationId}`;

  await Promise.all(
    recipients.map(async (userId) => {
      await Notification.create({
        user_id: userId,
        title: isGroup ? `New message in ${groupName || "group"}` : "New Message",
        body: notifBody,
        type: "message",
        link,
        is_read: false
      });

      if (io) {
        io.to(`user:${userId}`).emit("notification:new", {
          title: isGroup ? `New message in ${groupName || "group"}` : "New Message",
          body: notifBody,
          type: "message",
          link,
          conversationId
        });
        io.to(`user:${userId}`).emit("toast:show", {
          message: isGroup
            ? `New message in ${groupName || "group"} from ${senderName}`
            : `New message from ${senderName}`,
          type: "info"
        });
      }
    })
  );

  await pushService.sendPushToUsers(recipients, {
    title,
    body: notifBody,
    url: link,
    conversationId,
    isGroup,
    tag: `conversation-${conversationId}`
  });
}

function detectMessageType(body, attachments = []) {
  const hasBody = Boolean(body && String(body).trim());
  const hasImages = attachments.some((a) => String(a.mime_type || "").startsWith("image/"));
  const hasDocs = attachments.some((a) => !String(a.mime_type || "").startsWith("image/"));
  if (hasBody && attachments.length) return "mixed";
  if (hasImages && !hasDocs && !hasBody) return "image";
  if (hasDocs && !hasImages && !hasBody) return "document";
  if (attachments.length && !hasBody) return hasImages ? "image" : "document";
  return "text";
}

async function createAttachments(messageId, files = []) {
  if (!files?.length) return [];
  const rows = await MessageAttachment.bulkCreate(
    files.map((file) => ({
      message_id: messageId,
      original_file_name: file.originalname,
      stored_file_name: file.filename,
      mime_type: file.mimetype,
      file_size: file.size,
      storage_path: `/uploads/${file.filename}`,
      created_at: new Date()
    }))
  );
  return rows;
}

async function emitToRecipients(io, recipientIds, senderId, event, payload) {
  if (!io) return;
  recipientIds
    .filter((id) => id !== senderId)
    .forEach((userId) => {
      io.to(`user:${userId}`).emit(event, payload);
    });
}

exports.listConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const memberships = await ConversationMember.findAll({
      where: { user_id: userId, left_at: null },
      attributes: ["conversation_id"]
    });
    const groupIds = memberships.map((m) => m.conversation_id);

    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { [Op.or]: [{ user1_id: userId }, { user2_id: userId }] },
          ...(groupIds.length ? [{ type: "group", id: { [Op.in]: groupIds } }] : [])
        ]
      },
      include: [
        { model: User, as: "User1", attributes: ["id", "full_name", "email", "profile_pic"] },
        { model: User, as: "User2", attributes: ["id", "full_name", "email", "profile_pic"] },
        { model: User, as: "Creator", attributes: ["id", "full_name", "email", "profile_pic"] }
      ],
      order: [["last_message_at", "DESC"]]
    });

    const result = await Promise.all(conversations.map((conv) => serializeConversation(conv, userId)));
    return res.json({ success: true, conversations: result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("getConversations:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.listMessages = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    const access = await findAccessibleConversation(conversationId, userId);
    if (!access) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { conversation, membership } = access;

    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      include: [senderInclude, { ...attachmentInclude }, buildReplyInclude()],
      order: [["created_at", "ASC"]]
    });

    if (conversation.type === "group") {
      if (membership) await membership.update({ last_read_at: new Date() });
    } else {
      await Message.update(
        { is_read: true, read_at: new Date() },
        {
          where: {
            conversation_id: conversationId,
            receiver_id: userId,
            is_read: false,
            deleted_at: null
          }
        }
      );
    }

    return res.json({
      success: true,
      messages: messages.map((m) => serializeMessage(m, userId))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

async function resolveRecipients(conversation, senderId) {
  if (conversation.type === "group") {
    return getActiveMemberIds(conversation.id);
  }
  const receiverId =
    conversation.user1_id === senderId ? conversation.user2_id : conversation.user1_id;
  return [receiverId];
}

exports.send = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      to_user_id,
      conversation_id,
      body,
      reply_to_message_id,
      attachment_url
    } = req.body || {};
    const files = req.files || [];

    const trimmed = body != null ? String(body).trim() : "";
    if (!trimmed && !files.length && !attachment_url) {
      return res.status(400).json({ error: "Message body or attachment required" });
    }

    let conversation;
    let receiverId = null;

    if (conversation_id) {
      const access = await findAccessibleConversation(conversation_id, senderId);
      if (!access) return res.status(404).json({ error: "Conversation not found" });
      conversation = access.conversation;
      if (conversation.type !== "group") {
        receiverId =
          conversation.user1_id === senderId ? conversation.user2_id : conversation.user1_id;
      }
    } else if (to_user_id) {
      const [u1, u2] = normalizePair(senderId, to_user_id);
      const [conv] = await Conversation.findOrCreate({
        where: { user1_id: u1, user2_id: u2 },
        defaults: {
          type: "direct",
          user1_id: u1,
          user2_id: u2,
          created_by: senderId,
          last_message_at: new Date(),
          created_at: new Date()
        }
      });
      conversation = conv;
      receiverId = Number(to_user_id);
    } else {
      return res.status(400).json({ error: "to_user_id or conversation_id required" });
    }

    let replyToId = null;
    if (reply_to_message_id) {
      const replyTarget = await Message.findByPk(reply_to_message_id);
      if (!replyTarget || replyTarget.conversation_id !== conversation.id) {
        return res.status(400).json({ error: "Invalid reply target" });
      }
      replyToId = replyTarget.id;
    }

    const messageType = detectMessageType(trimmed, files);
    const primaryAttachment =
      files[0] ? `/uploads/${files[0].filename}` : attachment_url || null;

    const message = await Message.create({
      conversation_id: conversation.id,
      sender_id: senderId,
      receiver_id: conversation.type === "group" ? null : receiverId,
      body: trimmed || null,
      attachment_url: primaryAttachment,
      message_type: messageType,
      reply_to_message_id: replyToId,
      is_read: false
    });

    await createAttachments(message.id, files);
    await conversation.update({ last_message_at: new Date() });

    const payload = await loadFullMessage(message.id, senderId);
    const recipientIds = await resolveRecipients(conversation, senderId);
    const io = req.app.get("io");
    const senderName = req.user.full_name || req.user.email || "Someone";

    await emitToRecipients(io, recipientIds, senderId, "message:receive", {
      ...payload,
      is_mine: false,
      conversation_id: conversation.id,
      conversation_type: conversation.type || "direct",
      conversation_name: conversation.name || null
    });

    let attachmentHint = null;
    if (!trimmed) {
      if (messageType === "image") attachmentHint = "Sent an image";
      else if (messageType === "document") attachmentHint = "Sent a document";
      else if (files.length) attachmentHint = "Sent an attachment";
    }

    await notifyUsers({
      io,
      userIds: recipientIds,
      senderId,
      senderName,
      body: trimmed,
      conversationId: conversation.id,
      isGroup: conversation.type === "group",
      groupName: conversation.name,
      attachmentHint
    });

    return res.status(201).json({
      success: true,
      message: { ...payload, is_mine: true, conversation_id: conversation.id }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("sendMessage error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const message = await Message.findByPk(req.params.id);
    if (!message || message.deleted_at) return res.status(404).json({ error: "Message not found" });
    if (message.sender_id !== userId) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    const access = await findAccessibleConversation(message.conversation_id, userId);
    if (!access) return res.status(403).json({ error: "Access denied" });

    const body = req.body?.body != null ? String(req.body.body).trim() : "";
    if (!body && !message.attachment_url) {
      return res.status(400).json({ error: "Message body required" });
    }

    await message.update({
      body: body || message.body,
      is_edited: true,
      edited_at: new Date()
    });

    const payload = await loadFullMessage(message.id, userId);
    const recipientIds = await resolveRecipients(access.conversation, userId);
    const io = req.app.get("io");
    await emitToRecipients(io, [...recipientIds, userId], null, "message:updated", {
      ...payload,
      conversation_id: message.conversation_id
    });
    // Also emit to all including self rooms for multi-tab
    if (io) {
      [...new Set([...recipientIds, userId])].forEach((id) => {
        io.to(`user:${id}`).emit("message:updated", {
          ...payload,
          conversation_id: message.conversation_id
        });
      });
    }

    return res.json({ success: true, message: payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: "Message not found" });
    if (message.deleted_at) return res.json({ success: true, message: await loadFullMessage(message.id, userId) });

    const access = await findAccessibleConversation(message.conversation_id, userId);
    if (!access) return res.status(403).json({ error: "Access denied" });

    const isOwner = message.sender_id === userId;
    if (!isOwner && !canModerateMessages(req)) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    await message.update({
      deleted_at: new Date(),
      body: null,
      attachment_url: null
    });

    const payload = await loadFullMessage(message.id, userId);
    const recipientIds = await resolveRecipients(access.conversation, userId);
    const io = req.app.get("io");
    if (io) {
      [...new Set([...recipientIds, userId])].forEach((id) => {
        io.to(`user:${id}`).emit("message:deleted", {
          ...payload,
          conversation_id: message.conversation_id
        });
      });
    }

    return res.json({ success: true, message: payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.forwardMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const source = await Message.findByPk(req.params.id, {
      include: [attachmentInclude, senderInclude]
    });
    if (!source || source.deleted_at) {
      return res.status(404).json({ error: "Message not found" });
    }

    const sourceAccess = await findAccessibleConversation(source.conversation_id, senderId);
    if (!sourceAccess) return res.status(403).json({ error: "Access denied" });

    const destinationIds = uniqueIds(req.body?.conversation_ids || req.body?.destination_ids);
    if (!destinationIds.length) {
      return res.status(400).json({ error: "Select at least one destination conversation" });
    }

    const comment = req.body?.comment != null ? String(req.body.comment).trim() : "";
    const created = [];
    const io = req.app.get("io");
    const senderName = req.user.full_name || req.user.email || "Someone";

    for (const destId of destinationIds) {
      const access = await findAccessibleConversation(destId, senderId);
      if (!access) continue;

      const conversation = access.conversation;
      const recipientIds = await resolveRecipients(conversation, senderId);
      const receiverId =
        conversation.type === "group"
          ? null
          : conversation.user1_id === senderId
            ? conversation.user2_id
            : conversation.user1_id;

      const forwardBodyParts = [];
      if (comment) forwardBodyParts.push(comment);
      if (source.body) forwardBodyParts.push(source.body);
      const forwardBody = forwardBodyParts.join("\n\n") || null;

      const message = await Message.create({
        conversation_id: conversation.id,
        sender_id: senderId,
        receiver_id: receiverId,
        body: forwardBody,
        attachment_url: source.attachment_url,
        message_type: source.message_type || "text",
        forwarded_from_message_id: source.id,
        is_forwarded: true,
        is_read: false
      });

      if (source.attachments?.length) {
        await MessageAttachment.bulkCreate(
          source.attachments.map((a) => ({
            message_id: message.id,
            original_file_name: a.original_file_name,
            stored_file_name: a.stored_file_name,
            mime_type: a.mime_type,
            file_size: a.file_size,
            storage_path: a.storage_path,
            created_at: new Date()
          }))
        );
      }

      await conversation.update({ last_message_at: new Date() });
      const payload = await loadFullMessage(message.id, senderId);
      created.push(payload);

      await emitToRecipients(io, recipientIds, senderId, "message:receive", {
        ...payload,
        is_mine: false,
        conversation_id: conversation.id,
        conversation_type: conversation.type || "direct",
        conversation_name: conversation.name || null
      });

      await notifyUsers({
        io,
        userIds: recipientIds,
        senderId,
        senderName,
        body: forwardBody || "Forwarded a message",
        conversationId: conversation.id,
        isGroup: conversation.type === "group",
        groupName: conversation.name,
        attachmentHint: !forwardBody ? "Forwarded an attachment" : null
      });
    }

    if (!created.length) {
      return res.status(403).json({ error: "No accessible destination conversations" });
    }

    return res.status(201).json({ success: true, messages: created });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("forwardMessage error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.createGroup = async (req, res) => {
  const tx = await sequelize.transaction();
  try {
    const creatorId = req.user.id;
    const { name, description, member_ids: memberIdsRaw } = req.body || {};

    if (!name || !String(name).trim()) {
      await tx.rollback();
      return res.status(400).json({ error: "Group name is required" });
    }

    const memberIds = uniqueIds(memberIdsRaw).filter((id) => id !== creatorId);
    if (memberIds.length < 1) {
      await tx.rollback();
      return res.status(400).json({ error: "Select at least one other participant" });
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: memberIds }, status: "active" },
      attributes: ["id"],
      transaction: tx
    });
    if (users.length !== memberIds.length) {
      await tx.rollback();
      return res.status(400).json({ error: "One or more selected users are invalid" });
    }

    const conversation = await Conversation.create(
      {
        type: "group",
        name: String(name).trim().slice(0, 150),
        description: description ? String(description).trim().slice(0, 500) : null,
        created_by: creatorId,
        user1_id: null,
        user2_id: null,
        last_message_at: new Date(),
        created_at: new Date()
      },
      { transaction: tx }
    );

    const allMemberIds = [creatorId, ...memberIds];
    await ConversationMember.bulkCreate(
      allMemberIds.map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
        role: userId === creatorId ? "admin" : "member",
        joined_at: new Date(),
        left_at: null,
        last_read_at: userId === creatorId ? new Date() : null
      })),
      { transaction: tx }
    );

    await tx.commit();

    const serialized = await serializeConversation(conversation, creatorId);
    const io = req.app.get("io");
    if (io) {
      memberIds.forEach((userId) => {
        io.to(`user:${userId}`).emit("conversation:updated", serialized);
        io.to(`user:${userId}`).emit("toast:show", {
          message: `${req.user.full_name || "Someone"} added you to ${conversation.name}`,
          type: "info"
        });
      });
    }

    return res.status(201).json({ success: true, conversation: serialized });
  } catch (err) {
    await tx.rollback();
    // eslint-disable-next-line no-console
    console.error("createGroup error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const access = await findAccessibleConversation(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: "Access denied" });

    const conv = await Conversation.findByPk(access.conversation.id, {
      include: [
        { model: User, as: "User1", attributes: ["id", "full_name", "email", "profile_pic"] },
        { model: User, as: "User2", attributes: ["id", "full_name", "email", "profile_pic"] },
        { model: User, as: "Creator", attributes: ["id", "full_name", "email", "profile_pic"] }
      ]
    });

    const serialized = await serializeConversation(conv, req.user.id);
    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const access = await findAccessibleConversation(req.params.id, userId);
    if (!access) return res.status(403).json({ error: "Access denied" });
    if (access.conversation.type !== "group") {
      return res.status(400).json({ error: "Only group conversations can be updated" });
    }
    if (!(await isGroupAdmin(access.conversation.id, userId))) {
      return res.status(403).json({ error: "Only group admins can update group details" });
    }

    const updates = {};
    if (req.body?.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Group name cannot be empty" });
      updates.name = name.slice(0, 150);
    }
    if (req.body?.description !== undefined) {
      updates.description = req.body.description
        ? String(req.body.description).trim().slice(0, 500)
        : null;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No updates provided" });
    }

    await access.conversation.update(updates);
    const serialized = await serializeConversation(access.conversation, userId);
    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.addMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const access = await findAccessibleConversation(req.params.id, userId);
    if (!access) return res.status(403).json({ error: "Access denied" });
    if (access.conversation.type !== "group") {
      return res.status(400).json({ error: "Only group conversations support members" });
    }
    if (!(await isGroupAdmin(access.conversation.id, userId))) {
      return res.status(403).json({ error: "Only group admins can add members" });
    }

    const memberIds = uniqueIds(req.body?.member_ids).filter((id) => id !== userId);
    if (!memberIds.length) {
      return res.status(400).json({ error: "Select at least one user to add" });
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: memberIds }, status: "active" },
      attributes: ["id"]
    });
    if (!users.length) {
      return res.status(400).json({ error: "No valid users to add" });
    }

    const existing = await ConversationMember.findAll({
      where: { conversation_id: access.conversation.id, user_id: { [Op.in]: memberIds } }
    });
    const existingMap = new Map(existing.map((m) => [m.user_id, m]));

    for (const u of users) {
      const row = existingMap.get(u.id);
      if (row) {
        if (row.left_at) {
          await row.update({ left_at: null, role: "member", joined_at: new Date() });
        }
      } else {
        await ConversationMember.create({
          conversation_id: access.conversation.id,
          user_id: u.id,
          role: "member",
          joined_at: new Date(),
          left_at: null
        });
      }
    }

    const serialized = await serializeConversation(access.conversation, userId);
    const io = req.app.get("io");
    if (io) {
      users.forEach((u) => {
        io.to(`user:${u.id}`).emit("conversation:updated", serialized);
        io.to(`user:${u.id}`).emit("toast:show", {
          message: `You were added to ${access.conversation.name}`,
          type: "info"
        });
      });
    }

    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const actorId = req.user.id;
    const targetUserId = Number(req.params.userId);
    const access = await findAccessibleConversation(req.params.id, actorId);
    if (!access) return res.status(403).json({ error: "Access denied" });
    if (access.conversation.type !== "group") {
      return res.status(400).json({ error: "Only group conversations support members" });
    }

    const isSelf = targetUserId === actorId;
    const actorIsAdmin = await isGroupAdmin(access.conversation.id, actorId);
    if (!isSelf && !actorIsAdmin) {
      return res.status(403).json({ error: "Only group admins can remove members" });
    }

    const target = await ConversationMember.findOne({
      where: {
        conversation_id: access.conversation.id,
        user_id: targetUserId,
        left_at: null
      }
    });
    if (!target) return res.status(404).json({ error: "Member not found" });

    if (target.role === "admin" && !isSelf) {
      const adminCount = await ConversationMember.count({
        where: {
          conversation_id: access.conversation.id,
          left_at: null,
          role: "admin"
        }
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot remove the only group admin" });
      }
    }

    if (isSelf && target.role === "admin") {
      const adminCount = await ConversationMember.count({
        where: {
          conversation_id: access.conversation.id,
          left_at: null,
          role: "admin"
        }
      });
      if (adminCount <= 1) {
        const nextAdmin = await ConversationMember.findOne({
          where: {
            conversation_id: access.conversation.id,
            left_at: null,
            user_id: { [Op.ne]: actorId }
          },
          order: [["joined_at", "ASC"]]
        });
        if (nextAdmin) await nextAdmin.update({ role: "admin" });
      }
    }

    await target.update({ left_at: new Date() });

    if (isSelf) return res.json({ success: true, left: true });

    const serialized = await serializeConversation(access.conversation, actorId);
    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.leaveGroup = async (req, res) => {
  req.params.userId = String(req.user.id);
  return exports.removeMember(req, res);
};

exports.markRead = async (req, res) => {
  const row = await Message.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Message not found" });

  const access = await findAccessibleConversation(row.conversation_id, req.user.id);
  if (!access) return res.status(403).json({ message: "Forbidden" });

  if (access.conversation.type === "group") {
    if (access.membership) await access.membership.update({ last_read_at: new Date() });
    return res.json({ ok: true });
  }

  if (row.receiver_id !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  await row.update({ is_read: true, read_at: new Date() });
  return res.json({ ok: true });
};

exports.uploadAttachments = async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "No files uploaded" });
    const max = env.maxMessageAttachments || 5;
    if (req.files.length > max) {
      return res.status(400).json({ error: `Maximum ${max} files allowed` });
    }

    return res.status(201).json({
      success: true,
      files: req.files.map((file) => ({
        original_file_name: file.originalname,
        stored_file_name: file.filename,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: `/uploads/${file.filename}`,
        url: `/uploads/${file.filename}`
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getVapidPublicKey = async (req, res) => {
  return res.json({ success: true, publicKey: pushService.getPublicVapidKey() });
};

exports.subscribePush = async (req, res) => {
  try {
    const sub = await pushService.saveSubscription(
      req.user.id,
      req.body?.subscription || req.body,
      req.headers["user-agent"]
    );
    return res.status(201).json({ success: true, id: sub.id });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.unsubscribePush = async (req, res) => {
  try {
    await pushService.removeSubscription(req.user.id, req.body?.endpoint);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
