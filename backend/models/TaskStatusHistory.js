const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "TaskStatusHistory",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      task_id: { type: DataTypes.INTEGER, allowNull: false },
      old_status: { type: DataTypes.STRING(30), allowNull: true },
      new_status: { type: DataTypes.STRING(30), allowNull: false },
      changed_by: { type: DataTypes.INTEGER, allowNull: true },
      note: { type: DataTypes.STRING(255), allowNull: true },
      changed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "task_status_history",
      createdAt: false,
      updatedAt: false
    }
  );
