const { logger } = require("./../utils/logger.js");
const kitchenManager = require("../utils/kitchenManager");
const KitchenOrder = require("../models/KitchenOrder");
const KitchenStation = require("../models/KitchenStation");
const mongoose = require("mongoose");
const delayMonitor = require("../utils/delayMonitor");


exports.startPreparingItem = async (req, res) => {
  try {
    const { kitchenOrderId, itemId } = req.params;

    const kitchenOrder = await kitchenManager.startPreparingItem(
      kitchenOrderId,
      itemId
    );

   res.status(200).json({
      success: true,
      message: "Item preparation started",
      data: kitchenOrder,
    });
  } catch (error) {
    logger.error(error);

    if (
      error.message.includes("Kitchen order not found") ||
      error.message.includes("Order item not found")
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to start preparing item",
      error: error.message,
    });
  }
};

exports.markItemReady = async (req, res) => {
  try {
    const { kitchenOrderId, itemId } = req.params;

    const kitchenOrder = await kitchenManager.markItemReady(
      kitchenOrderId,
      itemId
    );

   res.status(200).json({
      success: true,
      message: "Item marked as ready",
      data: kitchenOrder,
    });
  } catch (error) {
    logger.error(error);

    if (
      error.message.includes("Kitchen order not found") ||
      error.message.includes("Order item not found")
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to mark item as ready",
      error: error.message,
    });
  }
};

exports.markItemServed = async (req, res) => {
  try {
    const { kitchenOrderId, itemId } = req.params;

    const kitchenOrder = await kitchenManager.markItemServed(
      kitchenOrderId,
      itemId
    );

   res.status(200).json({
      success: true,
      message: "Item marked as served",
      data: kitchenOrder,
    });
  } catch (error) {
    logger.error(error);

    if (
      error.message.includes("Kitchen order not found") ||
      error.message.includes("Order item not found")
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to mark item as served",
      error: error.message,
    });
  }
};

exports.getKitchenAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, sortBy = "preparationTime" } = req.query; 

    const today = new Date();
    const defaultStartDate = new Date(today.setDate(today.getDate() - 7)); 
    const defaultEndDate = new Date();

    const analytics = await KitchenOrder.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate ? new Date(startDate) : defaultStartDate,
            $lte: endDate ? new Date(endDate) : defaultEndDate,
          },
          overallStatus: "completed",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalOrders: { $sum: 1 },
          avgPreparationTime: { $avg: "$timeMetrics.preparationTime" },
          avgTotalTime: { $avg: "$timeMetrics.totalTime" },
          onTimeRate: {
            $avg: {
              $cond: [
                { $lte: ["$timeMetrics.preparationTime", 1800] }, 
                1,
                0,
              ],
            },
          },

          minPrepTime: { $min: "$timeMetrics.preparationTime" },
          maxPrepTime: { $max: "$timeMetrics.preparationTime" },
          medianPrepTime: { $avg: "$timeMetrics.preparationTime" },
        },
      },

      {
        $sort:
          sortBy === "avgPreparationTime"
            ? { avgPreparationTime: 1 }
            : { _id: 1 },
      },
    ]);

    const overallStats = {
      totalOrders: analytics.reduce((sum, day) => sum + day.totalOrders, 0),
      avgPreparationTime:
        analytics.length > 0
          ? analytics.reduce((sum, day) => sum + day.avgPreparationTime, 0) /
            analytics.length
          : 0,
      avgTotalTime:
        analytics.length > 0
          ? analytics.reduce((sum, day) => sum + day.avgTotalTime, 0) /
            analytics.length
          : 0,
      overallOnTimeRate:
        analytics.length > 0
          ? analytics.reduce((sum, day) => sum + day.onTimeRate, 0) /
            analytics.length
          : 0,
      quickestDay:
        analytics.length > 0
          ? analytics.reduce(
              (min, day) =>
                day.avgPreparationTime < min.avgPreparationTime ? day : min,
              analytics[0]
            )
          : null,
      busiestDay:
        analytics.length > 0
          ? analytics.reduce(
              (max, day) => (day.totalOrders > max.totalOrders ? day : max),
              analytics[0]
            )
          : null,
    };

   res.status(200).json({
      success: true,
      data: {
        dailyAnalytics: analytics,
        overallStats,
        dateRange: {
          startDate: startDate || defaultStartDate.toISOString().split("T")[0],
          endDate: endDate || defaultEndDate.toISOString().split("T")[0],
        },
        sortBy,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get kitchen analytics",
      error: error.message,
    });
  }
};

exports.getSortedKitchenOrders = async (req, res) => {
  try {
    const { sortBy = "preparationTime", stationId } = req.query;

    const sortedOrders = await kitchenManager.getSortedKitchenOrders(
      sortBy,
      stationId
    );

   res.status(200).json({
      success: true,
      count: sortedOrders.length,
      data: sortedOrders,
      sortBy,
      stationId: stationId || "all",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get sorted kitchen orders",
      error: error.message,
    });
  }
};

exports.updateOrderPriority = async (req, res) => {
  try {
    const { kitchenOrderId } = req.params;
    const { priority } = req.body;

    const validPriorities = ["vip", "high", "normal", "low"];

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Valid options: ${validPriorities.join(
          ", "
        )}`,
      });
    }

    const kitchenOrder = await KitchenOrder.findByIdAndUpdate(
      kitchenOrderId,
      { priority },
      { new: true }
    );

    if (!kitchenOrder) {
      return res.status(404).json({
        success: false,
        message: "Kitchen order not found",
      });
    }

    kitchenManager.emitKitchenUpdate("order_priority_updated", kitchenOrder);

   res.status(200).json({
      success: true,
      message: "Order priority updated",
      data: kitchenOrder,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update order priority",
      error: error.message,
    });
  }
};

exports.getKitchenInsights = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const prepTimeInsights = await KitchenOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          overallStatus: "completed",
        },
      },
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: "$items.menuItemName",
          count: { $sum: 1 },
          avgPrepTime: { $avg: "$items.preparationTime" },
          maxPrepTime: { $max: "$items.preparationTime" },
          minPrepTime: { $min: "$items.preparationTime" },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const stationInsights = await KitchenStation.aggregate([
      {
        $lookup: {
          from: "kitchenorders",
          let: { stationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gte: ["$createdAt", startDate] },
                    { $eq: ["$items.station", "$$stationId"] },
                  ],
                },
              },
            },
            {
              $unwind: "$items",
            },
            {
              $match: {
                $expr: { $eq: ["$items.station", "$$stationId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalItems: { $sum: "$items.quantity" },
                avgLoad: {
                  $avg: {
                    $multiply: ["$items.quantity", "$items.preparationTime"],
                  },
                },
              },
            },
          ],
          as: "orderData",
        },
      },
      {
        $project: {
          name: 1,
          stationType: 1,
          totalItems: {
            $ifNull: [{ $arrayElemAt: ["$orderData.totalItems", 0] }, 0],
          },
          averageLoad: {
            $ifNull: [{ $arrayElemAt: ["$orderData.avgLoad", 0] }, 0],
          },
          currentLoad: 1,
          capacity: 1,
          loadPercentage: {
            $multiply: [{ $divide: ["$currentLoad", "$capacity"] }, 100],
          },
        },
      },
      {
        $sort: { loadPercentage: -1 },
      },
    ]);

   res.status(200).json({
      success: true,
      data: {
        preparationTimeInsights: prepTimeInsights,
        stationInsights: stationInsights,
        dateRange: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
          days: parseInt(days),
        },
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get kitchen insights",
      error: error.message,
    });
  }
};

exports.getDelayedOrders = async (req, res) => {
  try {
    const delayedOrders = await kitchenManager.getDelayedOrdersSummary();

   res.status(200).json({
      success: true,
      data: delayedOrders,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get delayed orders",
      error: error.message,
    });
  }
};

exports.checkDelayedOrders = async (req, res) => {
  try {
    const delayedOrders = await delayMonitor.runCheck("manual");

   res.status(200).json({
      success: true,
      message: `Found ${delayedOrders.length} delayed orders`,
      data: delayedOrders,
      timestamp: new Date(),
      meta: {
        delayMonitorStatus: delayMonitor.getStatus(),
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to check delayed orders",
      error: error.message,
    });
  }
};

exports.getDelayMonitorStatus = async (_req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: delayMonitor.getStatus(),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get delay monitor status",
      error: error.message,
    });
  }
};

exports.getOrderDelayAnalysis = async (req, res) => {
  try {
    const { orderId } = req.params;

    const kitchenOrder = await KitchenOrder.findById(orderId)
      .populate("items.station", "name stationType")
      .populate("items.assignedTo", "name");

    if (!kitchenOrder) {
      return res.status(404).json({
        success: false,
        message: "Kitchen order not found",
      });
    }

    const delayAnalysis = kitchenOrder.items.map((item) => {
      const delayStatus = kitchenManager.calculateItemDelayStatus(item);

      return {
        menuItemName: item.menuItemName,
        status: item.status,
        preparationTime: item.preparationTime,
        estimatedCompletion: item.estimatedCompletion,
        startTime: item.startTime,
        delayStatus: delayStatus.status,
        delayColor: delayStatus.color,
        delayMinutes: delayStatus.delayMinutes,
        isDelayed: delayStatus.isDelayed,
        station: item.station?.name || "Unknown",
        assignedTo: item.assignedTo?.name || "Unassigned",
      };
    });

    const overallStatus = {
      hasDelayedItems: delayAnalysis.some((item) => item.isDelayed),
      delayedItemsCount: delayAnalysis.filter((item) => item.isDelayed).length,
      maxDelayMinutes: Math.max(
        ...delayAnalysis.map((item) => item.delayMinutes || 0)
      ),
      averageDelayMinutes:
        delayAnalysis.reduce((sum, item) => sum + (item.delayMinutes || 0), 0) /
        delayAnalysis.length,
      alertLevel: delayAnalysis.some(
        (item) => item.delayStatus === "critical_delay"
      )
        ? "critical"
        : delayAnalysis.some((item) => item.isDelayed)
        ? "warning"
        : "normal",
    };

   res.status(200).json({
      success: true,
      data: {
        orderNumber: kitchenOrder.orderNumber,
        tableNumber: kitchenOrder.tableNumber,
        customerName: kitchenOrder.customerName,
        priority: kitchenOrder.priority,
        overallStatus,
        items: delayAnalysis,
        timers: kitchenOrder.timers,
        createdAt: kitchenOrder.createdAt,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get order delay analysis",
      error: error.message,
    });
  }
};

exports.acknowledgeDelay = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    const staffId = req.user.id;

    const kitchenOrder = await KitchenOrder.findById(orderId);

    if (!kitchenOrder) {
      return res.status(404).json({
        success: false,
        message: "Kitchen order not found",
      });
    }

    kitchenOrder.delayAcknowledged = {
      acknowledgedBy: staffId,
      acknowledgedAt: new Date(),
      notes: notes || "",
      previousDelayStatus: kitchenOrder.delayStatus,
    };

    const hasDelayedItems = kitchenOrder.items.some((item) =>
      ["delayed", "critical_delay"].includes(item.delayStatus)
    );

    kitchenOrder.delayStatus = hasDelayedItems ? "acknowledged" : "on_time";
    await kitchenOrder.save();

    kitchenManager.emitKitchenUpdate("delay_acknowledged", kitchenOrder);

   res.status(200).json({
      success: true,
      message: "Delay acknowledged",
      data: kitchenOrder,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge delay",
      error: error.message,
    });
  }
};


exports.getOrdersByStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { status = "pending", sortBy = "preparationTime" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid station ID format",
      });
    }

  
    const station = await KitchenStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    const orders = await kitchenManager.getOrdersByStation(
      stationId,
      status,
      sortBy
    );

   res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
      station: {
        id: station._id,
        name: station.name,
        stationType: station.stationType,
      },
      status,
      sortBy,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get orders by station",
      error: error.message,
    });
  }
};


exports.getDelayedOrdersByStation = async (req, res) => {
  try {
    const { stationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid station ID format",
      });
    }


    const station = await KitchenStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    const delayedOrders = await kitchenManager.getDelayedOrdersByStation(
      stationId
    );

   res.status(200).json({
      success: true,
      data: delayedOrders,
      stationId,
      stationName: station.name,
      count: delayedOrders.length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get delayed orders by station",
      error: error.message,
    });
  }
};

exports.getFilteredOrdersByStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    const {
      status = "pending",
      sortBy = "preparationTime",
      priority,
      includeDelayed = "false",
    } = req.query;

 
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid station ID format",
      });
    }

 
    const station = await KitchenStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    const orders = await kitchenManager.getOrdersByStation(
      stationId,
      status,
      sortBy
    );

    let filteredOrders = orders;

    if (priority && ["vip", "high", "normal"].includes(priority)) {
      filteredOrders = filteredOrders.filter(
        (order) => order.priority === priority
      );
    }

    if (includeDelayed === "true") {
      filteredOrders = filteredOrders.filter((order) => {
        const stationItems = order.items.filter(
          (item) => item.station && item.station._id.toString() === stationId
        );
        return stationItems.some((item) => {
          const delayStatus = kitchenManager.calculateItemDelayStatus(item);
          return delayStatus.isDelayed;
        });
      });
    }

   res.status(200).json({
      success: true,
      data: {
        station: {
          _id: station._id,
          name: station.name,
          stationType: station.stationType,
          colorCode: station.colorCode,
        },
        orders: filteredOrders,
        filters: {
          status,
          sortBy,
          priority: priority || "all",
          includeDelayed: includeDelayed === "true",
        },
        counts: {
          total: filteredOrders.length,
          vip: filteredOrders.filter((o) => o.priority === "vip").length,
          high: filteredOrders.filter((o) => o.priority === "high").length,
          normal: filteredOrders.filter((o) => o.priority === "normal").length,
        },
      },
      stationId,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get filtered orders by station",
      error: error.message,
    });
  }
};


exports.getStationStatistics = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { days = 7 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid station ID format",
      });
    }

    const station = await KitchenStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const statistics = await KitchenOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          "items.station": station._id,
          overallStatus: "completed",
        },
      },
      {
        $unwind: "$items",
      },
      {
        $match: {
          "items.station": station._id,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          itemsCompleted: { $sum: "$items.quantity" },
          avgPreparationTime: { $avg: "$items.preparationTime" },
          totalPreparationTime: { $sum: "$items.preparationTime" },
          delayedItems: {
            $sum: {
              $cond: [
                {
                  $gt: [
                    "$items.preparationTime",
                    { $ifNull: ["$items.estimatedTime", 15] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const overallStats = {
      totalItemsCompleted: statistics.reduce(
        (sum, day) => sum + day.itemsCompleted,
        0
      ),
      avgDailyItems:
        statistics.length > 0
          ? statistics.reduce((sum, day) => sum + day.itemsCompleted, 0) /
            statistics.length
          : 0,
      avgPreparationTime:
        statistics.length > 0
          ? statistics.reduce((sum, day) => sum + day.avgPreparationTime, 0) /
            statistics.length
          : 0,
      delayedRate:
        statistics.length > 0
          ? (statistics.reduce((sum, day) => sum + day.delayedItems, 0) /
              statistics.reduce((sum, day) => sum + day.itemsCompleted, 0)) *
            100
          : 0,
      efficiencyScore:
        statistics.length > 0
          ? Math.max(
              0,
              Math.min(
                100,
                100 -
                  (statistics.reduce(
                    (sum, day) => sum + day.avgPreparationTime,
                    0
                  ) /
                    statistics.length /
                    60) *
                    10
              )
            )
          : 0,
    };

   res.status(200).json({
      success: true,
      data: {
        station: {
          _id: station._id,
          name: station.name,
          stationType: station.stationType,
          currentLoad: station.currentLoad,
          capacity: station.capacity,
          loadPercentage: Math.round(
            (station.currentLoad / station.capacity) * 100
          ),
        },
        dailyStatistics: statistics,
        overallStats,
        dateRange: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
          days: parseInt(days),
        },
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get station statistics",
      error: error.message,
    });
  }
};


exports.sortKitchenOrders = async (req, res) => {
  try {
    const { sortBy = "preparationTime", stationId } = req.query;

    const actualStationId = req.params.stationId || stationId;

    const validSortOptions = [
      "preparationTime",
      "estimatedCompletion",
      "priority",
      "createdAt",
      "quantity",
    ];

    if (!validSortOptions.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort option. Valid options: ${validSortOptions.join(
          ", "
        )}`,
      });
    }

    let sortedOrders;
    let stationInfo = null;

    if (actualStationId) {

      if (!mongoose.Types.ObjectId.isValid(actualStationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid station ID format",
        });
      }


      const station = await KitchenStation.findById(actualStationId);
      if (!station) {
        return res.status(404).json({
          success: false,
          message: "Station not found",
        });
      }

      sortedOrders = await kitchenManager.getOrdersByStation(
        actualStationId,
        "pending",
        sortBy
      );

      stationInfo = {
        id: station._id,
        name: station.name,
        stationType: station.stationType,
        currentLoad: station.currentLoad,
        capacity: station.capacity,
      };
    } else {

      sortedOrders = await kitchenManager.getSortedKitchenOrders(sortBy);
    }

    res.status(200).json({
      success: true,
      sortBy,
      station: actualStationId ? stationInfo : "all",
      count: sortedOrders.length,
      data: sortedOrders,
    });
  } catch (error) {
    logger.error("Sort kitchen orders failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sort kitchen orders",
      error: error.message,
    });
  }
};
