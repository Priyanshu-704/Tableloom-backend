const express = require("express");
const router = express.Router();
const {
  getNotifications,
  getSessionNotifications,
  getNotificationStats,
  markAsRead,
  markSessionAsRead,
  markAsAcknowledged,
  markAllAsRead,
  markAllSessionAsRead,
  dismissNotification,
  clearAllNotifications,
  clearAllSessionNotifications,
  createAnnouncement,
  cleanupNotifications
} = require("../controllers/notificationController");
const {
  protect,
  hasPermission
} = require("../middleware/auth");
const {
  requireTenantScope
} = require("../middleware/tenant");
const ensureNotificationScope = (req, res, next) => {
  if (String(req.user?.role || "").toLowerCase() === "super_admin") {
    return next();
  }
  return requireTenantScope(req, res, next);
};
router.get("/session/:sessionId", requireTenantScope, getSessionNotifications);
router.put("/session/:sessionId/mark-all-read", requireTenantScope, markAllSessionAsRead);
router.put("/session/:sessionId/clear-all", requireTenantScope, clearAllSessionNotifications);
router.put("/session/:sessionId/:id/read", requireTenantScope, markSessionAsRead);
router.use(protect);
router.use(ensureNotificationScope);
router.get("/", hasPermission("NOTIFICATION_VIEW"), getNotifications);
router.get("/stats", hasPermission("NOTIFICATION_VIEW"), getNotificationStats);
router.put("/mark-all-read", hasPermission("NOTIFICATION_VIEW"), markAllAsRead);
router.put("/clear-all", hasPermission("NOTIFICATION_VIEW"), clearAllNotifications);
router.put("/:id/read", hasPermission("NOTIFICATION_VIEW"), markAsRead);
router.put("/:id/acknowledge", hasPermission("NOTIFICATION_VIEW"), markAsAcknowledged);
router.put("/:id/dismiss", hasPermission("NOTIFICATION_VIEW"), dismissNotification);
router.post("/announcement", hasPermission("NOTIFICATION_ANNOUNCE"), createAnnouncement);
router.post("/cleanup", hasPermission("NOTIFICATION_ANNOUNCE"), cleanupNotifications);
module.exports = router;
