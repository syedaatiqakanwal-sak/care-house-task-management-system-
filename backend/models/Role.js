const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Role",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      role_name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: { type: DataTypes.INTEGER, allowNull: true }
    },
    {
      tableName: "roles"
    }
  );
