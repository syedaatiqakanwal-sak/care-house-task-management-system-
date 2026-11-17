const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "TaskAttachment",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      task_id: { type: DataTypes.INTEGER, allowNull: false },
      file_name: { type: DataTypes.STRING(255), allowNull: false },
      file_path: { type: DataTypes.STRING(500), allowNull: false },
      file_size: { type: DataTypes.INTEGER, allowNull: true },
      mime_type: { type: DataTypes.STRING(100), allowNull: true },
      uploaded_by: { type: DataTypes.INTEGER, allowNull: true }
    },
    {
      tableName: "task_attachments",
      updatedAt: false
    }
  );
