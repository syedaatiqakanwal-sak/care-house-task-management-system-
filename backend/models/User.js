const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "User",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      full_name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role_id: { type: DataTypes.INTEGER, allowNull: false },
      profile_pic: { type: DataTypes.STRING(255), allowNull: true },
      status: {
        type: DataTypes.ENUM("active", "inactive", "suspended"),
        allowNull: false,
        defaultValue: "active"
      },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
      reset_token: { type: DataTypes.STRING(255), allowNull: true },
      reset_expires: { type: DataTypes.DATE, allowNull: true },
      refresh_token: { type: DataTypes.TEXT, allowNull: true },
      force_password_change: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      failed_login_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lock_until: { type: DataTypes.DATE, allowNull: true },
      two_factor_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      two_factor_otp: { type: DataTypes.STRING(10), allowNull: true },
      two_factor_expires: { type: DataTypes.DATE, allowNull: true },
      desktop_notifications_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      notification_sound_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      notification_preview_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      notify_direct_messages: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      notify_group_messages: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    },
    {
      tableName: "users"
    }
  );
