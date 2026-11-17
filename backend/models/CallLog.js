const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "CallLog",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      task_id: { type: DataTypes.INTEGER, allowNull: true },
      caller_name: { type: DataTypes.STRING(120), allowNull: true },
      caller_phone: { type: DataTypes.STRING(30), allowNull: true },
      call_type: { type: DataTypes.ENUM("inbound", "outbound"), allowNull: false, defaultValue: "inbound" },
      duration_sec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      call_summary: { type: DataTypes.TEXT, allowNull: true },
      received_by: { type: DataTypes.INTEGER, allowNull: true },
      call_datetime: { type: DataTypes.DATE, allowNull: false }
    },
    {
      tableName: "call_logs",
      updatedAt: false
    }
  );
