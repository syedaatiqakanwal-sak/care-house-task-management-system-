import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useToast } from "../../components/common/Toast";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../api";
import {
  Search,
  Plus,
  X,
  MessageSquare,
  Users,
  User,
  Info,
  LogOut,
  UserPlus,
  UserMinus
} from "lucide-react";
import MessageBubble from "./MessageBubble";
import ComposerBar from "./ComposerBar";
import { ensurePushSubscription } from "../../utils/desktopNotifications";

const TEAL = "linear-gradient(135deg, #0D9488, #0F766E)";

function initials(name) {
  return name?.[0]?.toUpperCase() || "?";
}

function Avatar({ name, size = 44, group = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: group ? "12px" : "50%",
        background: TEAL,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size > 36 ? "16px" : "13px",
        flexShrink: 0
      }}
      aria-hidden="true"
    >
      {group ? <Users size={Math.max(14, size * 0.45)} /> : initials(name)}
    </div>
  );
}

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Inbox() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const socketCtx = useSocket();
  const socket = socketCtx?.socket;
  const on = socketCtx?.on;
  const off = socketCtx?.off;
  const emit = socketCtx?.emit;
  const toast = useToast();
  const showToast = toast?.showToast;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardSelected, setForwardSelected] = useState([]);
  const [forwardComment, setForwardComment] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState(null); // null | 'direct' | 'group'
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [composerError, setComposerError] = useState("");

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [managingMembers, setManagingMembers] = useState(false);

  const [convSearch, setConvSearch] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const surface = isDark ? "#1e293b" : "#fff";
  const pageBg = isDark ? "#0f172a" : "#f8fafc";
  const border = isDark ? "#334155" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#0f172a";
  const muted = "#64748b";

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/messages/conversations");
      const list = res.data?.conversations ?? res.data ?? [];
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    ensurePushSubscription(user).catch(() => {});
  }, [loadConversations, user]);

  useEffect(() => {
    if (socket && activeConv?.id && emit) emit("join:conversation", activeConv.id);
    window.dispatchEvent(
      new CustomEvent("messages:active-conversation", {
        detail: { conversationId: activeConv?.id || null }
      })
    );
  }, [socket, activeConv?.id, emit]);

  const loadMessages = useCallback(
    async (conv) => {
      if (!conv?.id) return;
      try {
        const res = await api.get(`/messages/conversations/${conv.id}/messages`);
        const list = res.data?.messages ?? res.data ?? [];
        setMessages(Array.isArray(list) ? list : []);
        scrollToBottom();
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
        );
        if (emit) emit("join:conversation", conv.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Load messages:", err);
      }
    },
    [emit, scrollToBottom]
  );

  useEffect(() => {
    const cid = Number(searchParams.get("conversation"));
    if (!cid || !conversations.length) return;
    const match = conversations.find((c) => c.id === cid);
    if (match && activeConv?.id !== cid) {
      setActiveConv(match);
      loadMessages(match);
    }
  }, [searchParams, conversations, activeConv?.id, loadMessages]);

  useEffect(() => {
    const onOpen = (e) => {
      const cid = Number(e.detail?.conversationId);
      if (!cid) return;
      setSearchParams({ conversation: String(cid) });
    };
    window.addEventListener("messages:open-conversation", onOpen);
    return () => window.removeEventListener("messages:open-conversation", onOpen);
  }, [setSearchParams]);

  useEffect(() => {
    if (!socket || !on || !off) return undefined;

    const handleNewMessage = (message) => {
      const convId = message.conversation_id;
      if (message.sender_id === user?.id) return;

      if (activeConv && convId === activeConv.id) {
        setMessages((prev) => {
          if (message.id && prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_count: 0, last_message: message } : c))
        );
      } else {
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === convId);
          if (!exists) {
            loadConversations();
            return prev;
          }
          return prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  unread_count: (c.unread_count || 0) + 1,
                  last_message: message,
                  last_message_at: message.created_at || message.createdAt
                }
              : c
          );
        });
      }
    };

    const handleTypingStart = ({ userId, userName } = {}) => {
      if (userId == null || userId === user?.id) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: userName || "Someone" }));
    };
    const handleTypingStop = ({ userId } = {}) => {
      if (userId == null || userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleConversationUpdated = () => {
      loadConversations();
    };

    const handleMessageUpdated = (message) => {
      if (!message?.id) return;
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...message } : m)));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === message.conversation_id && c.last_message?.id === message.id
            ? { ...c, last_message: message }
            : c
        )
      );
    };

    const handleMessageDeleted = (message) => {
      handleMessageUpdated(message);
    };

    on("message:receive", handleNewMessage);
    on("message:updated", handleMessageUpdated);
    on("message:deleted", handleMessageDeleted);
    on("typing:start", handleTypingStart);
    on("typing:stop", handleTypingStop);
    on("conversation:updated", handleConversationUpdated);

    return () => {
      off("message:receive", handleNewMessage);
      off("message:updated", handleMessageUpdated);
      off("message:deleted", handleMessageDeleted);
      off("typing:start", handleTypingStart);
      off("typing:stop", handleTypingStop);
      off("conversation:updated", handleConversationUpdated);
    };
  }, [socket, on, off, activeConv, user?.id, scrollToBottom, loadConversations]);

  const resetComposer = () => {
    setShowComposer(false);
    setComposerMode(null);
    setUserSearch("");
    setSearchResults([]);
    setSelectedUsers([]);
    setGroupName("");
    setGroupDescription("");
    setComposerError("");
  };

  const openComposer = () => {
    setShowComposer(true);
    setComposerMode(null);
    setComposerError("");
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    setShowGroupInfo(false);
    setTypingUsers({});
    setReplyTo(null);
    setPendingFiles((prev) => {
      prev.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    setSearchParams({ conversation: String(conv.id) });
    loadMessages(conv);
  };

  const addPendingFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const next = [...pendingFiles];
    for (const file of incoming) {
      if (next.length >= MAX_ATTACHMENTS) {
        if (showToast) showToast(`Maximum ${MAX_ATTACHMENTS} files allowed`, "error");
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        if (showToast) showToast(`${file.name} exceeds 10MB limit`, "error");
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      });
    }
    setPendingFiles(next);
  };

  const removePendingFile = (idx) => {
    setPendingFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFiles.length) || !activeConv) return;
    setSending(true);
    const msgBody = newMessage.trim();
    const filesSnapshot = [...pendingFiles];
    const replySnapshot = replyTo;
    setNewMessage("");
    setPendingFiles([]);
    setReplyTo(null);
    if (emit) {
      emit("typing:stop", { conversationId: activeConv.id, userId: user?.id });
    }
    try {
      let res;
      if (filesSnapshot.length) {
        const fd = new FormData();
        fd.append("conversation_id", String(activeConv.id));
        if (msgBody) fd.append("body", msgBody);
        if (replySnapshot?.id) fd.append("reply_to_message_id", String(replySnapshot.id));
        filesSnapshot.forEach((item) => fd.append("files", item.file, item.name));
        res = await api.post("/messages/messages", fd);
      } else {
        res = await api.post("/messages/messages", {
          conversation_id: activeConv.id,
          body: msgBody,
          reply_to_message_id: replySnapshot?.id || undefined
        });
      }
      const sentMsg = res.data?.message ?? res.data;
      setMessages((prev) => {
        if (sentMsg?.id && prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      scrollToBottom();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConv.id
            ? { ...c, last_message: sentMsg, last_message_at: sentMsg.created_at || sentMsg.createdAt }
            : c
        )
      );
      filesSnapshot.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to send message", "error");
      setNewMessage(msgBody);
      setPendingFiles(filesSnapshot);
      setReplyTo(replySnapshot);
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.body || "");
      if (showToast) showToast("Message copied", "success");
    } catch {
      if (showToast) showToast("Unable to copy message", "error");
    }
  };

  const handleEditMessage = async (msg, body) => {
    try {
      const res = await api.patch(`/messages/messages/${msg.id}`, { body });
      const updated = res.data?.message;
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
      if (showToast) showToast("Message updated", "success");
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to edit message", "error");
    }
  };

  const handleDeleteMessage = async (msg) => {
    const ok = window.confirm("Delete this message?");
    if (!ok) return;
    try {
      const res = await api.delete(`/messages/messages/${msg.id}`);
      const updated = res.data?.message;
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
      if (showToast) showToast("Message deleted", "success");
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to delete message", "error");
    }
  };

  const jumpToReply = (messageId) => {
    const el = document.getElementById(`message-${messageId}`);
    if (!el) {
      if (showToast) showToast("Original message is unavailable", "info");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    window.setTimeout(() => setHighlightId(null), 1600);
  };

  const submitForward = async () => {
    if (!forwardMessage || !forwardSelected.length) return;
    setForwarding(true);
    try {
      await api.post(`/messages/messages/${forwardMessage.id}/forward`, {
        conversation_ids: forwardSelected,
        comment: forwardComment.trim() || undefined
      });
      if (showToast) showToast("Message forwarded", "success");
      setForwardMessage(null);
      setForwardSelected([]);
      setForwardComment("");
      await loadConversations();
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to forward message", "error");
    } finally {
      setForwarding(false);
    }
  };

  const handleTyping = (value) => {
    setNewMessage(value);
    if (!emit || !activeConv) return;
    if (!isTyping) {
      setIsTyping(true);
      emit("typing:start", { conversationId: activeConv.id, userId: user?.id });
    }
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
      emit("typing:stop", { conversationId: activeConv.id, userId: user?.id });
    }, 1500);
  };

  const handleUserSearch = async (query) => {
    setUserSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
      const users = res.data?.users || [];
      const selectedIds = new Set(selectedUsers.map((u) => u.id));
      setSearchResults(users.filter((u) => u.id !== user?.id && !selectedIds.has(u.id)));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("User search:", e);
    } finally {
      setSearching(false);
    }
  };

  const toggleSelectedUser = (targetUser) => {
    setSelectedUsers((prev) => {
      if (prev.some((u) => u.id === targetUser.id)) {
        return prev.filter((u) => u.id !== targetUser.id);
      }
      return [...prev, targetUser];
    });
    setSearchResults((prev) => prev.filter((u) => u.id !== targetUser.id));
    setComposerError("");
  };

  const startNewChat = async (targetUser) => {
    try {
      await api.post("/messages/messages", {
        to_user_id: targetUser.id,
        body: `Hi ${targetUser.full_name}!`
      });
      resetComposer();
      const { data } = await api.get("/messages/conversations");
      const list = data?.conversations ?? data ?? [];
      const rows = Array.isArray(list) ? list : [];
      setConversations(rows);
      const match = rows.find(
        (c) => (c.type || "direct") !== "group" && c.other_user?.id === targetUser.id
      );
      if (match) {
        setActiveConv(match);
        loadMessages(match);
      }
      if (showToast) showToast(`Chat started with ${targetUser.full_name}`, "success");
    } catch (err) {
      if (showToast) showToast("Failed to start chat", "error");
    }
  };

  const createGroup = async () => {
    setComposerError("");
    if (!groupName.trim()) {
      setComposerError("Group name is required");
      return;
    }
    if (selectedUsers.length < 1) {
      setComposerError("Select at least one participant");
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await api.post("/messages/conversations/group", {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        member_ids: selectedUsers.map((u) => u.id)
      });
      const created = res.data?.conversation;
      resetComposer();
      await loadConversations();
      if (created) {
        setActiveConv(created);
        loadMessages(created);
      }
      if (showToast) showToast(`Group "${created?.name || groupName}" created`, "success");
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to create group";
      setComposerError(msg);
      if (showToast) showToast(msg, "error");
    } finally {
      setCreatingGroup(false);
    }
  };

  const openGroupInfo = () => {
    if (!activeConv || activeConv.type !== "group") return;
    setEditName(activeConv.name || "");
    setEditDescription(activeConv.description || "");
    setAddMemberSearch("");
    setAddMemberResults([]);
    setShowGroupInfo(true);
  };

  const saveGroupDetails = async () => {
    if (!activeConv || activeConv.my_role !== "admin") return;
    if (!editName.trim()) {
      if (showToast) showToast("Group name cannot be empty", "error");
      return;
    }
    setSavingGroup(true);
    try {
      const res = await api.patch(`/messages/conversations/${activeConv.id}`, {
        name: editName.trim(),
        description: editDescription.trim() || null
      });
      const updated = res.data?.conversation;
      if (updated) {
        setActiveConv(updated);
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      if (showToast) showToast("Group updated", "success");
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to update group", "error");
    } finally {
      setSavingGroup(false);
    }
  };

  const searchUsersToAdd = async (query) => {
    setAddMemberSearch(query);
    if (query.length < 2) {
      setAddMemberResults([]);
      return;
    }
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
      const users = res.data?.users || [];
      const memberIds = new Set((activeConv?.members || []).map((m) => m.user_id || m.user?.id));
      setAddMemberResults(users.filter((u) => u.id !== user?.id && !memberIds.has(u.id)));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const addMembers = async (usersToAdd) => {
    if (!usersToAdd?.length || !activeConv) return;
    setManagingMembers(true);
    try {
      const res = await api.post(`/messages/conversations/${activeConv.id}/members`, {
        member_ids: usersToAdd.map((u) => u.id)
      });
      const updated = res.data?.conversation;
      if (updated) {
        setActiveConv(updated);
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      setAddMemberSearch("");
      setAddMemberResults([]);
      if (showToast) showToast("Members added", "success");
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to add members", "error");
    } finally {
      setManagingMembers(false);
    }
  };

  const removeMember = async (memberUserId, memberName) => {
    if (!activeConv) return;
    const confirmed = window.confirm(`Remove ${memberName || "this member"} from the group?`);
    if (!confirmed) return;
    setManagingMembers(true);
    try {
      const res = await api.delete(`/messages/conversations/${activeConv.id}/members/${memberUserId}`);
      const updated = res.data?.conversation;
      if (updated) {
        setActiveConv(updated);
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      if (showToast) showToast("Member removed", "success");
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to remove member", "error");
    } finally {
      setManagingMembers(false);
    }
  };

  const leaveGroup = async () => {
    if (!activeConv) return;
    const confirmed = window.confirm(`Leave "${activeConv.name}"?`);
    if (!confirmed) return;
    try {
      await api.post(`/messages/conversations/${activeConv.id}/leave`);
      setShowGroupInfo(false);
      setActiveConv(null);
      setMessages([]);
      await loadConversations();
      if (showToast) showToast("You left the group", "success");
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.error || "Failed to leave group", "error");
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatConvTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return formatTime(d);
    return d.toLocaleDateString();
  };

  const conversationTitle = (conv) => {
    if (!conv) return "";
    if (conv.type === "group") return conv.name || "Group chat";
    return conv.other_user?.full_name || "Unknown";
  };

  const lastMessagePreview = (conv) => {
    const msg = conv.last_message;
    if (!msg) return "No messages yet";
    const body = typeof msg === "object" ? msg.body : msg;
    if (conv.type === "group" && typeof msg === "object" && msg.Sender?.full_name) {
      const prefix = msg.sender_id === user?.id ? "You" : msg.Sender.full_name.split(" ")[0];
      return `${prefix}: ${body}`;
    }
    return body || "No messages yet";
  };

  const filteredConversations = conversations.filter((c) => {
    if (!convSearch) return true;
    const q = convSearch.toLowerCase();
    if (c.type === "group") {
      return (c.name || "").toLowerCase().includes(q);
    }
    return c.other_user?.full_name?.toLowerCase()?.includes(q);
  });

  const typingLabel = (() => {
    const names = Object.values(typingUsers);
    if (!names.length) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return "Several people are typing...";
  })();

  const isGroup = activeConv?.type === "group";
  const isAdmin = activeConv?.my_role === "admin";

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        overflow: "hidden",
        background: pageBg
      }}
    >
      <div
        style={{
          width: "320px",
          flexShrink: 0,
          borderRight: `1px solid ${border}`,
          background: surface,
          display: "flex",
          flexDirection: "column",
          position: "relative"
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span style={{ fontWeight: 800, fontSize: "16px", color: text }}>Messages</span>
          <button
            type="button"
            onClick={openComposer}
            title="New conversation"
            aria-label="Start new conversation"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "none",
              background: TEAL,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        <div style={{ padding: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: pageBg,
              border: `1px solid ${border}`,
              borderRadius: "10px",
              padding: "8px 12px"
            }}
          >
            <Search size={14} color="#94a3b8" />
            <input
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "13px",
                color: text,
                width: "100%",
                fontFamily: "inherit"
              }}
            />
          </div>
        </div>

        {showComposer && (
          <div
            style={{
              position: "absolute",
              top: "64px",
              left: 0,
              width: "320px",
              maxHeight: "calc(100% - 64px)",
              overflowY: "auto",
              background: surface,
              borderRadius: "0 0 16px 0",
              boxShadow: "4px 4px 20px rgba(0,0,0,0.15)",
              border: `1px solid ${border}`,
              zIndex: 100,
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: text }}>
                {!composerMode ? "New Conversation" : composerMode === "direct" ? "New Direct Message" : "Create Group Chat"}
              </span>
              <button
                type="button"
                onClick={resetComposer}
                aria-label="Close composer"
                style={{ background: "none", border: "none", cursor: "pointer", color: muted }}
              >
                <X size={16} />
              </button>
            </div>

            {!composerMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setComposerMode("direct")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1px solid ${border}`,
                    background: pageBg,
                    cursor: "pointer",
                    color: text,
                    fontFamily: "inherit",
                    textAlign: "left"
                  }}
                >
                  <User size={16} color="#0D9488" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>New Direct Message</div>
                    <div style={{ fontSize: "11px", color: muted }}>Chat with one person</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("group")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1px solid ${border}`,
                    background: pageBg,
                    cursor: "pointer",
                    color: text,
                    fontFamily: "inherit",
                    textAlign: "left"
                  }}
                >
                  <Users size={16} color="#0D9488" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>Create Group Chat</div>
                    <div style={{ fontSize: "11px", color: muted }}>Chat with multiple staff</div>
                  </div>
                </button>
              </div>
            )}

            {composerMode === "direct" && (
              <>
                <button
                  type="button"
                  onClick={() => setComposerMode(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0D9488",
                    fontSize: "12px",
                    cursor: "pointer",
                    marginBottom: "8px",
                    padding: 0,
                    fontFamily: "inherit"
                  }}
                >
                  ← Back
                </button>
                <input
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="Search users by name..."
                  autoFocus
                  aria-label="Search users"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1.5px solid ${border}`,
                    borderRadius: "10px",
                    fontSize: "13px",
                    background: pageBg,
                    color: text,
                    outline: "none",
                    fontFamily: "inherit",
                    marginBottom: "8px"
                  }}
                />
                {searching && <div style={{ color: muted, fontSize: "12px", padding: "8px" }}>Searching...</div>}
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && startNewChat(u)}
                    onClick={() => startNewChat(u)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      borderRadius: "10px",
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? "#334155" : "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Avatar name={u.full_name} size={36} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: text }}>{u.full_name}</div>
                      <div style={{ fontSize: "11px", color: muted }}>{u.role_name || u.email}</div>
                    </div>
                  </div>
                ))}
                {userSearch.length >= 2 && !searching && searchResults.length === 0 && (
                  <div style={{ color: muted, fontSize: "12px", padding: "8px", textAlign: "center" }}>No users found</div>
                )}
              </>
            )}

            {composerMode === "group" && (
              <>
                <button
                  type="button"
                  onClick={() => setComposerMode(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0D9488",
                    fontSize: "12px",
                    cursor: "pointer",
                    marginBottom: "8px",
                    padding: 0,
                    fontFamily: "inherit"
                  }}
                >
                  ← Back
                </button>

                <label style={{ fontSize: "11px", fontWeight: 700, color: muted, display: "block", marginBottom: "4px" }}>
                  Group name *
                </label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Care Team Morning"
                  aria-label="Group name"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1.5px solid ${border}`,
                    borderRadius: "10px",
                    fontSize: "13px",
                    background: pageBg,
                    color: text,
                    outline: "none",
                    fontFamily: "inherit",
                    marginBottom: "10px"
                  }}
                />

                <label style={{ fontSize: "11px", fontWeight: 700, color: muted, display: "block", marginBottom: "4px" }}>
                  Description (optional)
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What is this group for?"
                  rows={2}
                  aria-label="Group description"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1.5px solid ${border}`,
                    borderRadius: "10px",
                    fontSize: "13px",
                    background: pageBg,
                    color: text,
                    outline: "none",
                    fontFamily: "inherit",
                    marginBottom: "10px",
                    resize: "vertical"
                  }}
                />

                {selectedUsers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                    {selectedUsers.map((u) => (
                      <span
                        key={u.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: isDark ? "rgba(13,148,136,0.2)" : "rgba(13,148,136,0.12)",
                          color: "#0F766E",
                          borderRadius: "999px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 600
                        }}
                      >
                        {u.full_name}
                        <button
                          type="button"
                          onClick={() => toggleSelectedUser(u)}
                          aria-label={`Remove ${u.full_name}`}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            color: "#0F766E"
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <label style={{ fontSize: "11px", fontWeight: 700, color: muted, display: "block", marginBottom: "4px" }}>
                  Add participants *
                </label>
                <input
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="Search staff..."
                  aria-label="Search participants"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1.5px solid ${border}`,
                    borderRadius: "10px",
                    fontSize: "13px",
                    background: pageBg,
                    color: text,
                    outline: "none",
                    fontFamily: "inherit",
                    marginBottom: "8px"
                  }}
                />

                {searching && <div style={{ color: muted, fontSize: "12px", padding: "8px" }}>Searching...</div>}

                {searchResults.map((u) => (
                  <label
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px",
                      borderRadius: "10px",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.some((s) => s.id === u.id)}
                      onChange={() => toggleSelectedUser(u)}
                      aria-label={`Select ${u.full_name}`}
                    />
                    <Avatar name={u.full_name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: text }}>{u.full_name}</div>
                      <div style={{ fontSize: "11px", color: muted }}>{u.role_name || u.email}</div>
                    </div>
                  </label>
                ))}

                {composerError && (
                  <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "8px", marginBottom: "8px" }}>
                    {composerError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={createGroup}
                  disabled={creatingGroup}
                  style={{
                    width: "100%",
                    marginTop: "8px",
                    background: TEAL,
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: creatingGroup ? "not-allowed" : "pointer",
                    opacity: creatingGroup ? 0.7 : 1,
                    fontFamily: "inherit"
                  }}
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </button>
              </>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} style={{ padding: "14px 16px", display: "flex", gap: "10px" }}>
                <div className="skeleton" style={{ width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: "14px", width: "60%", marginBottom: "6px", borderRadius: "4px" }} />
                  <div className="skeleton" style={{ height: "12px", width: "80%", borderRadius: "4px" }} />
                </div>
              </div>
            ))
          ) : filteredConversations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: muted }}>
              <MessageSquare size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <div style={{ fontSize: "14px", fontWeight: 600 }}>No conversations yet</div>
              <div style={{ fontSize: "12px" }}>Click + to start a new chat</div>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConv?.id === conv.id;
              const hasUnread = (conv.unread_count || 0) > 0;
              const group = conv.type === "group";
              return (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectConv(conv)}
                  onClick={() => handleSelectConv(conv)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    background: isActive ? (isDark ? "rgba(13,148,136,0.15)" : "rgba(13,148,136,0.08)") : "transparent",
                    borderLeft: isActive ? "3px solid #0D9488" : "3px solid transparent",
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = isDark ? "#334155" : "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Avatar
                    name={group ? conv.name : conv.other_user?.full_name}
                    size={44}
                    group={group}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                      <span
                        style={{
                          fontWeight: hasUnread ? 700 : 600,
                          fontSize: "13px",
                          color: text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        {conversationTitle(conv)}
                        {group && (
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              color: "#0D9488",
                              background: isDark ? "rgba(13,148,136,0.2)" : "rgba(13,148,136,0.12)",
                              borderRadius: "4px",
                              padding: "1px 5px"
                            }}
                          >
                            GROUP
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: "10px", color: "#94a3b8", flexShrink: 0 }}>
                        {formatConvTime(conv.last_message?.created_at || conv.last_message?.createdAt || conv.last_message_at)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          color: hasUnread ? (isDark ? "#cbd5e1" : "#374151") : "#94a3b8",
                          fontWeight: hasUnread ? 600 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {lastMessagePreview(conv)}
                      </span>
                      {hasUnread && (
                        <span
                          style={{
                            minWidth: "18px",
                            height: "18px",
                            borderRadius: "9px",
                            background: "#0D9488",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 5px",
                            flexShrink: 0
                          }}
                        >
                          {conv.unread_count > 9 ? "9+" : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        {activeConv ? (
          <>
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${border}`,
                background: surface,
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <Avatar
                name={isGroup ? activeConv.name : activeConv.other_user?.full_name}
                size={40}
                group={isGroup}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: text }}>{conversationTitle(activeConv)}</div>
                <div style={{ fontSize: "11px", color: typingLabel ? "#0D9488" : muted }}>
                  {typingLabel ||
                    (isGroup
                      ? `${activeConv.member_count || activeConv.members?.length || 0} participants`
                      : "Active now")}
                </div>
              </div>
              {isGroup && (
                <button
                  type="button"
                  onClick={openGroupInfo}
                  title="Group information"
                  aria-label="Open group information"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1px solid ${border}`,
                    background: pageBg,
                    color: muted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Info size={16} />
                </button>
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", margin: "auto", color: muted }}>
                  <div style={{ fontSize: "40px" }}>👋</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "8px" }}>
                    {isGroup
                      ? `Say hello in ${activeConv.name}!`
                      : `Say hello to ${activeConv.other_user?.full_name}!`}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isSent = msg.sender_id === user?.id;
                  const showAvatar = !isSent && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
                  const showSenderName =
                    isGroup && !isSent && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        outline: highlightId === msg.id ? "2px solid #0D9488" : "none",
                        borderRadius: "12px",
                        transition: "outline 0.2s"
                      }}
                    >
                      <MessageBubble
                        msg={msg}
                        isGroup={isGroup}
                        isDark={isDark}
                        userId={user?.id}
                        textColor={text}
                        showAvatar={showAvatar}
                        showSenderName={showSenderName}
                        formatTime={formatTime}
                        onReply={setReplyTo}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onCopy={handleCopyMessage}
                        onForward={(m) => {
                          setForwardMessage(m);
                          setForwardSelected([]);
                          setForwardComment("");
                        }}
                        onJumpToReply={jumpToReply}
                        onPreviewImage={setImagePreview}
                      />
                    </div>
                  );
                })
              )}

              {typingLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      background: isDark ? "#334155" : "#f1f5f9",
                      borderRadius: "16px 16px 16px 4px",
                      padding: "10px 14px",
                      display: "flex",
                      gap: "4px",
                      alignItems: "center"
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#94a3b8",
                          animation: `bounce 1.4s ease ${i * 0.2}s infinite`
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <ComposerBar
              isDark={isDark}
              text={text}
              border={border}
              pageBg={pageBg}
              surface={surface}
              newMessage={newMessage}
              onChangeMessage={handleTyping}
              onSend={handleSend}
              sending={sending}
              pendingFiles={pendingFiles}
              onRemoveFile={removePendingFile}
              onAddFiles={addPendingFiles}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              dragOver={dragOver}
              setDragOver={setDragOver}
            />

            {showGroupInfo && isGroup && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "min(360px, 100%)",
                  height: "100%",
                  background: surface,
                  borderLeft: `1px solid ${border}`,
                  boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderBottom: `1px solid ${border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: "15px", color: text }}>Group info</span>
                  <button
                    type="button"
                    onClick={() => setShowGroupInfo(false)}
                    aria-label="Close group info"
                    style={{ background: "none", border: "none", cursor: "pointer", color: muted }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }}>
                    <Avatar name={activeConv.name} size={64} group />
                    <div style={{ fontWeight: 800, fontSize: "16px", color: text, marginTop: "10px", textAlign: "center" }}>
                      {activeConv.name}
                    </div>
                    <div style={{ fontSize: "12px", color: muted, marginTop: "4px" }}>
                      {activeConv.member_count || activeConv.members?.length || 0} participants
                    </div>
                    {activeConv.created_at && (
                      <div style={{ fontSize: "11px", color: muted, marginTop: "4px" }}>
                        Created {new Date(activeConv.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {isAdmin ? (
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: muted }}>Group name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          width: "100%",
                          marginTop: "4px",
                          marginBottom: "10px",
                          padding: "10px 12px",
                          border: `1.5px solid ${border}`,
                          borderRadius: "10px",
                          fontSize: "13px",
                          background: pageBg,
                          color: text,
                          outline: "none",
                          fontFamily: "inherit"
                        }}
                      />
                      <label style={{ fontSize: "11px", fontWeight: 700, color: muted }}>Description</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          marginTop: "4px",
                          marginBottom: "10px",
                          padding: "10px 12px",
                          border: `1.5px solid ${border}`,
                          borderRadius: "10px",
                          fontSize: "13px",
                          background: pageBg,
                          color: text,
                          outline: "none",
                          fontFamily: "inherit",
                          resize: "vertical"
                        }}
                      />
                      <button
                        type="button"
                        onClick={saveGroupDetails}
                        disabled={savingGroup}
                        style={{
                          width: "100%",
                          background: TEAL,
                          color: "#fff",
                          border: "none",
                          borderRadius: "10px",
                          padding: "10px",
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: "pointer",
                          fontFamily: "inherit"
                        }}
                      >
                        {savingGroup ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  ) : (
                    activeConv.description && (
                      <div
                        style={{
                          marginBottom: "16px",
                          padding: "12px",
                          borderRadius: "10px",
                          background: pageBg,
                          color: muted,
                          fontSize: "13px"
                        }}
                      >
                        {activeConv.description}
                      </div>
                    )
                  )}

                  {activeConv.Creator && (
                    <div style={{ fontSize: "12px", color: muted, marginBottom: "12px" }}>
                      Created by <strong style={{ color: text }}>{activeConv.Creator.full_name}</strong>
                    </div>
                  )}

                  <div style={{ fontWeight: 700, fontSize: "13px", color: text, marginBottom: "8px" }}>Participants</div>

                  {(activeConv.members || []).map((m) => {
                    const memberUser = m.user || {};
                    const memberId = m.user_id || memberUser.id;
                    return (
                      <div
                        key={m.id || memberId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 0",
                          borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`
                        }}
                      >
                        <Avatar name={memberUser.full_name} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: text }}>
                            {memberUser.full_name}
                            {memberId === user?.id ? " (You)" : ""}
                          </div>
                          <div style={{ fontSize: "11px", color: muted }}>
                            {m.role === "admin" ? "Admin" : "Member"}
                            {memberUser.role_name ? ` · ${memberUser.role_name}` : ""}
                          </div>
                        </div>
                        {isAdmin && memberId !== user?.id && (
                          <button
                            type="button"
                            disabled={managingMembers}
                            onClick={() => removeMember(memberId, memberUser.full_name)}
                            title="Remove member"
                            aria-label={`Remove ${memberUser.full_name}`}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#dc2626",
                              display: "flex"
                            }}
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {isAdmin && (
                    <div style={{ marginTop: "16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: text, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <UserPlus size={14} /> Add members
                      </div>
                      <input
                        value={addMemberSearch}
                        onChange={(e) => searchUsersToAdd(e.target.value)}
                        placeholder="Search users to add..."
                        aria-label="Search users to add"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: `1.5px solid ${border}`,
                          borderRadius: "10px",
                          fontSize: "13px",
                          background: pageBg,
                          color: text,
                          outline: "none",
                          fontFamily: "inherit",
                          marginBottom: "8px"
                        }}
                      />
                      {addMemberResults.map((u) => (
                        <div
                          key={u.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "8px",
                            borderRadius: "8px"
                          }}
                        >
                          <Avatar name={u.full_name} size={30} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: text }}>{u.full_name}</div>
                            <div style={{ fontSize: "11px", color: muted }}>{u.role_name || u.email}</div>
                          </div>
                          <button
                            type="button"
                            disabled={managingMembers}
                            onClick={() => addMembers([u])}
                            style={{
                              background: TEAL,
                              color: "#fff",
                              border: "none",
                              borderRadius: "8px",
                              padding: "6px 10px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "inherit"
                            }}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: "16px", borderTop: `1px solid ${border}` }}>
                  <button
                    type="button"
                    onClick={leaveGroup}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: isDark ? "rgba(220,38,38,0.15)" : "#fef2f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      borderRadius: "10px",
                      padding: "12px",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      fontFamily: "inherit"
                    }}
                  >
                    <LogOut size={14} />
                    Leave group
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: muted
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "20px",
                background: isDark ? "#1e293b" : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px"
              }}
            >
              <MessageSquare size={36} color="#0D9488" />
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: text, marginBottom: "8px" }}>Your Messages</div>
            <div style={{ fontSize: "13px", marginBottom: "20px", textAlign: "center" }}>
              Select a conversation or start a new direct or group chat
            </div>
            <button
              type="button"
              onClick={openComposer}
              style={{
                background: TEAL,
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "12px 24px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontFamily: "inherit"
              }}
            >
              <Plus size={16} />
              Start New Chat
            </button>
          </div>
        )}
      </div>

      {forwardMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
        >
          <div
            style={{
              width: "min(480px, 100%)",
              maxHeight: "80vh",
              overflow: "auto",
              background: surface,
              borderRadius: "16px",
              border: `1px solid ${border}`,
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: 800, color: text }}>Forward message</span>
              <button type="button" onClick={() => setForwardMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: muted }}>
                <X size={16} />
              </button>
            </div>
            <textarea
              value={forwardComment}
              onChange={(e) => setForwardComment(e.target.value)}
              placeholder="Add an optional comment..."
              rows={2}
              style={{
                width: "100%",
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                border: `1px solid ${border}`,
                background: pageBg,
                color: text,
                fontFamily: "inherit",
                fontSize: "13px"
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
              {conversations
                .filter((c) => c.id !== activeConv?.id)
                .map((c) => {
                  const selected = forwardSelected.includes(c.id);
                  const label = c.type === "group" ? c.name : c.other_user?.full_name;
                  return (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px",
                        borderRadius: "10px",
                        background: selected ? (isDark ? "rgba(13,148,136,0.15)" : "rgba(13,148,136,0.08)") : "transparent",
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setForwardSelected((prev) =>
                            selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                      />
                      <Avatar name={label} size={32} group={c.type === "group"} />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: text }}>{label || "Conversation"}</div>
                        <div style={{ fontSize: "11px", color: muted }}>{c.type === "group" ? "Group" : "Direct"}</div>
                      </div>
                    </label>
                  );
                })}
            </div>
            <button
              type="button"
              disabled={!forwardSelected.length || forwarding}
              onClick={submitForward}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "10px",
                padding: "12px",
                background: TEAL,
                color: "#fff",
                fontWeight: 700,
                cursor: !forwardSelected.length || forwarding ? "not-allowed" : "pointer",
                opacity: !forwardSelected.length || forwarding ? 0.7 : 1,
                fontFamily: "inherit"
              }}
            >
              {forwarding ? "Forwarding..." : "Forward"}
            </button>
          </div>
        </div>
      )}

      {imagePreview && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setImagePreview(null)}
          onKeyDown={(e) => e.key === "Escape" && setImagePreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.8)",
            zIndex: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px"
          }}
        >
          <img src={imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "12px" }} />
        </div>
      )}
    </div>
  );
}
