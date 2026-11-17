const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MessageAttachment",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      message_id: { type: DataTypes.INTEGER, allowNull: false },
      original_file_name: { type: DataTypes.STRING(255), allowNull: false },
      stored_file_name: { type: DataTypes.STRING(255), allowNull: false },
      mime_type: { type: DataTypes.STRING(120), allowNull: false },
      file_size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      storage_path: { type: DataTypes.STRING(500), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "message_attachments",
      updatedAt: false,
      createdAt: false
    }
  );
