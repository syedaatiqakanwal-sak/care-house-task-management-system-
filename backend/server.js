const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const env = require("./config/env");
const app = require("./app");
const {
  sequelize,
  User,
  Role,
  Permission,
  Notification,
  Conversation,
  ConversationMember
} = require("./models");
const { startDeadlineReminder } = require("./services/deadlineReminder.service");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientUrl,
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const authHeader = socket.handshake?.headers?.authorization || "";
    const handshakeToken = socket.handshake?.auth?.token || null;
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : handshakeToken;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    const user = await User.findByPk(decoded.sub, {
      attributes: ["id", "full_name", "email", "role_id"],
      include: [{ model: Role, include: [{ model: Permission, as: "permissions" }] }]
    });
    if (!user) return next(new Error("Unauthorized"));
    socket.user = user;
    return next();
  } catch (err) {
    return next(new Error("Unauthorized"));
  }
});

app.set("io", io);

io.on("connection", async (socket) => {
  const user = socket.user;
  socket.join(`user:${user.id}`);
  console.log(`[socket] user ${user.id} (${user.full_name}) connected, joined room user:${user.id}`);

  socket.on("join:user", (userId) => {
    const id = Number(userId);
    if (id && id === user.id) {
      socket.join(`user:${id}`);
      // eslint-disable-next-line no-console
      console.log(`User ${id} joined room`);
    }
  });

  socket.on("join:conversation", async (conversationId) => {
    const cid = Number(conversationId);
    if (!cid) return;
    const conv = await Conversation.findByPk(cid);
    if (!conv) return;

    if (conv.type === "group") {
      const membership = await ConversationMember.findOne({
        where: { conversation_id: cid, user_id: user.id, left_at: null }
      });
      if (!membership) return;
    } else if (![conv.user1_id, conv.user2_id].includes(user.id)) {
      return;
    }

    socket.join(`conv:${cid}`);
  });

  socket.on("typing:start", ({ conversationId }) => {
    const cid = Number(conversationId);
    if (!cid) return;
    socket.to(`conv:${cid}`).emit("typing:start", {
      userId: user.id,
      userName: user.full_name || user.email || "Someone"
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    const cid = Number(conversationId);
    if (!cid) return;
    socket.to(`conv:${cid}`).emit("typing:stop", {
      userId: user.id,
      userName: user.full_name || user.email || "Someone"
    });
  });

  socket.on("notification:mark-read", async (notificationId) => {
    if (!notificationId) return;
    await Notification.update(
      { is_read: true },
      { where: { id: notificationId, user_id: user.id } }
    );
  });

  socket.on("disconnect", () => {
    // eslint-disable-next-line no-console
    console.log("User disconnected:", socket.id, "userId:", user.id);
  });
});

async function start() {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log("Database connection established");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Database connection failed, starting API in degraded mode:", err.message);
  }
  startDeadlineReminder(io);
  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Letscare backend listening on ${env.port}`);
  });
}

start();
