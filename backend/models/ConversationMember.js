const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "ConversationMember",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      conversation_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      role: {
        type: DataTypes.ENUM("admin", "member"),
        allowNull: false,
        defaultValue: "member"
      },
      joined_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      left_at: { type: DataTypes.DATE, allowNull: true },
      last_read_at: { type: DataTypes.DATE, allowNull: true }
    },
    {
      tableName: "conversation_members",
      updatedAt: false,
      createdAt: false,
      indexes: [
        {
          unique: true,
          fields: ["conversation_id", "user_id"],
          name: "uniq_conversation_user"
        }
      ]
    }
  );
