const express = require("express");
const router = express.Router();
const {
  createSessionByScan,
  validateSessionScan,
  getCustomerSession,
  completeSessionOnline,
  completeSessionOffline,
  cancelSession,
  getSessionByTable,
  extendSession,
  getAllSessions,
  getSessionAnalytics,
  customerLogout,
  getSessionWithBill,
  getSessionBillSummary,
  markBillAsPaid,
  generateBillBeforePayment,
  requestBillForSession,
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require("../controllers/customerController");
const {
  protect,
  hasPermission,
  hasAnyPermission,
} = require("../middleware/auth");
const { protectCustomerSession } = require("../middleware/customerSessionAuth");
const { createRateLimit, getClientIp } = require("../middleware/security");

const scanRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many session start attempts. Please try again shortly.",
  keyGenerator: (req) =>
    `${getClientIp(req)}:${String(req.body?.tableId || "").trim()}`,
});

router.post("/session/scan", scanRateLimit, createSessionByScan);
router.post("/session/scan/validate", scanRateLimit, validateSessionScan);
router.post(
  "/session/:sessionId/generate-bill-before-payment",
  protectCustomerSession(),
  generateBillBeforePayment,
);
router.get("/session/:sessionId", protectCustomerSession(), getCustomerSession);
router.put(
  "/session/:sessionId/complete-online",
  protectCustomerSession(),
  completeSessionOnline,
);
router.put("/session/:sessionId/logout", protectCustomerSession(), customerLogout);
router.get(
  "/session/:sessionId/with-bill",
  protectCustomerSession(),
  getSessionWithBill,
);
router.get(
  "/session/:sessionId/bill-summary",
  protectCustomerSession(),
  getSessionBillSummary,
);
router.post(
  "/session/:sessionId/request-bill",
  protectCustomerSession(),
  requestBillForSession,
);
router.post(
  "/session/:sessionId/razorpay-order",
  protectCustomerSession(),
  createRazorpayOrder,
);
router.post(
  "/session/:sessionId/razorpay-verify",
  protectCustomerSession(),
  verifyRazorpayPayment,
);
router.use(protect);
router.get(
  "/session/table/:tableId",
  hasPermission("SESSION_VIEW_ALL"),
  getSessionByTable,
);
router.put(
  "/session/:sessionId/complete-offline",
  hasPermission("SESSION_COMPLETE_OFFLINE"),
  completeSessionOffline,
);
router.put(
  "/session/:sessionId/cancel",
  hasPermission("SESSION_CANCEL"),
  cancelSession,
);
router.put(
  "/session/:sessionId/extend",
  hasPermission("SESSION_UPDATE"),
  extendSession,
);
router.post(
  "/session/:sessionId/bill/:billId/mark-paid",
  hasAnyPermission("ORDER_PROCESS_PAYMENT", "SESSION_COMPLETE_OFFLINE"),
  markBillAsPaid,
);
router.get(
  "/analytics",
  hasPermission("SESSION_STATISTICS"),
  getSessionAnalytics,
);
router.get("/sessions", hasPermission("SESSION_VIEW_ALL"), getAllSessions);
module.exports = router;
