const express = require("express");
const router = express.Router();
const billController = require("../controllers/billController");
const {
  protect,
  hasPermission,
  hasAnyPermission,
  optionalAuth,
} = require("../middleware/auth");
const {
  optionalCustomerSession,
  protectCustomerSession,
} = require("../middleware/customerSessionAuth");
router.get(
  "/admin/list",
  protect,
  hasPermission("SESSION_VIEW_ALL"),
  billController.getBillsAdmin,
);
router.get(
  "/admin/statistics",
  protect,
  hasPermission("VIEW_STATISTICS"),
  billController.getBillStatistics,
);
router.post(
  "/request",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  billController.requestBill,
);
router.get(
  "/session/:sessionId",
  protectCustomerSession(),
  billController.getBillBySession,
);
router.get(
  "/:billId",
  optionalAuth,
  optionalCustomerSession(),
  billController.getBillById,
);
router.post(
  "/:billId/send-email",
  protect,
  hasPermission("SESSION_VIEW_ALL"),
  billController.sendBillEmail,
);
router.post(
  "/:billId/pay",
  protect,
  hasAnyPermission("ORDER_PROCESS_PAYMENT", "SESSION_COMPLETE_OFFLINE"),
  billController.processPayment,
);
router.get(
  "/:billId/pdf",
  optionalAuth,
  optionalCustomerSession(),
  billController.downloadBillPDF,
);
router.get(
  "/:billId/view",
  optionalAuth,
  optionalCustomerSession(),
  billController.viewBillPDF,
);
router.get(
  "/:billId/payment-qr",
  optionalAuth,
  optionalCustomerSession(),
  billController.getPaymentQR,
);
module.exports = router;
