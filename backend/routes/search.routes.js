const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const c = require("../controllers/search.controller");

const router = Router();
router.use(authenticate);
router.get("/", c.globalSearch);

module.exports = router;
