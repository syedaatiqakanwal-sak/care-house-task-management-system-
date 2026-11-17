const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "TaskComment",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      task_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: false }
    },
    {
      tableName: "task_comments",
      updatedAt: false
    }
  );
