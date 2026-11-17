const { Op } = require("sequelize");
const { Task, User, Role, Message, Conversation, ConversationMember } = require("../models");

exports.globalSearch = async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ tasks: [], users: [], messages: [] });

  const tasks = await Task.findAll({
    where: {
      [Op.or]: [{ title: { [Op.like]: `%${q}%` } }, { description: { [Op.like]: `%${q}%` } }]
    },
    limit: 8,
    order: [["created_at", "DESC"]]
  });

  const users = await User.findAll({
    where: {
      [Op.or]: [{ full_name: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }],
      status: "active"
    },
    attributes: ["id", "full_name", "email", "profile_pic", "role_id"],
    include: [{ model: Role, attributes: ["id", "role_name"] }],
    limit: 12,
    order: [["created_at", "DESC"]]
  });

  const memberships = await ConversationMember.findAll({
    where: { user_id: req.user.id, left_at: null },
    attributes: ["conversation_id"]
  });
  const groupIds = memberships.map((m) => m.conversation_id);

  const myConversations = await Conversation.findAll({
    where: {
      [Op.or]: [
        { [Op.or]: [{ user1_id: req.user.id }, { user2_id: req.user.id }] },
        groupIds.length ? { id: { [Op.in]: groupIds } } : { id: { [Op.in]: [] } }
      ]
    },
    attributes: ["id"]
  });
  const convoIds = myConversations.map((c) => c.id);

  const messages = convoIds.length
    ? await Message.findAll({
        where: {
          conversation_id: { [Op.in]: convoIds },
          body: { [Op.like]: `%${q}%` }
        },
        limit: 8,
        order: [["created_at", "DESC"]]
      })
    : [];

  const mappedUsers = users.map((u) => {
    const j = u.toJSON();
    return {
      id: j.id,
      full_name: j.full_name,
      email: j.email,
      profile_pic: j.profile_pic,
      role_name: j.Role?.role_name || null
    };
  });

  return res.json({ tasks, users: mappedUsers, messages });
};
