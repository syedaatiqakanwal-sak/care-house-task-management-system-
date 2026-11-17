const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "EmailLog",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      task_id: { type: DataTypes.INTEGER, allowNull: true },
      sender_name: { type: DataTypes.STRING(120), allowNull: true },
      sender_email: { type: DataTypes.STRING(150), allowNull: true },
      subject: { type: DataTypes.STRING(255), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: true },
      received_at: { type: DataTypes.DATE, allowNull: true }
    },
    {
      tableName: "email_logs",
      updatedAt: false
    }
  );
