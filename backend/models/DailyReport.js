const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "DailyReport",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      day: { type: DataTypes.STRING(20), allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      task_description: { type: DataTypes.TEXT, allowNull: false },
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: true },
      status: {
        type: DataTypes.ENUM("completed", "pending"),
        allowNull: false,
        defaultValue: "pending"
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      week_number: { type: DataTypes.INTEGER, allowNull: false },
      month: { type: DataTypes.STRING(30), allowNull: false }
    },
    {
      tableName: "daily_reports",
      updatedAt: false
    }
  );
