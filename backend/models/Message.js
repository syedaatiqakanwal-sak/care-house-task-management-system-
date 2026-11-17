const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Message",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      conversation_id: { type: DataTypes.INTEGER, allowNull: false },
      sender_id: { type: DataTypes.INTEGER, allowNull: false },
      receiver_id: { type: DataTypes.INTEGER, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: true },
      attachment_url: { type: DataTypes.STRING(500), allowNull: true },
      message_type: {
        type: DataTypes.ENUM("text", "image", "document", "mixed"),
        allowNull: false,
        defaultValue: "text"
      },
      reply_to_message_id: { type: DataTypes.INTEGER, allowNull: true },
      forwarded_from_message_id: { type: DataTypes.INTEGER, allowNull: true },
      is_forwarded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_edited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      edited_at: { type: DataTypes.DATE, allowNull: true },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
      is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      read_at: { type: DataTypes.DATE, allowNull: true }
    },
    {
      tableName: "messages",
      updatedAt: false
    }
  );
