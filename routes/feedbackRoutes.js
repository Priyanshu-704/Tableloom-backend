const express = require("express");
const router = express.Router();
const {
  submitFeedback,
  getFeedbackBySession,
  getAllFeedback,
  getFeedbackStatistics,
  respondToFeedback,
  updateFeedbackStatus,
  getTrendingTopics,
  getStaffPerformance,
  getNPS,
  getFeedbackDashboard,
  getCustomerDetailsForFeedback,
  canSubmitFeedback,
  getFeedbackForActiveSession,
  updateSessionFeedback,
  deleteSessionFeedback,
} = require("../controllers/feedbackController");
const { protect, hasPermission } = require("../middleware/auth");
const { protectCustomerSession } = require("../middleware/customerSessionAuth");
router.post(
  "/",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  submitFeedback,
);
router.get("/session/:sessionId", protectCustomerSession(), getFeedbackBySession);
router.get(
  "/session/:sessionId/customer-details",
  protectCustomerSession(),
  getCustomerDetailsForFeedback,
);
router.get(
  "/session/:sessionId/can-submit",
  protectCustomerSession(),
  canSubmitFeedback,
);
router.get(
  "/session/:sessionId/active",
  protectCustomerSession(),
  getFeedbackForActiveSession,
);
router.put("/session/:sessionId/:id", protectCustomerSession(), updateSessionFeedback);
router.delete(
  "/session/:sessionId/:id",
  protectCustomerSession(),
  deleteSessionFeedback,
);
router.use(protect);
router.get("/", hasPermission("FEEDBACK_VIEW_ALL"), getAllFeedback);
router.get(
  "/statistics",
  hasPermission("FEEDBACK_STATISTICS"),
  getFeedbackStatistics,
);
router.get(
  "/dashboard",
  hasPermission("FEEDBACK_STATISTICS"),
  getFeedbackDashboard,
);
router.get(
  "/trending-topics",
  hasPermission("FEEDBACK_STATISTICS"),
  getTrendingTopics,
);
router.get(
  "/staff-performance",
  hasPermission("FEEDBACK_STATISTICS"),
  getStaffPerformance,
);
router.get("/nps", hasPermission("FEEDBACK_STATISTICS"), getNPS);
router.put(
  "/:id/respond",
  hasPermission("FEEDBACK_RESPOND"),
  respondToFeedback,
);
router.put(
  "/:id/status",
  hasPermission("FEEDBACK_RESPOND"),
  updateFeedbackStatus,
);
module.exports = router;
