const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(150), allowNull: false },
      body: { type: DataTypes.STRING(500), allowNull: true },
      type: { type: DataTypes.ENUM("task", "message", "system", "deadline"), allowNull: false },
      link: { type: DataTypes.STRING(255), allowNull: true },
      is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    {
      tableName: "notifications",
      updatedAt: false
    }
  );
