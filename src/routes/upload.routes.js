// chat-app-server/src/routes/upload.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const { presign } = require("../controllers/upload.controller");

router.post("/presign", authMiddleware, presign);

module.exports = router;
