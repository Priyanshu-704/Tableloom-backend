const express = require("express");
const router = express.Router();
const { getAdminDashboard } = require("../controllers/dashboardController");
const { protect, hasPermission } = require("../middleware/auth");

router.use(protect);
router.get("/overview", hasPermission("VIEW_DASHBOARD"), getAdminDashboard);

module.exports = router;
