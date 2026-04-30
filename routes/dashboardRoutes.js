const express = require("express");
const router = express.Router();
const { getAdminDashboard } = require("../controllers/dashboardController");
const { protect, hasPermission } = require("../middleware/auth");

const canAccessDashboard = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (["manager", "admin", "super_admin"].includes(role)) {
    return next();
  }
  return hasPermission("VIEW_DASHBOARD")(req, res, next);
};

router.use(protect);
router.get("/overview", canAccessDashboard, getAdminDashboard);
module.exports = router;
