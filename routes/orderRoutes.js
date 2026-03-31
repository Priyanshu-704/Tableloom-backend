const express = require("express");
const router = express.Router();
const {
  getOrder,
  getOrderBySession,
  getOrderHistoryBySession,
  updateOrderStatus,
  processPayment,
  getOrdersByStatus,
  getAllOrders,
  getOrderStatistics,
  getOrdersByTable,
} = require("../controllers/orderController");
const { protect, hasPermission } = require("../middleware/auth");

router.get("/session/:sessionId/history", getOrderHistoryBySession);
router.get("/session/:sessionId", getOrderBySession);
router.get("/:id", getOrder);
router.post("/:id/payment", processPayment);

router.use(protect);

router.put(
  "/:id/status",
  hasPermission("ORDER_UPDATE_STATUS"),
  updateOrderStatus
);

router.get(
  "/status/:status",
  hasPermission("ORDER_VIEW_ALL"),
  getOrdersByStatus
);
router.get(
  "/table/:tableId",
  hasPermission("ORDER_VIEW_ALL"),
  getOrdersByTable
);

router.get("/", hasPermission("ORDER_VIEW_ALL"), getAllOrders);
router.get(
  "/dashboard/stats",
  hasPermission("VIEW_STATISTICS"),
  getOrderStatistics
);

module.exports = router;
