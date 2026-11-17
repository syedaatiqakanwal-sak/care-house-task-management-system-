const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Permission",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      permission_key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      module: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true }
    },
    {
      tableName: "permissions",
      timestamps: false
    }
  );
