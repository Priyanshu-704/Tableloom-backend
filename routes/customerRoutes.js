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
} = require("../controllers/customerController");
const { protect, hasPermission, hasAnyPermission } = require("../middleware/auth");

router.post("/session/scan", createSessionByScan);
router.post("/session/scan/validate", validateSessionScan);
router.post(
  "/session/:sessionId/generate-bill-before-payment",
  generateBillBeforePayment
);

router.get("/session/:sessionId", getCustomerSession);
router.put("/session/:sessionId/complete-online", completeSessionOnline);
router.put("/session/:sessionId/logout", customerLogout);
router.get("/session/:sessionId/with-bill", getSessionWithBill);
router.get("/session/:sessionId/bill-summary", getSessionBillSummary);
router.post("/session/:sessionId/request-bill", requestBillForSession);

router.use(protect);

router.get(
  "/session/table/:tableId",
  hasPermission("SESSION_VIEW_ALL"),
  getSessionByTable
);

router.put(
  "/session/:sessionId/complete-offline",
  hasPermission("SESSION_COMPLETE_OFFLINE"),
  completeSessionOffline
);

router.put(
  "/session/:sessionId/cancel",
  hasPermission("SESSION_CANCEL"),
  cancelSession
);

router.put(
  "/session/:sessionId/extend",
  hasPermission("SESSION_UPDATE"),
  extendSession
);

router.post(
  "/session/:sessionId/bill/:billId/mark-paid",
  hasAnyPermission("ORDER_PROCESS_PAYMENT", "SESSION_COMPLETE_OFFLINE"),
  markBillAsPaid
);
router.get(
  "/analytics",
  hasPermission("SESSION_STATISTICS"),
  getSessionAnalytics
);

router.get("/sessions", hasPermission("SESSION_VIEW_ALL"), getAllSessions);

module.exports = router;
