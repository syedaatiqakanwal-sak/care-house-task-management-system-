const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const env = require("../config/env");
const { User, Role, Permission } = require("../models");

function buildAuthPayload(user) {
  return {
    sub: user.id,
    email: user.email,
    role: user.Role?.role_name || null
  };
}

function signAccess(user) {
  return jwt.sign(buildAuthPayload(user), env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires
  });
}

function signRefresh(user) {
  return jwt.sign(buildAuthPayload(user), env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires
  });
}

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  const user = await User.findOne({
    where: { email: String(email).toLowerCase() },
    include: [{ model: Role, include: [{ model: Permission, as: "permissions" }] }]
  });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  if (user.status !== "active") return res.status(403).json({ message: "Account is not active" });

  if (user.lock_until && new Date(user.lock_until).getTime() > Date.now()) {
    return res.status(423).json({ message: "Account temporarily locked due to failed attempts" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const attempts = Number(user.failed_login_attempts || 0) + 1;
    const patch = { failed_login_attempts: attempts };
    if (attempts >= 5) {
      patch.lock_until = new Date(Date.now() + 15 * 60 * 1000);
      patch.failed_login_attempts = 0;
    }
    await user.update(patch);
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.two_factor_enabled) {
    return res.status(200).json({
      requiresTwoFactor: true,
      preAuthToken: jwt.sign({ sub: user.id }, env.jwt.accessSecret, { expiresIn: "5m" })
    });
  }

  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await user.update({
    refresh_token: refreshToken,
    failed_login_attempts: 0,
    lock_until: null,
    last_login_at: new Date()
  });

  return res.json({
    accessToken,
    refreshToken,
    forcePasswordChange: !!user.force_password_change,
    user
  });
};

exports.verify2fa = async (req, res) => {
  const { preAuthToken, otp } = req.body || {};
  if (!preAuthToken || !otp) return res.status(400).json({ message: "preAuthToken and otp are required" });

  let decoded;
  try {
    decoded = jwt.verify(preAuthToken, env.jwt.accessSecret);
  } catch {
    return res.status(401).json({ message: "Invalid pre-auth token" });
  }
  const user = await User.findByPk(decoded.sub, {
    include: [{ model: Role, include: [{ model: Permission, as: "permissions" }] }]
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!user.two_factor_enabled) return res.status(400).json({ message: "2FA is not enabled" });
  if (!user.two_factor_otp || String(user.two_factor_otp) !== String(otp)) {
    return res.status(401).json({ message: "Invalid OTP" });
  }
  if (user.two_factor_expires && new Date(user.two_factor_expires).getTime() < Date.now()) {
    return res.status(401).json({ message: "OTP expired" });
  }

  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await user.update({
    refresh_token: refreshToken,
    two_factor_otp: null,
    two_factor_expires: null,
    last_login_at: new Date()
  });
  return res.json({ accessToken, refreshToken, user });
};

exports.me = async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ["password_hash", "refresh_token", "reset_token", "two_factor_otp"] },
    include: [{ model: Role, include: [{ model: Permission, as: "permissions" }] }]
  });
  return res.json(user);
};

exports.updateMe = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const {
    full_name,
    phone,
    desktop_notifications_enabled,
    notification_sound_enabled,
    notification_preview_enabled,
    notify_direct_messages,
    notify_group_messages
  } = req.body || {};

  const updates = {
    full_name: full_name ?? user.full_name,
    phone: phone ?? user.phone
  };

  if (typeof desktop_notifications_enabled === "boolean") {
    updates.desktop_notifications_enabled = desktop_notifications_enabled;
  }
  if (typeof notification_sound_enabled === "boolean") {
    updates.notification_sound_enabled = notification_sound_enabled;
  }
  if (typeof notification_preview_enabled === "boolean") {
    updates.notification_preview_enabled = notification_preview_enabled;
  }
  if (typeof notify_direct_messages === "boolean") {
    updates.notify_direct_messages = notify_direct_messages;
  }
  if (typeof notify_group_messages === "boolean") {
    updates.notify_group_messages = notify_group_messages;
  }

  await user.update(updates);
  return res.json(user);
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !String(currentPassword).trim()) {
    return res.status(400).json({ message: "Current password is required" });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  const password_hash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await user.update({ password_hash });
  return res.json({ message: "Password updated successfully" });
};

exports.setProfilePic = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const profile_pic = req.file ? `/uploads/${req.file.filename}` : req.body?.profile_pic || null;
  await user.update({ profile_pic });
  return res.json({ ok: true, profile_pic });
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ message: "refreshToken is required" });
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
  const user = await User.findOne({
    where: {
      id: decoded.sub,
      refresh_token: { [Op.eq]: refreshToken }
    },
    include: [{ model: Role, include: [{ model: Permission, as: "permissions" }] }]
  });
  if (!user) return res.status(401).json({ message: "Refresh token not recognized" });
  const accessToken = signAccess(user);
  return res.json({ accessToken });
};

exports.logout = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user) await user.update({ refresh_token: null });
  return res.json({ message: "Logged out" });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ message: "Email is required" });
  }
  const user = await User.findOne({ where: { email: String(email).toLowerCase() } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await user.update({ reset_token: token, reset_expires: expires });
  }
  return res.json({ success: true, message: "If an account exists for this email, reset instructions have been sent." });
};
