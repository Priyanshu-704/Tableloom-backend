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
  "/session/:sessionId/history",
  protectCustomerSession({
    allowCompleted: true,
  }),
  getOrderHistoryBySession,
);
router.get(
  "/session/:sessionId",
  protectCustomerSession({
    allowCompleted: true,
  }),
  getOrderBySession,
);
router.get("/:id", optionalAuth, optionalCustomerSession(), getOrder);
router.post("/:id/payment", optionalAuth, optionalCustomerSession(), processPayment);
router.use(protect);
router.put(
  "/:id/status",
  hasAnyPermission("ORDER_UPDATE_STATUS", "KITCHEN_MARK_SERVED"),
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
