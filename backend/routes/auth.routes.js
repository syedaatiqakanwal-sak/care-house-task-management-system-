const { Router } = require("express");
const { body } = require("express-validator");
const c = require("../controllers/auth.controller");
const { authenticate } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/rateLimit");
const { validate } = require("../middlewares/validate");
const { upload } = require("../middlewares/upload");

const router = Router();

router.post(
  "/login",
  authLimiter,
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isString().isLength({ min: 6 }).withMessage("Password is required"),
  validate,
  c.login
);

router.post(
  "/verify-2fa",
  body("preAuthToken").isString().notEmpty(),
  body("otp").isString().notEmpty(),
  validate,
  c.verify2fa
);

router.post("/refresh", c.refresh);

router.post(
  "/forgot-password",
  authLimiter,
  body("email").isEmail().withMessage("Valid email is required"),
  validate,
  c.forgotPassword
);

router.get("/me", authenticate, c.me);
router.put("/me", authenticate, c.updateMe);
router.patch("/change-password", authenticate, c.changePassword);
router.post("/profile-pic", authenticate, upload.single("profile_pic"), c.setProfilePic);
router.post("/logout", authenticate, c.logout);

module.exports = router;
