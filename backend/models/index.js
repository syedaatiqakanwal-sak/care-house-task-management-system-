const sequelize = require("../config/database");

const Role = require("./Role")(sequelize);
const Permission = require("./Permission")(sequelize);
const User = require("./User")(sequelize);
const Task = require("./Task")(sequelize);
const CallLog = require("./CallLog")(sequelize);
const EmailLog = require("./EmailLog")(sequelize);
const TaskAttachment = require("./TaskAttachment")(sequelize);
const TaskComment = require("./TaskComment")(sequelize);
const TaskStatusHistory = require("./TaskStatusHistory")(sequelize);
const Conversation = require("./Conversation")(sequelize);
const ConversationMember = require("./ConversationMember")(sequelize);
const Message = require("./Message")(sequelize);
const MessageAttachment = require("./MessageAttachment")(sequelize);
const PushSubscription = require("./PushSubscription")(sequelize);
const Notification = require("./Notification")(sequelize);
const ActivityLog = require("./ActivityLog")(sequelize);
const DailyReport = require("./DailyReport")(sequelize);

Role.belongsToMany(Permission, {
  through: "role_permissions",
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
  timestamps: false
});
Permission.belongsToMany(Role, {
  through: "role_permissions",
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
  timestamps: false
});

Role.hasMany(User, { foreignKey: "role_id" });
User.belongsTo(Role, { foreignKey: "role_id" });

User.hasMany(Task, { foreignKey: "assigned_to", as: "assignedTasks" });
User.hasMany(Task, { foreignKey: "assigned_by", as: "createdTasks" });
Task.belongsTo(User, { foreignKey: "assigned_to", as: "assignee" });
Task.belongsTo(User, { foreignKey: "assigned_by", as: "assigner" });

Task.hasMany(CallLog, { foreignKey: "task_id", as: "calls" });
CallLog.belongsTo(Task, { foreignKey: "task_id", as: "task" });

Task.hasMany(EmailLog, { foreignKey: "task_id", as: "emails" });
EmailLog.belongsTo(Task, { foreignKey: "task_id", as: "task" });

Task.hasMany(TaskAttachment, { foreignKey: "task_id", as: "attachments" });
TaskAttachment.belongsTo(Task, { foreignKey: "task_id", as: "task" });
TaskAttachment.belongsTo(User, { foreignKey: "uploaded_by", as: "Uploader" });

Task.hasMany(TaskComment, { foreignKey: "task_id", as: "comments" });
TaskComment.belongsTo(Task, { foreignKey: "task_id", as: "task" });
TaskComment.belongsTo(User, { foreignKey: "user_id", as: "User" });

Task.hasMany(TaskStatusHistory, { foreignKey: "task_id", as: "statusHistory" });
TaskStatusHistory.belongsTo(Task, { foreignKey: "task_id", as: "task" });
TaskStatusHistory.belongsTo(User, { foreignKey: "changed_by", as: "ChangedBy" });

Conversation.belongsTo(User, { as: "User1", foreignKey: "user1_id" });
Conversation.belongsTo(User, { as: "User2", foreignKey: "user2_id" });
Conversation.belongsTo(User, { as: "Creator", foreignKey: "created_by" });

Conversation.hasMany(ConversationMember, { foreignKey: "conversation_id", as: "members" });
ConversationMember.belongsTo(Conversation, { foreignKey: "conversation_id", as: "conversation" });
ConversationMember.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(ConversationMember, { foreignKey: "user_id", as: "conversationMemberships" });

Conversation.hasMany(Message, { foreignKey: "conversation_id", as: "messages" });
Message.belongsTo(Conversation, { foreignKey: "conversation_id", as: "conversation" });
Message.belongsTo(User, { foreignKey: "sender_id", as: "Sender" });
Message.belongsTo(User, { foreignKey: "receiver_id", as: "Receiver" });
Message.belongsTo(Message, { as: "ReplyTo", foreignKey: "reply_to_message_id" });
Message.belongsTo(Message, { as: "ForwardedFrom", foreignKey: "forwarded_from_message_id" });
Message.hasMany(MessageAttachment, { foreignKey: "message_id", as: "attachments" });
MessageAttachment.belongsTo(Message, { foreignKey: "message_id", as: "message" });

PushSubscription.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(PushSubscription, { foreignKey: "user_id", as: "pushSubscriptions" });

Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Notification, { foreignKey: "user_id", as: "notifications" });

ActivityLog.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(ActivityLog, { foreignKey: "user_id", as: "activityLogs" });
User.hasMany(DailyReport, { foreignKey: "user_id", as: "dailyReports" });
DailyReport.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = {
  sequelize,
  Role,
  Permission,
  User,
  Task,
  CallLog,
  EmailLog,
  TaskAttachment,
  TaskComment,
  TaskStatusHistory,
  Conversation,
  ConversationMember,
  Message,
  MessageAttachment,
  PushSubscription,
  Notification,
  ActivityLog,
  DailyReport
};
