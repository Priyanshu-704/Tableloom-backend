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
const { protect, hasPermission, optionalAuth } = require("../middleware/auth");
const {
  optionalCustomerSession,
  protectCustomerSession,
} = require("../middleware/customerSessionAuth");
router.get(
  "/session/:sessionId/history",
  protectCustomerSession(),
  getOrderHistoryBySession,
);
router.get("/session/:sessionId", protectCustomerSession(), getOrderBySession);
router.get("/:id", optionalAuth, optionalCustomerSession(), getOrder);
router.post("/:id/payment", optionalAuth, optionalCustomerSession(), processPayment);
router.use(protect);
router.put(
  "/:id/status",
  hasPermission("ORDER_UPDATE_STATUS"),
  updateOrderStatus,
);
router.get(
  "/status/:status",
  hasPermission("ORDER_VIEW_ALL"),
  getOrdersByStatus,
);
router.get(
  "/table/:tableId",
  hasPermission("ORDER_VIEW_ALL"),
  getOrdersByTable,
);
router.get("/", hasPermission("ORDER_VIEW_ALL"), getAllOrders);
router.get(
  "/dashboard/stats",
  hasPermission("VIEW_STATISTICS"),
  getOrderStatistics,
);
module.exports = router;
