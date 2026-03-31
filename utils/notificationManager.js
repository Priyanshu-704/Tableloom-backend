const { logger } = require("./logger.js");
const Notification = require("../models/Notification");
const User = require("../models/User");
const socketManager = require("./socketManager");

class NotificationManager {
  buildRecipientQuery(userId, role) {
    return {
      $or: [
        { recipientType: "user", recipients: userId },
        { recipientType: "role", roles: role },
        { recipientType: "all" },
      ],
      "hiddenFor.user": { $ne: userId },
    };
  }

  buildSessionQuery(sessionId) {
    return {
      customerSessionId: sessionId,
      "hiddenForSessions.sessionId": { $ne: sessionId },
    };
  }

  decorateNotificationForUser(notification, userId) {
    const serialized = notification.toObject ? notification.toObject() : notification;
    const normalizedUserId = String(userId);
    const isRead = (serialized.readBy || []).some(
      (entry) => String(entry.user) === normalizedUserId
    );
    const isAcknowledged = (serialized.acknowledgedBy || []).some(
      (entry) => String(entry.user) === normalizedUserId
    );

    return {
      ...serialized,
      isRead,
      isAcknowledged,
      effectiveStatus: serialized.status === "dismissed"
        ? "dismissed"
        : isAcknowledged
          ? "acknowledged"
          : isRead
            ? "read"
            : "unread",
    };
  }

  // Create notification
  async createNotification(data) {
    try {
      const notification = await Notification.create({
        title: data.title,
        message: data.message,
        type: data.type || "system_alert",
        priority: data.priority || "medium",
        recipientType: data.recipientType || "all",
        recipients: data.recipients || [], 
        roles: data.roles || [],
        customerSessionId: data.customerSessionId || null,
        sender: data.sender || null,
        senderType: data.senderType || "system",
        relatedTo: data.relatedTo || null,
        relatedModel: data.relatedModel || null,
        actionRequired: data.actionRequired || false,
        actions: data.actions || [],
        metadata: data.metadata || {},
        expiresAt: data.expiresAt || null,
      });

      // Populate sender details
      await notification.populate("sender", "name role profileImage");

      // Emit real-time notification
      await this.emitNotification(notification);

      return notification;
    } catch (error) {
      logger.error("Create notification failed:", error);
      throw error;
    }
  }

  async createCustomerSessionNotification(data) {
    if (!data?.customerSessionId) {
      throw new Error("customerSessionId is required");
    }

    return this.createNotification({
      title: data.title,
      message: data.message,
      type: data.type || "system_alert",
      priority: data.priority || "medium",
      recipientType: "table",
      customerSessionId: data.customerSessionId,
      senderType: data.senderType || "system",
      relatedTo: data.relatedTo || null,
      relatedModel: data.relatedModel || null,
      metadata: data.metadata || {},
      actions: data.actions || [],
      actionRequired: Boolean(data.actionRequired),
      expiresAt: data.expiresAt || null,
    });
  }

  // Create waiter call notification
  async createWaiterCallNotification(callData) {
    const priorityMap = {
      critical: "urgent",
      high: "high",
      medium: "medium",
      low: "low",
    };

    return this.createNotification({
      title: `Waiter Call - Table ${callData.tableNumber}`,
      message: callData.message || `${callData.customerName} needs assistance`,
      type: "waiter_call",
      priority: priorityMap[callData.priority] || "medium",
      recipientType: "role",
      roles: ["waiter", "manager", "admin"],
      sender: callData.customerId,
      senderType: "customer",
      relatedTo: callData._id,
      relatedModel: "WaiterCall",
      actionRequired: true,
      actions: [
        {
          label: "Acknowledge",
          type: "button",
          action: `/api/waiter-calls/${callData.callId}/acknowledge`,
          color: "primary",
        },
        {
          label: "View Details",
          type: "link",
          action: `/dashboard/waiter-calls/${callData.callId}`,
          color: "secondary",
        },
      ],
      metadata: {
        tableNumber: callData.tableNumber,
        tableName: callData.tableName,
        location: callData.location,
        callType: callData.callType,
        customerName: callData.customerName,
        createdAt: callData.createdAt,
      },
    });
  }

  // Create order ready notification
  async createOrderReadyNotification(orderData, itemData) {
    const notification = await this.createNotification({
      title: `Order Ready - #${orderData.orderNumber}`,
      message: `${itemData.quantity}x ${itemData.menuItemName} is ready for Table ${orderData.tableNumber}`,
      type: "order_ready",
      priority: "high",
      recipientType: "role",
      roles: ["waiter", "expediter"],
      sender: orderData.kitchenStaff,
      senderType: "kitchen",
      relatedTo: orderData._id,
      relatedModel: "KitchenOrder",
      actionRequired: true,
      actions: [
        {
          label: "Mark as Served",
          type: "button",
          action: `/api/kitchen-orders/${orderData._id}/items/${itemData._id}/served`,
          color: "success",
        },
        {
          label: "View Order",
          type: "link",
          action: `/dashboard/kitchen/orders/${orderData._id}`,
          color: "secondary",
        },
      ],
      metadata: {
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber,
        itemName: itemData.menuItemName,
        quantity: itemData.quantity,
        station: itemData.station,
        readyTime: itemData.readyTime,
      },
    });

    // Also notify specific waiter if assigned
    if (orderData.assignedWaiter) {
      await this.createNotification({
        title: `Your Order is Ready - Table ${orderData.tableNumber}`,
        message: `${itemData.menuItemName} is ready to serve`,
        type: "order_ready",
        priority: "medium",
        recipientType: "user",
        recipients: [orderData.assignedWaiter],
        relatedTo: orderData._id,
        relatedModel: "KitchenOrder",
        actionRequired: true,
        metadata: {
          orderNumber: orderData.orderNumber,
          tableNumber: orderData.tableNumber,
          itemName: itemData.menuItemName,
        },
      });
    }

    return notification;
  }

  // Create delayed order notification
  async createDelayedOrderNotification(orderData, delayMinutes, delayedItems) {
    const priority = delayMinutes > 15 ? "urgent" : "high";

    return this.createNotification({
      title: `⚠️ Order Delay - #${orderData.orderNumber}`,
      message: `Order #${orderData.orderNumber} is delayed by ${delayMinutes} minutes`,
      type: "order_delayed",
      priority: priority,
      recipientType: "role",
      roles: ["chef", "manager", "admin"],
      senderType: "system",
      relatedTo: orderData._id,
      relatedModel: "KitchenOrder",
      actionRequired: true,
      actions: [
        {
          label: "View Details",
          type: "link",
          action: `/dashboard/kitchen/orders/${orderData._id}`,
          color: "warning",
        },
        {
          label: "Update Status",
          type: "button",
          action: `/api/kitchen-orders/${orderData._id}/update-priority`,
          color: "primary",
        },
      ],
      metadata: {
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber,
        delayMinutes: delayMinutes,
        delayedItems: delayedItems,
        priority: orderData.priority,
        createdAt: orderData.createdAt,
      },
    });
  }

  // Create payment notification
  async createPaymentNotification(billData, paymentType) {
    const title =
      paymentType === "request"
        ? `Payment Request - Table ${billData.tableNumber}`
        : `Payment Received - #${billData.billNumber}`;

    const message =
      paymentType === "request"
        ? `Bill #${billData.billNumber} ready for payment. Amount: ₹${billData.totalAmount}`
        : `Payment of ₹${billData.totalAmount} received for Bill #${billData.billNumber}`;

    return this.createNotification({
      title: title,
      message: message,
      type: paymentType === "request" ? "payment_request" : "payment_received",
      priority: paymentType === "request" ? "high" : "medium",
      recipientType: "role",
      roles:
        paymentType === "request"
          ? ["waiter", "cashier"]
          : ["manager", "admin", "cashier"],
      relatedTo: billData._id,
      relatedModel: "Bill",
      actionRequired: paymentType === "request",
      actions:
        paymentType === "request"
          ? [
              {
                label: "Process Payment",
                type: "link",
                action: `/dashboard/bills/${billData._id}/payment`,
                color: "success",
              },
              {
                label: "View Bill",
                type: "link",
                action: `/dashboard/bills/${billData._id}`,
                color: "secondary",
              },
            ]
          : [],
      metadata: {
        billNumber: billData.billNumber,
        tableNumber: billData.tableNumber,
        totalAmount: billData.totalAmount,
        paymentMethod: billData.paymentMethod,
        customerName: billData.customerName,
      },
    });
  }

  // Create table assignment notification
  async createTableAssignmentNotification(tableData, waiterId) {
    return this.createNotification({
      title: `Table Assigned - ${tableData.tableName}`,
      message: `You have been assigned to ${tableData.tableName} (Table ${tableData.tableNumber})`,
      type: "table_assigned",
      priority: "medium",
      recipientType: "user",
      recipients: [waiterId],
      sender: tableData.assignedBy,
      senderType: "user",
      relatedTo: tableData._id,
      relatedModel: "Table",
      actionRequired: false,
      metadata: {
        tableNumber: tableData.tableNumber,
        tableName: tableData.tableName,
        location: tableData.location,
        customerCount: tableData.customerCount,
        assignedAt: new Date(),
      },
    });
  }

  // Create reservation alert
  async createReservationAlert(reservationData) {
    const minutesUntil = Math.floor(
      (new Date(reservationData.reservationTime) - Date.now()) / 60000
    );

    return this.createNotification({
      title: `⏰ Upcoming Reservation - Table ${reservationData.tableNumber}`,
      message: `Reservation for ${reservationData.customerName} in ${minutesUntil} minutes`,
      type: "reservation_alert",
      priority: minutesUntil <= 15 ? "urgent" : "high",
      recipientType: "role",
      roles: ["waiter", "manager"],
      senderType: "system",
      relatedTo: reservationData._id,
      relatedModel: "Reservation",
      actionRequired: true,
      actions: [
        {
          label: "Prepare Table",
          type: "button",
          action: `/api/tables/${reservationData.tableId}/prepare`,
          color: "primary",
        },
        {
          label: "View Details",
          type: "link",
          action: `/dashboard/reservations/${reservationData._id}`,
          color: "secondary",
        },
      ],
      metadata: {
        customerName: reservationData.customerName,
        tableNumber: reservationData.tableNumber,
        partySize: reservationData.partySize,
        reservationTime: reservationData.reservationTime,
        phone: reservationData.phone,
        notes: reservationData.notes,
      },
    });
  }

  // Create shift change notification
  async createShiftChangeNotification(shiftData) {
    return this.createNotification({
      title: `🔄 Shift ${shiftData.type === "start" ? "Starting" : "Ending"}`,
      message: `Your ${shiftData.shiftName} shift ${
        shiftData.type === "start" ? "starts" : "ends"
      } in 15 minutes`,
      type: "shift_change",
      priority: "medium",
      recipientType: "user",
      recipients: [shiftData.userId],
      senderType: "system",
      actionRequired: false,
      metadata: {
        shiftName: shiftData.shiftName,
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        type: shiftData.type,
      },
    });
  }

  // Bulk create notifications for all staff
  async createStaffAnnouncement(announcementData, senderId) {
    // Get all active staff
    const activeStaff = await User.find({
      isActive: true,
      role: { $in: ["admin", "manager", "chef", "waiter", "cashier"] },
    }).select("_id");

    const staffIds = activeStaff.map((staff) => staff._id);

    return this.createNotification({
      title: announcementData.title,
      message: announcementData.message,
      type: "staff_announcement",
      priority: announcementData.priority || "medium",
      recipientType: "user",
      recipients: staffIds,
      sender: senderId,
      senderType: "user",
      actionRequired: false,
      metadata: {
        announcementType: announcementData.type,
        expiresAt: announcementData.expiresAt,
        important: announcementData.important || false,
      },
    });
  }

  // Get notifications for user
  async getUserNotifications(userId, options = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const {
        status,
        type,
        priority,
        search,
        limit = 50,
        skip = 0,
        unreadOnly = false,
        actionRequired = false,
      } = options;

      const query = this.buildRecipientQuery(userId, user.role);

      // Apply filters
      if (type) query.type = type;
      if (priority) query.priority = priority;
      if (unreadOnly) query["readBy.user"] = { $ne: userId };
      if (actionRequired) query.actionRequired = true;

      const notifications = await Notification.find(query)
        .populate("sender", "name role profileImage")
        .populate("relatedTo")
        .sort({ createdAt: -1, priority: -1 });

      let decoratedNotifications = notifications.map((notification) =>
        this.decorateNotificationForUser(notification, userId)
      );

      if (search) {
        const keyword = search.trim().toLowerCase();
        decoratedNotifications = decoratedNotifications.filter((notification) => (
          String(notification.title || "").toLowerCase().includes(keyword) ||
          String(notification.message || "").toLowerCase().includes(keyword) ||
          String(notification.type || "").toLowerCase().includes(keyword) ||
          String(notification.sender?.name || "").toLowerCase().includes(keyword)
        ));
      }

      if (status && status !== "all") {
        decoratedNotifications = decoratedNotifications.filter(
          (notification) => notification.effectiveStatus === status
        );
      }

      const paginatedNotifications = decoratedNotifications.slice(skip, skip + limit);

      // Get unread count
      const unreadCount = await Notification.countDocuments({
        ...query,
        "readBy.user": { $ne: userId },
      });

      return {
        notifications: paginatedNotifications,
        unreadCount,
        total: decoratedNotifications.length,
      };
    } catch (error) {
      logger.error("Get user notifications failed:", error);
      throw error;
    }
  }

  async getSessionNotifications(sessionId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      unreadOnly = false,
      search,
    } = options;

    const query = this.buildSessionQuery(sessionId);

    if (unreadOnly) {
      query["readBySessions.sessionId"] = { $ne: sessionId };
    }

    let notifications = await Notification.find(query)
      .sort({ createdAt: -1, priority: -1 })
      .lean();

    notifications = notifications.map((notification) => ({
      ...notification,
      isRead: (notification.readBySessions || []).some(
        (entry) => String(entry.sessionId) === String(sessionId),
      ),
      effectiveStatus: (notification.readBySessions || []).some(
        (entry) => String(entry.sessionId) === String(sessionId),
      )
        ? "read"
        : "unread",
    }));

    if (search) {
      const keyword = String(search).trim().toLowerCase();
      notifications = notifications.filter(
        (notification) =>
          String(notification.title || "").toLowerCase().includes(keyword) ||
          String(notification.message || "").toLowerCase().includes(keyword),
      );
    }

    const unreadCount = notifications.filter((notification) => !notification.isRead).length;

    return {
      notifications: notifications.slice(skip, skip + limit),
      unreadCount,
      total: notifications.length,
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const user = await User.findById(userId).select("role");
      if (!user) {
        throw new Error("User not found");
      }

      const notification = await Notification.markAsRead(
        notificationId,
        userId
      );

      if (!notification) {
        throw new Error("Notification not found");
      }

      // Emit read status update
      socketManager.emitNotificationUpdate(notification._id, userId, "read");
      const unreadCount = await Notification.countDocuments({
        "hiddenFor.user": { $ne: userId },
        "readBy.user": { $ne: userId },
        $or: this.buildRecipientQuery(userId, user.role).$or,
      });
      socketManager.emitNotificationCountUpdate(userId, { unreadCount });

      return this.decorateNotificationForUser(notification, userId);
    } catch (error) {
      logger.error("Mark as read failed:", error);
      throw error;
    }
  }

  // Mark notification as acknowledged
  async markAsAcknowledged(notificationId, userId) {
    try {
      const notification = await Notification.markAsAcknowledged(
        notificationId,
        userId
      );

      if (!notification) {
        throw new Error("Notification not found");
      }

      // Emit acknowledged status update
      socketManager.emitNotificationUpdate(
        notification._id,
        userId,
        "acknowledged"
      );

      return this.decorateNotificationForUser(notification, userId);
    } catch (error) {
      logger.error("Mark as acknowledged failed:", error);
      throw error;
    }
  }

  // Mark all as read for user
  async markAllAsRead(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const query = {
        ...this.buildRecipientQuery(userId, user.role),
        "readBy.user": { $ne: userId },
      };

      const notifications = await Notification.find(query);

      const updatePromises = notifications.map((notification) =>
        Notification.markAsRead(notification._id, userId)
      );

      await Promise.all(updatePromises);

      // Emit bulk update
      socketManager.emitNotificationCountUpdate(userId, { unreadCount: 0 });
      socketManager.emitNotificationUpdate("all", userId, "read");

      return { success: true, count: notifications.length };
    } catch (error) {
      logger.error("Mark all as read failed:", error);
      throw error;
    }
  }

  // Dismiss notification
  async dismissNotification(notificationId, userId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        {
          $push: { hiddenFor: { user: userId, hiddenAt: new Date() } },
        },
        { new: true }
      );

      if (!notification) {
        throw new Error("Notification not found");
      }

      socketManager.emitNotificationUpdate(notification._id, userId, "dismissed");
      socketManager.emitNotificationCountUpdate(userId, {
        unreadCount: await this.getUnreadCount(userId),
      });

      return this.decorateNotificationForUser(notification, userId);
    } catch (error) {
      logger.error("Dismiss notification failed:", error);
      throw error;
    }
  }

  async clearAllNotifications(userId) {
    try {
      const user = await User.findById(userId).select("role");
      if (!user) throw new Error("User not found");

      const result = await Notification.updateMany(
        this.buildRecipientQuery(userId, user.role),
        {
          $push: { hiddenFor: { user: userId, hiddenAt: new Date() } },
        }
      );

      socketManager.emitNotificationUpdate("all", userId, "cleared");
      socketManager.emitNotificationCountUpdate(userId, { unreadCount: 0 });

      return {
        success: true,
        count: result.modifiedCount || 0,
      };
    } catch (error) {
      logger.error("Clear notifications failed:", error);
      throw error;
    }
  }

  async markSessionNotificationAsRead(notificationId, sessionId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, customerSessionId: sessionId },
      {
        $addToSet: {
          readBySessions: { sessionId, readAt: new Date() },
        },
        $set: { status: "read" },
      },
      { new: true },
    );

    if (!notification) {
      throw new Error("Notification not found");
    }

    return {
      ...notification.toObject(),
      isRead: true,
      effectiveStatus: "read",
    };
  }

  async markAllSessionNotificationsAsRead(sessionId) {
    const notifications = await Notification.find({
      ...this.buildSessionQuery(sessionId),
      "readBySessions.sessionId": { $ne: sessionId },
    });

    await Promise.all(
      notifications.map((notification) =>
        Notification.findByIdAndUpdate(notification._id, {
          $addToSet: {
            readBySessions: { sessionId, readAt: new Date() },
          },
          $set: { status: "read" },
        }),
      ),
    );

    return {
      success: true,
      count: notifications.length,
    };
  }

  async clearAllSessionNotifications(sessionId) {
    const result = await Notification.updateMany(this.buildSessionQuery(sessionId), {
      $push: { hiddenForSessions: { sessionId, hiddenAt: new Date() } },
    });

    return {
      success: true,
      count: result.modifiedCount || 0,
    };
  }

  // Delete expired notifications
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      logger.info(`Cleaned up ${result.deletedCount} expired notifications`);
      return result;
    } catch (error) {
      logger.error("Cleanup expired notifications failed:", error);
      throw error;
    }
  }

  // Get notification statistics
  async getNotificationStats(userId, period = "today") {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const dateFilter = this.getDateFilter(period);
      const baseQuery = {
        ...this.buildRecipientQuery(userId, user.role),
        createdAt: dateFilter,
      };

      const stats = await Notification.aggregate([
        { $match: baseQuery },
        {
          $facet: {
            byType: [
              {
                $group: {
                  _id: "$type",
                  count: { $sum: 1 },
                  unread: {
                    $sum: {
                      $cond: [{ $in: [userId, "$readBy.user"] }, 0, 1],
                    },
                  },
                },
              },
            ],
            byPriority: [
              {
                $group: {
                  _id: "$priority",
                  count: { $sum: 1 },
                },
              },
            ],
            byStatus: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
            total: [{ $count: "count" }],
            unreadCount: [
              {
                $match: {
                  "readBy.user": { $ne: userId },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]);

      return {
        byType: stats[0]?.byType || [],
        byPriority: stats[0]?.byPriority || [],
        byStatus: stats[0]?.byStatus || [],
        total: stats[0]?.total[0]?.count || 0,
        unreadCount: stats[0]?.unreadCount[0]?.count || 0,
        period,
      };
    } catch (error) {
      logger.error("Get notification stats failed:", error);
      throw error;
    }
  }

  // Add this method to NotificationManager class
  async createKitchenOrderNotification(orderData, stationAssignments) {
    try {
      if (!Array.isArray(stationAssignments)) return [];

      const notifications = [];

      for (const assignment of stationAssignments) {
        const notification = await this.createNotification({
          title: `New Order - ${assignment.stationName}`,
          message: `Order #${orderData.orderNumber} has ${assignment.items.length} items for ${assignment.stationName}`,
          type: "system_alert", 
          priority: "high",
          recipientType: "role",
          roles: ["chef"],
          senderType: "system",
          relatedTo: orderData._id,
          relatedModel: "KitchenOrder",
          actionRequired: true,
          actions: [`Start Preparing`, `View Order Details`],
          metadata: {
            orderNumber: orderData.orderNumber,
            tableNumber: orderData.tableNumber,
            stationId: assignment.station,
            stationName: assignment.stationName,
            stationType: assignment.stationType,
            itemCount: assignment.items.length,
            items: assignment.items.map(String),
          },
        });

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      logger.error("Create kitchen order notification failed:", error);
      throw error;
    }
  }

  // Real-time emission methods
  async emitNotification(notification) {
    let io;
    try {
      io = socketManager.getIO();
    } catch (_error) {
      return;
    }

    // Send to specific recipients
    if (
      notification.recipientType === "user" &&
      notification.recipients.length > 0
    ) {
      notification.recipients.forEach((recipientId) => {
        io.to(`user-${recipientId}`).emit("new_notification", {
          ...notification.toObject(),
          isUnread: true,
        });
      });
    }

    // Send to roles
    if (
      notification.recipientType === "role" &&
      notification.roles.length > 0
    ) {
      notification.roles.forEach((role) => {
        io.to(`role-${role}`).emit("new_notification", {
          ...notification.toObject(),
          isUnread: true,
        });
      });
    }

    // Send to all staff
    if (notification.recipientType === "all") {
      io.to("staff-room").emit("new_notification", {
        ...notification.toObject(),
        isUnread: true,
      });
    }

    if (notification.customerSessionId) {
      io.to(`customer-${notification.customerSessionId}`).emit("new_notification", {
        ...notification.toObject(),
        isUnread: true,
      });
    }

    // Play sound based on priority
    if (
      notification.priority === "urgent" ||
      notification.priority === "high"
    ) {
      io.to("staff-room").emit("notification_sound", {
        type: "urgent",
        notificationId: notification._id,
      });
    }
  }

  async getUnreadCount(userId) {
    const user = await User.findById(userId).select("role");
    if (!user) {
      throw new Error("User not found");
    }

    return Notification.countDocuments({
      ...this.buildRecipientQuery(userId, user.role),
      "readBy.user": { $ne: userId },
    });
  }

  // Helper method for date filtering
  getDateFilter(period) {
    const now = new Date();
    let startDate;

    switch (period) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "yesterday":
        startDate = new Date(now.setDate(now.getDate() - 1));
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        return { $gte: startDate, $lte: endDate };
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(0); // All time
    }

    return { $gte: startDate };
  }

  // Schedule notification cleanup (call this periodically)
  async scheduleCleanup() {
    try {
      // Run cleanup every hour
      setInterval(async () => {
        await this.cleanupExpiredNotifications();
      }, 60 * 60 * 1000); // 1 hour
    } catch (error) {
      logger.error("Schedule cleanup failed:", error);
    }
  }
}

module.exports = new NotificationManager();
