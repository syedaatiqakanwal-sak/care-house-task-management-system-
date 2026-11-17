const jwt = require("jsonwebtoken");
const { User, Role, Permission } = require("../models");
const env = require("../config/env");

async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing access token" });
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    const user = await User.findByPk(decoded.sub, {
      include: [{ model: Role, include: [{ model: Permission, as: "permissions" }] }]
    });
    if (!user) return res.status(401).json({ message: "Invalid token user" });
    if (user && user.status !== "active") {
      return res.status(403).json({
        error: "Your account has been suspended. Contact admin."
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function authorize(permissionKey) {
  return (req, res, next) => {
    const roleName = req.user?.Role?.role_name;
    if (roleName === "Super Admin") return next();
    const keys = (req.user?.Role?.permissions || []).map((p) => p.permission_key);
    if (!keys.includes(permissionKey)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
