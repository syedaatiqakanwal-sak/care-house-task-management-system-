const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Task",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      source: {
        type: DataTypes.ENUM("call", "email", "manual"),
        allowNull: false
      },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "medium"
      },
      status: {
        type: DataTypes.ENUM("pending", "in_progress", "on_hold", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "pending"
      },
      assigned_to: { type: DataTypes.INTEGER, allowNull: true },
      assigned_by: { type: DataTypes.INTEGER, allowNull: false },
      deadline: { type: DataTypes.DATE, allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      category: { type: DataTypes.STRING(80), allowNull: true }
    },
    {
      tableName: "tasks"
    }
  );
