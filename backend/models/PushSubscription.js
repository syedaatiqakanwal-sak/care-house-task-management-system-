const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "PushSubscription",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      endpoint: { type: DataTypes.STRING(500), allowNull: false, unique: true },
      p256dh: { type: DataTypes.STRING(255), allowNull: false },
      auth: { type: DataTypes.STRING(255), allowNull: false },
      user_agent: { type: DataTypes.STRING(255), allowNull: true },
      last_used_at: { type: DataTypes.DATE, allowNull: true }
    },
    {
      tableName: "push_subscriptions"
    }
  );
