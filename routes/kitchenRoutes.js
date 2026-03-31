const express = require("express");
const router = express.Router();
const {
  getOrdersByStation,
  startPreparingItem,
  markItemReady,
  markItemServed,
  getKitchenAnalytics,
  sortKitchenOrders,
  getDelayedOrders,
  checkDelayedOrders,
  getDelayMonitorStatus,
  getOrderDelayAnalysis,
  acknowledgeDelay,
  getDelayedOrdersByStation,
  getFilteredOrdersByStation,
  getStationStatistics,
} = require("../controllers/kitchenController");
const { protect, hasPermission } = require("../middleware/auth");

router.use(protect);

router.get(
  "/orders/sorted",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  sortKitchenOrders
);

router.get(
  "/stations/:stationId/orders",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getOrdersByStation
);

router.get(
  "/stations/:stationId/filtered-orders",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getFilteredOrdersByStation
);

router.get(
  "/stations/:stationId/delayed-orders",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getDelayedOrdersByStation
);

router.get(
  "/stations/:stationId/statistics",
  hasPermission("VIEW_STATISTICS"),
  getStationStatistics
);

router.put(
  "/orders/:kitchenOrderId/items/:itemId/start",
  hasPermission("KITCHEN_START_PREPARING"),
  startPreparingItem
);

router.put(
  "/orders/:kitchenOrderId/items/:itemId/ready",
  hasPermission("KITCHEN_MARK_READY"),
  markItemReady
);

router.put(
  "/orders/:kitchenOrderId/items/:itemId/served",
  hasPermission("KITCHEN_MARK_SERVED"),
  markItemServed
);

router.get("/analytics", hasPermission("VIEW_STATISTICS"), getKitchenAnalytics);

router.get(
  "/stations/:stationId/orders/sorted",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  async (req, res) => {
    req.query.stationId = req.params.stationId;
    await sortKitchenOrders(req, res);
  }
);

router.get("/delayed", hasPermission("KITCHEN_VIEW_DASHBOARD"), getDelayedOrders);

router.get(
  "/delay-monitor/status",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getDelayMonitorStatus
);

router.post(
  "/check-delayed",
  hasPermission("VIEW_STATISTICS"),
  checkDelayedOrders
);

router.get(
  "/orders/:orderId/delay-analysis",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getOrderDelayAnalysis
);

router.post(
  "/orders/:orderId/acknowledge-delay",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  acknowledgeDelay
);

module.exports = router;
