const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Conversation",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      type: {
        type: DataTypes.ENUM("direct", "group"),
        allowNull: false,
        defaultValue: "direct"
      },
      name: { type: DataTypes.STRING(150), allowNull: true },
      description: { type: DataTypes.STRING(500), allowNull: true },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      user1_id: { type: DataTypes.INTEGER, allowNull: true },
      user2_id: { type: DataTypes.INTEGER, allowNull: true },
      last_message_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "conversations",
      createdAt: false,
      updatedAt: false
    }
  );
