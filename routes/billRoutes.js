const express = require("express");
const router = express.Router();
const billController = require("../controllers/billController");
const { protect, hasPermission, hasAnyPermission } = require("../middleware/auth");

router.get(
  "/admin/list",
  protect,
  hasPermission("SESSION_VIEW_ALL"),
  billController.getBillsAdmin
);
router.get(
  "/admin/statistics",
  protect,
  hasPermission("VIEW_STATISTICS"),
  billController.getBillStatistics
);

router.post("/request", billController.requestBill);
router.get("/session/:sessionId", billController.getBillBySession);
router.get("/:billId", billController.getBillById);
router.post(
  "/:billId/send-email",
  protect,
  hasPermission("SESSION_VIEW_ALL"),
  billController.sendBillEmail
);
router.post(
  "/:billId/pay",
  protect,
  hasAnyPermission("ORDER_PROCESS_PAYMENT", "SESSION_COMPLETE_OFFLINE"),
  billController.processPayment
);
router.get("/:billId/pdf", billController.downloadBillPDF);
router.get("/:billId/view", billController.viewBillPDF);
router.get("/:billId/payment-qr", billController.getPaymentQR);

module.exports = router;
