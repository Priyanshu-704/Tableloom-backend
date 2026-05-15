const { logger } = require("./logger.js");
const KitchenOrder = require("../models/KitchenOrder");
const KitchenStation = require("../models/KitchenStation");
const Order = require("../models/Order");
const { getIO } = require("./socketManager");
const { kitchenItemStatusColors } = require("../utils/statusColors");
const notificationManager = require("./notificationManager");
const { emitDelayedOrderAlert } = require("./socketManager");
const mongoose = require("mongoose");
const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
];
const KITCHEN_ITEM_ACTIVE_STATUSES = ["accepted", "preparing"];
const isKitchenItemLoadActive = (status) =>
  KITCHEN_ITEM_ACTIVE_STATUSES.includes(status);
const updateStationLoadDelta = (stationLoadDeltas, item, nextStatus) => {
  if (!item?.station) {
    return;
  }
  const previousStatus = String(item.status || "").trim();
  const targetStatus = String(nextStatus || "").trim();
  const wasCounted = isKitchenItemLoadActive(previousStatus);
  const willBeCounted = isKitchenItemLoadActive(targetStatus);
  if (wasCounted === willBeCounted) {
    return;
  }
  const stationId = String(item.station || "").trim();
  if (!stationId) {
    return;
  }
  const quantityDelta = Number(item.quantity || 0) * (willBeCounted ? 1 : -1);
  stationLoadDeltas.set(
    stationId,
    (stationLoadDeltas.get(stationId) || 0) + quantityDelta,
  );
};
const initializeKitchenItemTiming = (item, referenceTime = new Date()) => {
  const preparationTime = Number(item?.preparationTime || 0);
  if (preparationTime > 0) {
    item.estimatedCompletion = new Date(
      referenceTime.getTime() + preparationTime * 60000,
    );
  } else {
    item.estimatedCompletion = null;
  }
  item.delayStatus = "on_time";
  item.delayColor = "#4CAF50";
  item.delayMinutes = 0;
  item.lastDelayCheck = new Date(referenceTime);
  return item;
};
const markKitchenItemAccepted = (item, referenceTime = new Date()) => {
  item.status = "accepted";
  item.colorCode = kitchenItemStatusColors.accepted;
  initializeKitchenItemTiming(item, referenceTime);
  return item;
};
const markKitchenItemPreparing = (item, referenceTime = new Date()) => {
  item.status = "preparing";
  item.colorCode = kitchenItemStatusColors.preparing;
  item.startTime = new Date(referenceTime);
  item.timer = 0;
  initializeKitchenItemTiming(item, referenceTime);
  return item;
};
const buildStationAssignmentsFromItems = (items = []) => {
  const stationItemsMap = new Map();
  items.forEach((item) => {
    if (!item?.station) {
      return;
    }
    const stationId = item.station._id?.toString() || item.station.toString();
    if (!stationId) {
      return;
    }
    if (!stationItemsMap.has(stationId)) {
      stationItemsMap.set(stationId, {
        station: item.station._id || item.station,
        items: [],
        stationName: item.station?.name || item.stationName || "Station",
        stationType: item.station?.stationType || "",
      });
    }
    stationItemsMap.get(stationId).items.push(item._id);
  });
  return Array.from(stationItemsMap.values());
};
const emitActivatedKitchenOrder = async (kitchenOrder) => {
  const stationAssignments = buildStationAssignmentsFromItems(
    kitchenOrder?.items || [],
  );
  const orderData = {
    _id: kitchenOrder?._id,
    orderNumber: kitchenOrder?.orderNumber,
    tableNumber: kitchenOrder?.tableNumber,
    customerName: kitchenOrder?.customerName,
    priority: kitchenOrder?.priority,
    orderType: kitchenOrder?.orderType,
  };
  const io = getIO();
  io.to("kitchen-room").emit("new_order", kitchenOrder);
  await exports.emitStationUpdates();
  if (stationAssignments.length > 0) {
    logger.info("Creating kitchen order notification...");
    await notificationManager.createKitchenOrderNotification(
      orderData,
      stationAssignments,
    );
    logger.info("Kitchen order notification created successfully");
  }
};
const deriveOrderStatusFromKitchenItems = (items = []) => {
  const activeItems = items.filter((item) => item?.status !== "cancelled");
  if (activeItems.length === 0) {
    return null;
  }
  if (activeItems.every((item) => item.status === "served")) {
    return "served";
  }
  if (activeItems.every((item) => ["ready", "served"].includes(item.status))) {
    return "ready";
  }
  if (
    activeItems.some((item) =>
      ["preparing", "ready", "served"].includes(item.status),
    )
  ) {
    return "preparing";
  }
  return null;
};
exports.syncKitchenOrderFromParentStatus = async (orderId, nextStatus) => {
  if (!orderId || !nextStatus) {
    return null;
  }

  const kitchenOrder = await KitchenOrder.findOne({
    order: orderId,
  });
  if (!kitchenOrder) {
    return null;
  }

  const stationLoadDeltas = new Map();
  let shouldNotifyKitchenActivation = false;

  if (nextStatus === "confirmed") {
    const acceptanceTime = new Date();
    kitchenOrder.items.forEach((item) => {
      if (item.status === "pending") {
        updateStationLoadDelta(stationLoadDeltas, item, "accepted");
        markKitchenItemAccepted(item, acceptanceTime);
        shouldNotifyKitchenActivation = true;
      }
    });
    if (shouldNotifyKitchenActivation) {
      kitchenOrder.timers.kitchenAccepted =
        kitchenOrder.timers.kitchenAccepted || acceptanceTime;
      kitchenOrder.timeMetrics.acceptTime = Math.floor(
        (kitchenOrder.timers.kitchenAccepted - kitchenOrder.timers.orderReceived) /
          1000,
      );
    }
  } else if (nextStatus === "preparing") {
    const preparationStartTime = new Date();
    kitchenOrder.items.forEach((item) => {
      if (["pending", "accepted"].includes(item.status)) {
        updateStationLoadDelta(stationLoadDeltas, item, "preparing");
        markKitchenItemPreparing(item, preparationStartTime);
      }
    });
    kitchenOrder.timers.kitchenAccepted =
      kitchenOrder.timers.kitchenAccepted || preparationStartTime;
    kitchenOrder.timers.startedCooking =
      kitchenOrder.timers.startedCooking || preparationStartTime;
  } else if (nextStatus === "ready") {
    kitchenOrder.items.forEach((item) => {
      if (!["served", "cancelled"].includes(item.status)) {
        updateStationLoadDelta(stationLoadDeltas, item, "ready");
        item.status = "ready";
        item.colorCode = kitchenItemStatusColors.ready;
        item.readyTime = item.readyTime || new Date();
      }
    });
    kitchenOrder.timers.completedCooking =
      kitchenOrder.timers.completedCooking || new Date();
  } else if (nextStatus === "served" || nextStatus === "completed") {
    kitchenOrder.items.forEach((item) => {
      if (item.status !== "cancelled") {
        updateStationLoadDelta(stationLoadDeltas, item, "served");
        item.status = "served";
        item.colorCode = kitchenItemStatusColors.served;
        item.readyTime = item.readyTime || new Date();
      }
    });
    kitchenOrder.timers.completedCooking =
      kitchenOrder.timers.completedCooking || new Date();
    kitchenOrder.timers.served = kitchenOrder.timers.served || new Date();
  } else if (nextStatus === "cancelled") {
    kitchenOrder.items.forEach((item) => {
      if (!["served", "cancelled"].includes(item.status)) {
        updateStationLoadDelta(stationLoadDeltas, item, "cancelled");
        item.status = "cancelled";
        item.colorCode = kitchenItemStatusColors.cancelled;
      }
    });
    kitchenOrder.overallStatus = "cancelled";
    kitchenOrder.isActive = false;
  }

  await kitchenOrder.save();

  if (stationLoadDeltas.size > 0) {
    await Promise.all(
      Array.from(stationLoadDeltas.entries()).map(([stationId, delta]) =>
        delta === 0
          ? Promise.resolve(null)
          : KitchenStation.findByIdAndUpdate(stationId, {
              $inc: {
                currentLoad: delta,
              },
            }),
      ),
    );
  }

  if (shouldNotifyKitchenActivation) {
    await emitActivatedKitchenOrder(kitchenOrder);
  } else if (stationLoadDeltas.size > 0) {
    await exports.emitStationUpdates();
  }

  return kitchenOrder;
};
const syncParentOrderStatusFromKitchenOrder = async (kitchenOrder) => {
  const targetStatus = deriveOrderStatusFromKitchenItems(
    kitchenOrder?.items || [],
  );
  const orderId =
    kitchenOrder?.order?._id || kitchenOrder?.order || kitchenOrder?._id;
  if (!targetStatus || !orderId) {
    return;
  }
  const order = await Order.findById(orderId).select("status").lean();
  if (!order || ["completed", "cancelled"].includes(order.status)) {
    return;
  }
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const targetIndex = ORDER_STATUS_FLOW.indexOf(targetStatus);
  if (
    currentIndex === -1 ||
    targetIndex === -1 ||
    currentIndex >= targetIndex
  ) {
    return;
  }
  const orderManager = require("./orderManager");
  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    await orderManager.updateOrderStatus(
      orderId,
      ORDER_STATUS_FLOW[index],
      null,
      "Synced from kitchen workflow",
    );
  }
};
exports.createKitchenOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate({
        path: "customer",
        select: "name",
      })
      .populate({
        path: "table",
        select: "tableNumber",
      })
      .populate({
        path: "items.menuItem",
        select: "name preparationTime allergens station",
        populate: {
          path: "station",
          select: "name stationType colorCode",
        },
      });
    if (!order) {
      throw new Error("Order not found");
    }
    const existingKitchenOrder = await KitchenOrder.findOne({
      order: orderId,
    });
    if (existingKitchenOrder) {
      return existingKitchenOrder;
    }
    const isKitchenActionable = !["pending", "cancelled"].includes(
      order.status,
    );
    const stationLoadUpdates = new Map();
    const activationTime = new Date();
    const kitchenItems = await Promise.all(
      order.items.map(async (item) => {
        const menuItem = item.menuItem;
        const preparationTime = menuItem.preparationTime || 15;
        if (!menuItem.station || !menuItem.station._id) {
          throw new Error(`Invalid station for menu item: ${menuItem.name}`);
        }
        const kitchenItem = {
          menuItem: menuItem._id,
          menuItemName: menuItem.name,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || "",
          station: menuItem.station._id,
          stationName: menuItem.station.name,
          allergens: menuItem.allergens || [],
          status: isKitchenActionable ? "accepted" : "pending",
          colorCode: isKitchenActionable
            ? kitchenItemStatusColors.accepted
            : kitchenItemStatusColors.pending,
          preparationTime: preparationTime,
          estimatedCompletion: null,
          delayStatus: "on_time",
          delayColor: "#4CAF50",
          delayMinutes: 0,
          lastDelayCheck: new Date(),
        };
        if (isKitchenActionable) {
          markKitchenItemAccepted(kitchenItem, activationTime);
          const stationId =
            menuItem.station._id.toString() || menuItem.station.toString();
          const currentLoad = stationLoadUpdates.get(stationId) || 0;
          stationLoadUpdates.set(stationId, currentLoad + item.quantity);
        }
        return kitchenItem;
      }),
    );
    const stationUpdatePromises = Array.from(stationLoadUpdates.entries()).map(
      ([stationId, loadIncrease]) => {
        return KitchenStation.findByIdAndUpdate(
          stationId,
          {
            $inc: {
              currentLoad: loadIncrease,
            },
          },
          {
            new: true,
          },
        );
      },
    );
    await Promise.all(stationUpdatePromises);
    const kitchenOrder = await KitchenOrder.create({
      _id: orderId,
      order: orderId,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.tableNumber || "N/A",
      customerName: order.customer?.name || "Customer",
      orderType: order.orderType,
      items: kitchenItems,
      priority: this.calculateOrderPriority(order),
      timers: {
        orderReceived: new Date(),
        kitchenAccepted: isKitchenActionable ? activationTime : undefined,
      },
      timeMetrics: {
        acceptTime: isKitchenActionable ? 0 : null,
        preparationTime: 0,
        totalTime: 0,
      },
      overallStatus: isKitchenActionable ? "in_progress" : "pending",
    });
    await kitchenOrder.populate({
      path: "items.station",
      select: "name stationType colorCode currentLoad capacity",
    });
    const stationAssignments = buildStationAssignmentsFromItems(
      kitchenOrder.items,
    );
    kitchenOrder.stationAssignments = stationAssignments;
    await kitchenOrder.save();
    logger.info(
      `KitchenOrder created successfully for Order #${order.orderNumber}`,
    );
    logger.info(`Items assigned to stations:`, stationAssignments);
    if (isKitchenActionable) {
      await emitActivatedKitchenOrder(kitchenOrder);
    }
    return kitchenOrder;
  } catch (error) {
    logger.error("Create kitchen order failed:", error);
    throw error;
  }
};
exports.calculateOrderPriority = (order) => {
  let priority = "normal";
  if (order.customer?.loyaltyTier === "vip") {
    priority = "vip";
  }
  if (order.items.length > 5) {
    priority = "high";
  }
  if (order.orderType === "delivery") {
    priority = "high";
  }
  return priority;
};
exports.getColorCodeByAllergens = (allergens) => {
  if (!allergens || allergens.length === 0) return "#4CAF50";
  const allergenColors = {
    nuts: "#FF9800",
    dairy: "#2196F3",
    gluten: "#9C27B0",
    seafood: "#00BCD4",
    eggs: "#FFEB3B",
    soy: "#795548",
  };
  for (const allergen of allergens) {
    if (allergenColors[allergen.toLowerCase()]) {
      return allergenColors[allergen.toLowerCase()];
    }
  }
  return "#F44336";
};
exports.assignToStations = async (kitchenOrderId) => {
  try {
    const kitchenOrder = await KitchenOrder.findById(kitchenOrderId).populate(
      "items.station",
      "name stationType currentLoad capacity",
    );
    if (!kitchenOrder) {
      throw new Error("Kitchen order not found");
    }
    const stationAssignments = [];
    for (const item of kitchenOrder.items) {
      if (item.station) {
        await KitchenStation.findByIdAndUpdate(item.station._id, {
          $inc: {
            currentLoad: item.quantity,
          },
        });
        let stationAssignment = stationAssignments.find(
          (sa) => sa.station.toString() === item.station._id.toString(),
        );
        if (!stationAssignment) {
          stationAssignment = {
            station: item.station._id,
            items: [],
            status: "pending",
          };
          stationAssignments.push(stationAssignment);
        }
        stationAssignment.items.push(item._id);
      }
    }
    kitchenOrder.stationAssignments = stationAssignments;
    await kitchenOrder.save();
    this.emitStationUpdates();
    return kitchenOrder;
  } catch (error) {
    logger.error("Assign to stations failed:", error);
    throw error;
  }
};
exports.markItemReady = async (kitchenOrderId, itemId) => {
  try {
    const kitchenOrder = await KitchenOrder.findById(kitchenOrderId);
    if (!kitchenOrder) {
      throw new Error("Kitchen order not found");
    }
    const item = kitchenOrder.items.id(itemId);
    if (!item) {
      throw new Error("Order item not found");
    }
    if (item.status !== "preparing") {
      throw new Error("Only preparing kitchen items can be marked ready");
    }
    item.status = "ready";
    item.colorCode = kitchenItemStatusColors.ready;
    item.readyTime = new Date();
    const allItemsReady = kitchenOrder.items.every((currentItem) =>
      currentItem._id.equals(item._id)
        ? true
        : ["ready", "served"].includes(currentItem.status),
    );
    if (allItemsReady && !kitchenOrder.timers.completedCooking) {
      kitchenOrder.timers.completedCooking = new Date();
      kitchenOrder.timeMetrics.preparationTime = Math.floor(
        (kitchenOrder.timers.completedCooking -
          kitchenOrder.timers.kitchenAccepted) /
          1000,
      );
    }
    await Promise.all([
      kitchenOrder.save(),
      item.station
        ? KitchenStation.findByIdAndUpdate(item.station, {
            $inc: {
              currentLoad: -item.quantity,
            },
          })
        : Promise.resolve(null),
    ]);
    await syncParentOrderStatusFromKitchenOrder(kitchenOrder);
    this.emitKitchenUpdate("item_ready", kitchenOrder);
    notificationManager
      .createOrderReadyNotification(
        {
          _id: kitchenOrder._id,
          orderNumber: kitchenOrder.orderNumber,
          tableNumber: kitchenOrder.tableNumber,
          kitchenStaff: item.assignedTo || null,
          assignedWaiter: kitchenOrder.assignedWaiter || null,
        },
        {
          _id: item._id,
          menuItemName: item.menuItemName,
          quantity: item.quantity,
          station: item.station,
          readyTime: item.readyTime,
        },
      )
      .catch((notifError) => {
        logger.error("Failed to create order ready notification:", notifError);
      });
    this.emitExpediterNotification(kitchenOrder, item);
    return kitchenOrder;
  } catch (error) {
    logger.error("Mark item ready failed:", error);
    throw error;
  }
};
exports.markItemServed = async (kitchenOrderId, itemId) => {
  try {
    const kitchenOrder = await KitchenOrder.findById(kitchenOrderId);
    if (!kitchenOrder) {
      throw new Error("Kitchen order not found");
    }
    const item = kitchenOrder.items.id(itemId);
    if (!item) {
      throw new Error("Order item not found");
    }
    if (item.status !== "ready") {
      throw new Error("Only ready kitchen items can be marked served");
    }
    item.status = "served";
    item.colorCode = kitchenItemStatusColors.served;
    if (!kitchenOrder.timers.served) {
      kitchenOrder.timers.served = new Date();
      kitchenOrder.timeMetrics.totalTime = Math.floor(
        (kitchenOrder.timers.served - kitchenOrder.timers.orderReceived) / 1000,
      );
    }
    await kitchenOrder.save();
    await syncParentOrderStatusFromKitchenOrder(kitchenOrder);
    this.emitKitchenUpdate("item_served", kitchenOrder);
    return kitchenOrder;
  } catch (error) {
    logger.error("Mark item served failed:", error);
    throw error;
  }
};
exports.getKitchenDashboard = async (sortBy = "preparationTime") => {
  try {
    const [
      pendingOrders,
      inProgressOrders,
      readyOrders,
      stations,
      todayStats,
      sortedPendingOrders,
    ] = await Promise.all([
      KitchenOrder.countDocuments({
        overallStatus: "pending",
      }),
      KitchenOrder.countDocuments({
        overallStatus: "in_progress",
      }),
      KitchenOrder.countDocuments({
        overallStatus: "ready",
      }),
      KitchenStation.find({
        isActive: true,
      })
        .populate("assignedStaff.staff", "name")
        .sort({
          displayOrder: 1,
        }),
      this.getTodaysPerformance(),
      this.getSortedKitchenOrders(sortBy),
    ]);
    return {
      summary: {
        pending: pendingOrders,
        inProgress: inProgressOrders,
        ready: readyOrders,
        totalActive: pendingOrders + inProgressOrders + readyOrders,
      },
      stations,
      todayStats,
      sortedOrders: sortedPendingOrders,
      sortBy: sortBy,
    };
  } catch (error) {
    logger.error("Get kitchen dashboard failed:", error);
    throw error;
  }
};
exports.getTodaysPerformance = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stats = await KitchenOrder.aggregate([
      {
        $match: {
          createdAt: {
            $gte: today,
          },
          overallStatus: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: {
            $sum: 1,
          },
          avgPreparationTime: {
            $avg: "$timeMetrics.preparationTime",
          },
          avgTotalTime: {
            $avg: "$timeMetrics.totalTime",
          },
          onTimeOrders: {
            $sum: {
              $cond: [
                {
                  $lte: ["$timeMetrics.preparationTime", 1800],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const result = stats[0] || {
      totalOrders: 0,
      avgPreparationTime: 0,
      avgTotalTime: 0,
      onTimeOrders: 0,
    };
    result.onTimeRate =
      result.totalOrders > 0
        ? (result.onTimeOrders / result.totalOrders) * 100
        : 0;
    return result;
  } catch (error) {
    logger.error("Get today performance failed:", error);
    throw error;
  }
};
exports.emitKitchenUpdate = (event, data) => {
  const io = getIO();
  io.to("kitchen-room").emit(event, data);
};
exports.emitStationUpdates = async () => {
  const stations = await KitchenStation.find({
    isActive: true,
  });
  const io = getIO();
  io.to("kitchen-room").emit("stations_updated", stations);
};
exports.emitExpediterNotification = (kitchenOrder, item) => {
  const io = getIO();
  io.to("expediter-room").emit("item_ready_for_pickup", {
    orderNumber: kitchenOrder.orderNumber,
    tableNumber: kitchenOrder.tableNumber,
    itemName: item.menuItemName,
    quantity: item.quantity,
    readyTime: item.readyTime,
  });
};
exports.calculateItemDelayStatus = (item, options = {}) => {
  const preparationTime = Number(item?.preparationTime || 0);
  const resolvedEstimatedCompletion = item?.estimatedCompletion
    ? new Date(item.estimatedCompletion)
    : item?.startTime && preparationTime > 0
      ? new Date(new Date(item.startTime).getTime() + preparationTime * 60000)
      : null;
  if (
    !resolvedEstimatedCompletion ||
    Number.isNaN(resolvedEstimatedCompletion.getTime())
  ) {
    return {
      status: "on_time",
      color: "#4CAF50",
      delayMinutes: 0,
      isDelayed: false,
    };
  }
  const now = new Date();
  const delayMinutes = Math.floor((now - resolvedEstimatedCompletion) / 60000);
  const { delayThresholds } = require("../utils/statusColors");
  const criticalThresholdMinutes = Math.max(
    1,
    Number(
      options?.criticalThresholdMinutes || delayThresholds.critical_delay || 15,
    ),
  );
  const timeRemaining = Math.floor((resolvedEstimatedCompletion - now) / 60000);
  if (timeRemaining <= 0) {
    if (delayMinutes >= criticalThresholdMinutes) {
      return {
        status: "critical_delay",
        color: "#D32F2F",
        delayMinutes: delayMinutes,
        isDelayed: true,
        severity: "critical",
      };
    } else {
      return {
        status: "delayed",
        color: "#F44336",
        delayMinutes: delayMinutes,
        isDelayed: true,
        severity: "high",
      };
    }
  } else if (timeRemaining <= delayThresholds.approaching_delay) {
    return {
      status: "approaching_delay",
      color: "#FF9800",
      delayMinutes: timeRemaining,
      isDelayed: false,
      severity: "warning",
    };
  } else {
    return {
      status: "on_time",
      color: "#4CAF50",
      delayMinutes: timeRemaining,
      isDelayed: false,
      severity: "none",
    };
  }
};
exports.checkDelayedOrders = async (options = {}) => {
  try {
    const criticalThresholdMinutes = Math.max(
      1,
      Number(options?.criticalThresholdMinutes || 15),
    );
    const notificationIntervalMinutes = Math.max(
      1,
      Number(options?.notificationIntervalMinutes || 5),
    );
    const notifyOnDelay = options?.notifyOnDelay !== false;
    const delayedOrders = [];
    const kitchenOrders = await KitchenOrder.find({
      overallStatus: {
        $in: ["pending", "in_progress"],
      },
      items: {
        $elemMatch: {
          status: {
            $nin: ["ready", "served", "cancelled"],
          },
        },
      },
    }).populate("items.station", "name");
    for (const order of kitchenOrders) {
      let orderHasDelayedItems = false;
      let maxDelayMinutes = 0;
      let delayedItems = [];
      for (const item of order.items) {
        if (["ready", "served", "cancelled"].includes(item.status)) {
          continue;
        }
        const delayStatus = this.calculateItemDelayStatus(item, {
          criticalThresholdMinutes,
        });
        if (delayStatus.isDelayed) {
          orderHasDelayedItems = true;
          maxDelayMinutes = Math.max(maxDelayMinutes, delayStatus.delayMinutes);
          delayedItems.push({
            menuItemName: item.menuItemName,
            station: item.station?.name || "Unknown",
            delayMinutes: delayStatus.delayMinutes,
            status: delayStatus.status,
            color: delayStatus.color,
            estimatedCompletion: item.estimatedCompletion,
          });
          item.delayStatus = delayStatus.status;
          item.delayColor = delayStatus.color;
          item.delayMinutes = delayStatus.delayMinutes;
          item.lastDelayCheck = new Date();
        }
      }
      if (orderHasDelayedItems) {
        await order.save();
        delayedOrders.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          customerName: order.customerName,
          maxDelayMinutes,
          delayedItems,
          priority: order.priority,
          timers: order.timers,
        });
        if (notifyOnDelay) {
          try {
            await notificationManager.createDelayedOrderNotification(
              {
                _id: order._id,
                tenantId: order.tenantId,
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber,
                customerName: order.customerName,
                priority: order.priority,
                createdAt: order.createdAt,
              },
              maxDelayMinutes,
              delayedItems,
              {
                criticalThresholdMinutes,
                notificationIntervalMinutes,
              },
            );
          } catch (notifError) {
            logger.error(
              "Failed to create delayed order notification:",
              notifError,
            );
          }
        }
        emitDelayedOrderAlert(order, maxDelayMinutes, delayedItems);
      }
    }
    return delayedOrders;
  } catch (error) {
    logger.error("Check delayed orders failed:", error);
    throw error;
  }
};
exports.getDelayedOrdersSummary = async (options = {}) => {
  try {
    const criticalThresholdMinutes = Math.max(
      1,
      Number(options?.criticalThresholdMinutes || 15),
    );
    const delayedOrders = await this.checkDelayedOrders({
      notifyOnDelay: false,
      criticalThresholdMinutes,
    });
    const summary = {
      totalDelayed: delayedOrders.length,
      criticalDelays: delayedOrders.filter(
        (order) => order.maxDelayMinutes >= criticalThresholdMinutes,
      ).length,
      warningDelays: delayedOrders.filter(
        (order) =>
          order.maxDelayMinutes > 0 &&
          order.maxDelayMinutes < criticalThresholdMinutes,
      ).length,
      orders: delayedOrders.map((order) => ({
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        maxDelayMinutes: order.maxDelayMinutes,
        itemCount: order.delayedItems.length,
        priority: order.priority,
        alertLevel:
          order.maxDelayMinutes >= criticalThresholdMinutes
            ? "critical"
            : "warning",
      })),
      updatedAt: new Date(),
      criticalThresholdMinutes,
    };
    return summary;
  } catch (error) {
    logger.error("Get delayed orders summary failed:", error);
    throw error;
  }
};
exports.updateItemWithDelayTracking = (item, preparationTime) => {
  item.preparationTime = preparationTime;
  return initializeKitchenItemTiming(item, new Date());
};
exports.startPreparingItem = async (kitchenOrderId, itemId) => {
  try {
    const kitchenOrder = await KitchenOrder.findById(kitchenOrderId);
    if (!kitchenOrder) {
      throw new Error("Kitchen order not found");
    }
    const item = kitchenOrder.items.id(itemId);
    if (!item) {
      throw new Error("Order item not found");
    }
    if (item.status !== "accepted") {
      throw new Error("Only accepted kitchen items can be started");
    }
    markKitchenItemPreparing(item, new Date());
    await kitchenOrder.save();
    await syncParentOrderStatusFromKitchenOrder(kitchenOrder);
    this.emitKitchenUpdate("item_preparing", kitchenOrder);
    return kitchenOrder;
  } catch (error) {
    logger.error("Start preparing item failed:", error);
    throw error;
  }
};
exports.getOrdersByStation = async (
  stationId,
  status = "pending",
  sortBy = "preparationTime",
) => {
  try {
    const orders = await KitchenOrder.find({
      "items.station": stationId,
      "items.status": status,
      overallStatus: {
        $ne: "completed",
      },
    })
      .populate("items.station", "name stationType")
      .populate("items.assignedTo", "name")
      .lean();
    const ordersWithDelay = orders.map((order) => {
      const stationItems = order.items.filter(
        (item) =>
          item.station &&
          item.station._id.toString() === stationId &&
          item.status === status,
      );
      const itemsWithDelay = stationItems.map((item) => {
        const delayStatus = this.calculateItemDelayStatus(item);
        return {
          ...item,
          delayStatus: delayStatus.status,
          delayColor: delayStatus.color,
          delayMinutes: delayStatus.delayMinutes,
          isDelayed: delayStatus.isDelayed,
        };
      });
      const maxDelay = Math.max(
        ...itemsWithDelay.map((item) => item.delayMinutes || 0),
      );
      const hasCriticalDelay = itemsWithDelay.some(
        (item) => item.delayStatus === "critical_delay",
      );
      const hasDelayedItems = itemsWithDelay.some((item) => item.isDelayed);
      return {
        ...order,
        stationItems: itemsWithDelay,
        maxDelay,
        hasCriticalDelay,
        hasDelayedItems,
        alertLevel: hasCriticalDelay
          ? "critical"
          : hasDelayedItems
            ? "warning"
            : "normal",
      };
    });
    const sortedOrders = ordersWithDelay.sort((a, b) => {
      const alertLevelOrder = {
        critical: 0,
        warning: 1,
        normal: 2,
      };
      if (alertLevelOrder[a.alertLevel] !== alertLevelOrder[b.alertLevel]) {
        return alertLevelOrder[a.alertLevel] - alertLevelOrder[b.alertLevel];
      }
      if (a.maxDelay !== b.maxDelay) {
        return b.maxDelay - a.maxDelay;
      }
      const aStationItems = a.stationItems;
      const bStationItems = b.stationItems;
      if (aStationItems.length === 0 || bStationItems.length === 0) return 0;
      switch (sortBy) {
        case "preparationTime": {
          const aAvgTime =
            aStationItems.reduce(
              (sum, item) => sum + (item.preparationTime || 15),
              0,
            ) / aStationItems.length;
          const bAvgTime =
            bStationItems.reduce(
              (sum, item) => sum + (item.preparationTime || 15),
              0,
            ) / bStationItems.length;
          return aAvgTime - bAvgTime;
        }
        case "estimatedCompletion": {
          const aEarliest = new Date(
            Math.min(
              ...aStationItems
                .filter((item) => item.estimatedCompletion)
                .map((item) => new Date(item.estimatedCompletion).getTime()),
            ),
          );
          const bEarliest = new Date(
            Math.min(
              ...bStationItems
                .filter((item) => item.estimatedCompletion)
                .map((item) => new Date(item.estimatedCompletion).getTime()),
            ),
          );
          return aEarliest - bEarliest;
        }
        case "createdAt":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "quantity": {
          const aQuantity = aStationItems.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0,
          );
          const bQuantity = bStationItems.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0,
          );
          return bQuantity - aQuantity;
        }
        case "priority":
        default: {
          const priorityOrder = {
            vip: 0,
            high: 1,
            normal: 2,
          };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return new Date(a.createdAt) - new Date(b.createdAt);
        }
      }
    });
    return sortedOrders;
  } catch (error) {
    logger.error("Get orders by station failed:", error);
    throw error;
  }
};
exports.getSortedKitchenOrders = async (sortBy = "preparationTime") => {
  try {
    const query = {
      overallStatus: {
        $ne: "completed",
      },
    };
    const kitchenOrders = await KitchenOrder.find(query)
      .populate("items.station", "name stationType colorCode")
      .populate("items.assignedTo", "name")
      .lean();
    const sortedOrders = kitchenOrders.sort((a, b) => {
      switch (sortBy) {
        case "preparationTime": {
          const aMin = Math.min(...a.items.map((i) => i.preparationTime ?? 15));
          const bMin = Math.min(...b.items.map((i) => i.preparationTime ?? 15));
          return aMin - bMin;
        }
        case "estimatedCompletion": {
          const aTimes = a.items
            .filter((i) => i.estimatedCompletion)
            .map((i) => new Date(i.estimatedCompletion).getTime());
          const bTimes = b.items
            .filter((i) => i.estimatedCompletion)
            .map((i) => new Date(i.estimatedCompletion).getTime());
          if (!aTimes.length && !bTimes.length) return 0;
          if (!aTimes.length) return 1;
          if (!bTimes.length) return -1;
          return Math.min(...aTimes) - Math.min(...bTimes);
        }
        case "priority": {
          const priorityOrder = {
            vip: 0,
            high: 1,
            normal: 2,
          };
          return (
            (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
          );
        }
        case "createdAt":
        default:
          return new Date(a.createdAt) - new Date(b.createdAt);
      }
    });
    return sortedOrders;
  } catch (error) {
    logger.error("Get sorted kitchen orders failed:", error);
    throw error;
  }
};
exports.getDelayedOrdersByStation = async (stationId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      throw new Error("Invalid station ID format");
    }
    const station = await KitchenStation.findById(stationId);
    if (!station) {
      throw new Error("Station not found");
    }
    const orders = await KitchenOrder.find({
      "items.station": stationId,
      "items.status": {
        $in: ["pending", "preparing"],
      },
      overallStatus: {
        $ne: "completed",
      },
    }).populate("items.station", "name");
    const delayedOrders = [];
    for (const order of orders) {
      const stationItems = order.items.filter(
        (item) => item.station && item.station._id.toString() === stationId,
      );
      const delayedItems = [];
      let maxDelayMinutes = 0;
      for (const item of stationItems) {
        const delayStatus = this.calculateItemDelayStatus(item);
        if (delayStatus.isDelayed) {
          delayedItems.push({
            menuItemName: item.menuItemName,
            delayMinutes: delayStatus.delayMinutes,
            status: delayStatus.status,
            color: delayStatus.color,
          });
          maxDelayMinutes = Math.max(maxDelayMinutes, delayStatus.delayMinutes);
        }
      }
      if (delayedItems.length > 0) {
        delayedOrders.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          maxDelayMinutes,
          delayedItems,
          itemCount: delayedItems.length,
          priority: order.priority,
        });
      }
    }
    return delayedOrders;
  } catch (error) {
    logger.error("Get delayed orders by station failed:", error);
    throw error;
  }
};
exports.updateStationItems = async (stationId, updateData) => {
  try {
    const { itemIds, status, staffId } = updateData;
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      throw new Error("Invalid station ID format");
    }
    const station = await KitchenStation.findById(stationId);
    if (!station) {
      throw new Error("Station not found");
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new Error("Item IDs array is required");
    }
    const validItemIds = itemIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );
    if (validItemIds.length === 0) {
      throw new Error("No valid item IDs provided");
    }
    const bulkOperations = [];
    const updatedOrders = new Set();
    const kitchenOrders = await KitchenOrder.find({
      "items._id": {
        $in: validItemIds,
      },
      "items.station": stationId,
    });
    for (const order of kitchenOrders) {
      for (const itemId of validItemIds) {
        const item = order.items.id(itemId);
        if (item && item.station && item.station.toString() === stationId) {
          item.status = status;
          item.colorCode = kitchenItemStatusColors[status] || "#4CAF50";
          if (status === "confirmed" || status === "preparing") {
            item.startTime = new Date();
            if (staffId) item.assignedTo = staffId;
          } else if (status === "ready") {
            item.readyTime = new Date();
            await KitchenStation.findByIdAndUpdate(stationId, {
              $inc: {
                currentLoad: -item.quantity,
              },
            });
          }
          updatedOrders.add(order._id);
        }
      }
      bulkOperations.push({
        updateOne: {
          filter: {
            _id: order._id,
          },
          update: {
            items: order.items,
            updatedAt: new Date(),
          },
        },
      });
    }
    if (bulkOperations.length > 0) {
      await KitchenOrder.bulkWrite(bulkOperations);
      for (const orderId of updatedOrders) {
        const updatedOrder = await KitchenOrder.findById(orderId)
          .populate("items.station", "name")
          .populate("items.assignedTo", "name");
        this.emitKitchenUpdate("items_updated", {
          stationId,
          orderId: updatedOrder._id,
          orderNumber: updatedOrder.orderNumber,
          updatedItems: validItemIds,
          status,
        });
      }
      this.emitStationUpdates();
    }
    return {
      success: true,
      updatedOrders: updatedOrders.size,
      updatedItems: validItemIds.length,
      stationName: station.name,
    };
  } catch (error) {
    logger.error("Update station items failed:", error);
    throw error;
  }
};
exports.validateStationId = async (stationId) => {
  if (!mongoose.Types.ObjectId.isValid(stationId)) {
    return {
      isValid: false,
      error: "Invalid station ID format",
    };
  }
  const station = await KitchenStation.findById(stationId);
  if (!station) {
    return {
      isValid: false,
      error: "Station not found",
    };
  }
  return {
    isValid: true,
    station,
  };
};
