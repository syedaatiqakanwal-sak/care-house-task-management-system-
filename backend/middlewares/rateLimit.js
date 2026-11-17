const rateLimit = require("express-rate-limit");

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const auth = req.headers.authorization || "";
    const isAuthenticated = auth.startsWith("Bearer ");
    const isAuthRoute = req.path.startsWith("/api/v1/auth");
    return isAuthenticated && !isAuthRoute;
  },
  message: {
    message: "Too many requests. Please wait a moment and try again.",
    code: "RATE_LIMITED"
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const ip = req.ip;
    const email = req.body?.email;
    if (email && String(email).trim()) {
      return `${ip}_${String(email).toLowerCase().trim()}`;
    }
    return ip;
  },
  message: {
    message: "Too many login attempts. Try again later.",
    code: "AUTH_RATE_LIMITED"
  }
});

module.exports = { globalLimiter, authLimiter };
