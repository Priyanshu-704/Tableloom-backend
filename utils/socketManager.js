const { logger } = require("./logger.js");
let io;
let cleanupInterval;

const ROOMS = {
  STAFF: "staff-room",
  KITCHEN: "kitchen-room",
  MANAGER: "manager-room",
  MANAGEMENT: "management-room",
  EXPEDITER: "expediter-room",
};

const EVENTS = {
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_UPDATED: "notification:updated",
  NOTIFICATION_BULK_UPDATED: "notification:bulk-updated",
  NOTIFICATION_COUNT: "notification:count",
  NOTIFICATION_SOUND: "notification:sound",
  WAITER_CALL_NEW: "waiter-call:new",
  WAITER_CALL_UPDATED: "waiter-call:updated",
  WAITER_CALL_ACK: "waiter-call:acknowledged",
  WAITER_CALL_COMPLETED: "waiter-call:completed",
  WAITER_CALL_ASSIGNED: "waiter-call:assigned",
  ORDER_NEW: "order:new",
  ORDER_UPDATED: "order:updated",
  ORDER_STATUS_UPDATED: "order:status-updated",
  ORDER_DELAYED: "order:delayed",
};

const safeEmitToRoom = (room, event, payload) => {
  if (!io) return;
  io.to(room).emit(event, payload);
};

const emitWithAliases = (room, canonicalEvent, aliases, payload) => {
  safeEmitToRoom(room, canonicalEvent, payload);
  aliases.forEach((event) => safeEmitToRoom(room, event, payload));
};

const buildUserRoom = (userId) => `user-${userId}`;
const buildRoleRoom = (role) => `role-${role}`;
const buildSessionRoom = (sessionId) => `customer-${sessionId}`;
const buildStationRoom = (stationId) => `station-${stationId}`;

const joinRoom = (socket, room) => {
  if (!room) return;
  socket.join(room);
};

const leaveRoom = (socket, room) => {
  if (!room) return;
  socket.leave(room);
};

const handleNotificationAction = async (socket, data = {}) => {
  try {
    const { notificationId, userId, action } = data;
    if (!notificationId || !userId || !action) {
      socket.emit("notification_action_error", {
        success: false,
        message: "notificationId, userId and action are required",
      });
      return;
    }

    const notificationManager = require("./notificationManager");

    if (action === "mark_read") {
      await notificationManager.markAsRead(notificationId, userId);
    } else if (action === "acknowledge") {
      await notificationManager.markAsAcknowledged(notificationId, userId);
    } else if (action === "dismiss") {
      await notificationManager.dismissNotification(notificationId, userId);
    } else {
      throw new Error("Unsupported notification action");
    }

    socket.emit("notification_action_response", {
      success: true,
      notificationId,
      action,
      timestamp: new Date(),
    });
  } catch (error) {
    socket.emit("notification_action_error", {
      success: false,
      message: error.message || "Failed to update notification",
    });
  }
};

const registerSocketHandlers = (socket) => {
  socket.on("join-user-room", (userId) => joinRoom(socket, buildUserRoom(userId)));
  socket.on("join-role-room", (role) => joinRoom(socket, buildRoleRoom(role)));
  socket.on("join-session-room", (sessionId) => joinRoom(socket, buildSessionRoom(sessionId)));
  socket.on("join-station-room", (stationId) => joinRoom(socket, buildStationRoom(stationId)));

  socket.on("join-staff-room", () => joinRoom(socket, ROOMS.STAFF));
  socket.on("join-kitchen-room", () => joinRoom(socket, ROOMS.KITCHEN));
  socket.on("join-manager-room", () => joinRoom(socket, ROOMS.MANAGER));
  socket.on("join-management-room", () => joinRoom(socket, ROOMS.MANAGEMENT));
  socket.on("join-expediter-room", () => joinRoom(socket, ROOMS.EXPEDITER));

  // Backward compatible room events
  socket.on("join-customer-room", (sessionId) => joinRoom(socket, buildSessionRoom(sessionId)));
  socket.on("join-notifications", (userId) => joinRoom(socket, buildUserRoom(userId)));
  socket.on("join-role-notifications", (role) => joinRoom(socket, buildRoleRoom(role)));
  socket.on("join-staff-notifications", () => joinRoom(socket, ROOMS.STAFF));
  socket.on("subscribe-notifications", (userId) => joinRoom(socket, buildUserRoom(userId)));
  socket.on("unsubscribe-notifications", (userId) => leaveRoom(socket, buildUserRoom(userId)));
  socket.on("subscribe-staff-notifications", () => joinRoom(socket, ROOMS.STAFF));
  socket.on("subscribe-kitchen-notifications", () => joinRoom(socket, ROOMS.KITCHEN));

  socket.on("notification_action", (data) => handleNotificationAction(socket, data));

  socket.on("update-item-timer", (data) => {
    emitWithAliases(ROOMS.KITCHEN, "kitchen:item-timer-updated", ["item-timer-updated"], {
      ...data,
      timestamp: new Date(),
    });
  });
};

const startCleanupTask = () => {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(async () => {
    try {
      const notificationManager = require("./notificationManager");
      await notificationManager.cleanupExpiredNotifications();
    } catch (error) {
      logger.error("Notification cleanup error:", error.message);
    }
  }, 60 * 60 * 1000);
};

exports.initializeSocket = (server) => {
  const socketIo = require("socket.io");

  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    registerSocketHandlers(socket);
  });

  startCleanupTask();
  return io;
};

exports.setupNotificationSystem = startCleanupTask;

exports.getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

exports.emitUserNotification = (userId, notificationData) => {
  if (!userId) return;
  const payload = { ...notificationData, timestamp: new Date() };
  emitWithAliases(buildUserRoom(userId), EVENTS.NOTIFICATION_NEW, ["new_notification", "notification_received"], payload);
};

exports.emitRoleNotification = (role, notificationData) => {
  if (!role) return;
  const payload = { ...notificationData, timestamp: new Date() };
  emitWithAliases(buildRoleRoom(role), EVENTS.NOTIFICATION_NEW, ["new_notification", "notification_received"], payload);
};

exports.emitStaffNotification = (notificationData) => {
  const payload = { ...notificationData, timestamp: new Date() };
  emitWithAliases(ROOMS.STAFF, EVENTS.NOTIFICATION_NEW, ["new_notification", "notification_received"], payload);
  emitWithAliases(ROOMS.MANAGEMENT, EVENTS.NOTIFICATION_NEW, ["new_notification", "notification_received"], payload);
};

exports.emitKitchenNotification = (notificationData) => {
  const payload = { ...notificationData, timestamp: new Date() };
  emitWithAliases(ROOMS.KITCHEN, EVENTS.NOTIFICATION_NEW, ["kitchen_notification", "notification_received"], payload);
};

exports.emitNotificationUpdate = (notificationId, userId, action) => {
  if (!notificationId || !userId || !action) return;
  const payload = { notificationId, action, timestamp: new Date() };
  emitWithAliases(buildUserRoom(userId), EVENTS.NOTIFICATION_UPDATED, ["notification_updated"], payload);
};

exports.emitNotificationCountUpdate = (userId, counts = {}) => {
  if (!userId) return;
  const payload = { ...counts, timestamp: new Date() };
  emitWithAliases(buildUserRoom(userId), EVENTS.NOTIFICATION_COUNT, ["notification_count_update"], payload);
};

exports.emitNotificationSound = (recipientId, soundType = "urgent") => {
  if (!recipientId) return;
  const payload = { soundType, timestamp: new Date() };
  emitWithAliases(buildUserRoom(recipientId), EVENTS.NOTIFICATION_SOUND, ["notification_sound", "play_notification_sound"], payload);
};

exports.emitNewCall = (callData) => {
  const payload = { ...callData, timestamp: new Date() };
  emitWithAliases(ROOMS.STAFF, EVENTS.WAITER_CALL_NEW, ["new_waiter_call", "new-waiter-call"], payload);
};

exports.emitCallAcknowledged = (sessionId, callData) => {
  if (!sessionId) return;
  const payload = { ...callData, timestamp: new Date() };
  emitWithAliases(buildSessionRoom(sessionId), EVENTS.WAITER_CALL_ACK, ["call_acknowledged", "call-acknowledged"], payload);
};

exports.emitCallCompleted = (sessionId, callData) => {
  if (!sessionId) return;
  const payload = { ...callData, timestamp: new Date() };
  emitWithAliases(buildSessionRoom(sessionId), EVENTS.WAITER_CALL_COMPLETED, ["call_completed", "call-completed"], payload);
};

exports.emitCallStatsUpdate = (stats) => {
  const payload = { ...stats, timestamp: new Date() };
  emitWithAliases(ROOMS.STAFF, "waiter-call:stats-updated", ["call_stats_updated", "call-stats-updated"], payload);
};

exports.emitOrderStatusUpdate = (orderData) => {
  const payload = { ...orderData, timestamp: new Date() };
  emitWithAliases(ROOMS.STAFF, EVENTS.ORDER_STATUS_UPDATED, ["order-status-updated"], payload);
};

exports.emitOrderStatusToCustomer = (sessionId, orderData) => {
  if (!sessionId) return;
  const payload = { ...orderData, timestamp: new Date() };
  emitWithAliases(buildSessionRoom(sessionId), EVENTS.ORDER_STATUS_UPDATED, ["order-status-updated"], payload);
};

exports.emitNewOrderToKitchen = (orderData) => {
  const payload = { ...orderData, timestamp: new Date() };
  emitWithAliases(ROOMS.KITCHEN, EVENTS.ORDER_NEW, ["new-order"], payload);
};

exports.emitOrderUpdateToKitchen = (orderData) => {
  const payload = { ...orderData, timestamp: new Date() };
  emitWithAliases(ROOMS.KITCHEN, EVENTS.ORDER_UPDATED, ["order-updated"], payload);

  if (Array.isArray(orderData.stationUpdates)) {
    orderData.stationUpdates.forEach((stationUpdate) => {
      if (!stationUpdate.stationId) return;
      emitWithAliases(
        buildStationRoom(stationUpdate.stationId),
        "station:order-updated",
        ["station-order-update"],
        { orderData, stationUpdate, timestamp: new Date() }
      );
    });
  }
};

exports.emitDelayedOrderAlert = (orderData, delayMinutes, delayedItems = []) => {
  const payload = {
    orderData,
    delayMinutes,
    delayedItems,
    timestamp: new Date(),
  };

  emitWithAliases(ROOMS.KITCHEN, EVENTS.ORDER_DELAYED, ["order_delayed"], payload);
  emitWithAliases(ROOMS.MANAGER, EVENTS.ORDER_DELAYED, ["delayed_order_alert"], payload);
  emitWithAliases(ROOMS.MANAGEMENT, EVENTS.ORDER_DELAYED, ["delayed_order_alert"], payload);
};
