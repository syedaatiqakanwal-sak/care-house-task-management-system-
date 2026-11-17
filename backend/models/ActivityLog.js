const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "ActivityLog",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      module: { type: DataTypes.STRING(50), allowNull: true },
      details: { type: DataTypes.JSON, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.STRING(255), allowNull: true }
    },
    {
      tableName: "activity_logs",
      updatedAt: false
    }
  );
