const { logger } = require("./logger.js");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const socketManager = require("./socketManager");
const { getCurrentTenantId } = require("./tenantContext");
class NotificationManager {
  constructor() {
    this.cleanupTimer = null;
  }
  shapeAction(action = {}) {
    if (!action) {
      return null;
    }
    return {
      label: String(action.label || "").trim(),
      type: String(action.type || "button").trim(),
      action: String(action.action || "").trim(),
    };
  }
  shapeSender(sender = null) {
    if (!sender) {
      return null;
    }
    return {
      _id: sender._id,
      name: sender.name || "",
      role: sender.role || "",
    };
  }
  shapeNotification(notification = {}, overrides = {}) {
    if (!notification) {
      return null;
    }
    const actions = Array.isArray(notification.actions)
      ? notification.actions
          .map((action) => this.shapeAction(action))
          .filter(Boolean)
      : [];
    return {
      _id: notification._id,
      title: notification.title || "",
      message: notification.message || "",
      type: notification.type || "system_alert",
      priority: notification.priority || "medium",
      status: notification.status || "unread",
      effectiveStatus:
        overrides.effectiveStatus ||
        notification.effectiveStatus ||
        notification.status ||
        "unread",
      isRead: Boolean(overrides.isRead ?? notification.isRead),
      actionRequired: Boolean(notification.actionRequired),
      relatedModel: notification.relatedModel || null,
      actions,
      createdAt: notification.createdAt || null,
      expiresAt: notification.expiresAt || null,
      sender: this.shapeSender(notification.sender),
    };
  }
  resolveTenantId(data = {}) {
    if (Object.prototype.hasOwnProperty.call(data, "tenantId")) {
      return data.tenantId ?? null;
    }
    return data.metadata?.tenantId || getCurrentTenantId() || null;
  }
  normalizeActions(actions = []) {
    if (!Array.isArray(actions)) {
      return [];
    }
    return actions
      .map((action) => {
        if (typeof action === "string") {
          const label = action.trim();
          if (!label) {
            return null;
          }
          return {
            label,
            type: "button",
            action: "",
            color: "secondary",
          };
        }
        if (!action || typeof action !== "object") {
          return null;
        }
        const label = String(action.label || "").trim();
        if (!label) {
          return null;
        }
        return {
          label,
          type: String(action.type || "button").trim(),
          action: String(action.action || "").trim(),
          color: String(action.color || "secondary").trim(),
        };
      })
      .filter(Boolean);
  }
  buildRecipientQuery(userId, role) {
    return {
      $or: [
        {
          recipientType: "user",
          recipients: userId,
        },
        {
          recipientType: "role",
          roles: role,
        },
        {
          recipientType: "all",
        },
      ],
      "hiddenFor.user": {
        $ne: userId,
      },
    };
  }
  buildSessionQuery(sessionId) {
    return {
      customerSessionId: sessionId,
      "hiddenForSessions.sessionId": {
        $ne: sessionId,
      },
    };
  }
  buildUserNotificationActionQuery(notificationId, userId, role) {
    return {
      _id: notificationId,
      ...this.buildRecipientQuery(userId, role),
    };
  }
  decorateNotificationForUser(notification, userId) {
    const serialized = notification.toObject
      ? notification.toObject()
      : notification;
    const normalizedUserId = String(userId);
    const isRead = (serialized.readBy || []).some(
      (entry) => String(entry.user) === normalizedUserId,
    );
    const isAcknowledged = (serialized.acknowledgedBy || []).some(
      (entry) => String(entry.user) === normalizedUserId,
    );
    return this.shapeNotification(serialized, {
      isRead,
      isAcknowledged,
      effectiveStatus:
        serialized.status === "dismissed"
          ? "dismissed"
          : isAcknowledged
            ? "acknowledged"
            : isRead
              ? "read"
              : "unread",
    });
  }
  async createNotification(data) {
    try {
      const allowedRoles =
        Notification.schema.path("roles").caster?.enumValues || [];
      const normalizedRoles = [
        ...new Set(
          (data.roles || [])
            .map((role) => String(role || "").trim())
            .filter(Boolean),
        ),
      ];
      const roles = normalizedRoles.filter((role) =>
        allowedRoles.includes(role),
      );
      const invalidRoles = normalizedRoles.filter(
        (role) => !allowedRoles.includes(role),
      );
      if (invalidRoles.length > 0) {
        logger.warn("Ignoring unsupported notification roles:", invalidRoles);
      }
      const notification = await Notification.create({
        tenantId: this.resolveTenantId(data),
        title: data.title,
        message: data.message,
        type: data.type || "system_alert",
        priority: data.priority || "medium",
        recipientType: data.recipientType || "all",
        recipients: data.recipients || [],
        roles,
        customerSessionId: data.customerSessionId || null,
        sender: data.sender || null,
        senderType: data.senderType || "system",
        relatedTo: data.relatedTo || null,
        relatedModel: data.relatedModel || null,
        actionRequired: data.actionRequired || false,
        actions: this.normalizeActions(data.actions),
        metadata: data.metadata || {},
        expiresAt: data.expiresAt || null,
      });
      await notification.populate("sender", "name role");
      await this.emitNotification(notification);
      const pushNotificationManager = require("./pushNotificationManager");
      pushNotificationManager
        .sendNotificationPush(notification)
        .catch((pushError) => {
          logger.error("Push notification dispatch failed:", pushError);
        });
      return this.shapeNotification(notification, {
        isRead: false,
        effectiveStatus: notification.status || "unread",
      });
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
  async createDelayedOrderNotification(orderData, delayMinutes, delayedItems) {
    const priority = delayMinutes > 15 ? "urgent" : "high";
    return this.createNotification({
      tenantId: orderData.tenantId || null,
      title: `Order Delay - #${orderData.orderNumber}`,
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
        tenantId: orderData.tenantId || null,
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber,
        delayMinutes: delayMinutes,
        delayedItems: delayedItems,
        priority: orderData.priority,
        createdAt: orderData.createdAt,
      },
    });
  }
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
  async createCashPaymentRequestNotification(billData) {
    return this.createNotification({
      title: `Cash Payment Request - Table ${billData.tableNumber || "N/A"}`,
      message: `Customer ${billData.customerName || "Guest"} requested cash payment for Bill #${billData.billNumber}. Amount: ₹${billData.totalAmount}`,
      type: "payment_request",
      priority: "high",
      recipientType: "role",
      roles: ["admin"],
      relatedTo: billData._id,
      relatedModel: "Bill",
      actionRequired: true,
      actions: [
        {
          label: "Open Bills",
          type: "link",
          action: "/dashboard/customers/bills",
          color: "success",
        },
      ],
      metadata: {
        billNumber: billData.billNumber,
        tableNumber: billData.tableNumber,
        totalAmount: billData.totalAmount,
        paymentMethod: "cash",
        customerName: billData.customerName,
        customerId: billData.customerId || null,
        sessionId: billData.sessionId || "",
      },
    });
  }
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
  async createReservationAlert(reservationData) {
    const minutesUntil = Math.floor(
      (new Date(reservationData.reservationTime) - Date.now()) / 60000,
    );
    return this.createNotification({
      title: `Upcoming Reservation - Table ${reservationData.tableNumber}`,
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
  async createShiftChangeNotification(shiftData) {
    return this.createNotification({
      title: `Shift ${shiftData.type === "start" ? "Starting" : "Ending"}`,
      message: `Your ${shiftData.shiftName} shift ${shiftData.type === "start" ? "starts" : "ends"} in 15 minutes`,
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
  async createStaffAnnouncement(announcementData, senderId) {
    const activeStaff = await User.find({
      isActive: true,
      role: {
        $in: ["admin", "manager", "chef", "waiter", "cashier"],
      },
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
      if (type) query.type = type;
      if (priority) query.priority = priority;
      if (unreadOnly)
        query["readBy.user"] = {
          $ne: userId,
        };
      if (actionRequired) query.actionRequired = true;
      const notifications = await Notification.find(query)
        .select(
          "title message type priority sender relatedModel actionRequired actions status readBy acknowledgedBy createdAt expiresAt",
        )
        .populate("sender", "name role")
        .sort({
          createdAt: -1,
          priority: -1,
        });
      let decoratedNotifications = notifications.map((notification) =>
        this.decorateNotificationForUser(notification, userId),
      );
      if (search) {
        const keyword = search.trim().toLowerCase();
        decoratedNotifications = decoratedNotifications.filter(
          (notification) =>
            String(notification.title || "")
              .toLowerCase()
              .includes(keyword) ||
            String(notification.message || "")
              .toLowerCase()
              .includes(keyword) ||
            String(notification.type || "")
              .toLowerCase()
              .includes(keyword) ||
            String(notification.sender?.name || "")
              .toLowerCase()
              .includes(keyword),
        );
      }
      if (status && status !== "all") {
        decoratedNotifications = decoratedNotifications.filter(
          (notification) => notification.effectiveStatus === status,
        );
      }
      const paginatedNotifications = decoratedNotifications.slice(
        skip,
        skip + limit,
      );
      const unreadCount = await Notification.countDocuments({
        ...query,
        "readBy.user": {
          $ne: userId,
        },
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
    const { limit = 50, skip = 0, unreadOnly = false, search } = options;
    const query = this.buildSessionQuery(sessionId);
    if (unreadOnly) {
      query["readBySessions.sessionId"] = {
        $ne: sessionId,
      };
    }
    let notifications = await Notification.find(query)
      .select(
        "title message type priority status actionRequired actions createdAt expiresAt readBySessions",
      )
      .sort({
        createdAt: -1,
        priority: -1,
      })
      .lean();
    notifications = notifications.map((notification) => {
      const isRead = (notification.readBySessions || []).some(
        (entry) => String(entry.sessionId) === String(sessionId),
      );
      return this.shapeNotification(notification, {
        isRead,
        effectiveStatus: isRead ? "read" : "unread",
      });
    });
    if (search) {
      const keyword = String(search).trim().toLowerCase();
      notifications = notifications.filter(
        (notification) =>
          String(notification.title || "")
            .toLowerCase()
            .includes(keyword) ||
          String(notification.message || "")
            .toLowerCase()
            .includes(keyword),
      );
    }
    const unreadCount = notifications.filter(
      (notification) => !notification.isRead,
    ).length;
    return {
      notifications: notifications.slice(skip, skip + limit),
      unreadCount,
      total: notifications.length,
    };
  }
  async markAsRead(notificationId, userId) {
    try {
      const user = await User.findById(userId).select("role");
      if (!user) {
        throw new Error("User not found");
      }
      const notification = await Notification.findOneAndUpdate(
        this.buildUserNotificationActionQuery(
          notificationId,
          userId,
          user.role,
        ),
        {
          $addToSet: {
            readBy: {
              user: userId,
              readAt: Date.now(),
            },
          },
          $set: {
            status: "read",
          },
        },
        {
          new: true,
        },
      );
      if (!notification) {
        throw new Error("Notification not found");
      }
      socketManager.emitNotificationUpdate(notification._id, userId, "read");
      const unreadCount = await Notification.countDocuments({
        "hiddenFor.user": {
          $ne: userId,
        },
        "readBy.user": {
          $ne: userId,
        },
        $or: this.buildRecipientQuery(userId, user.role).$or,
      });
      socketManager.emitNotificationCountUpdate(userId, {
        unreadCount,
      });
      return this.decorateNotificationForUser(notification, userId);
    } catch (error) {
      logger.error("Mark as read failed:", error);
      throw error;
    }
  }
  async markAsAcknowledged(notificationId, userId) {
    try {
      const user = await User.findById(userId).select("role");
      if (!user) {
        throw new Error("User not found");
      }
      const notification = await Notification.findOneAndUpdate(
        this.buildUserNotificationActionQuery(
          notificationId,
          userId,
          user.role,
        ),
        {
          $addToSet: {
            acknowledgedBy: {
              user: userId,
              acknowledgedAt: Date.now(),
            },
          },
          $set: {
            status: "acknowledged",
          },
        },
        {
          new: true,
        },
      );
      if (!notification) {
        throw new Error("Notification not found");
      }
      socketManager.emitNotificationUpdate(
        notification._id,
        userId,
        "acknowledged",
      );
      return this.decorateNotificationForUser(notification, userId);
    } catch (error) {
      logger.error("Mark as acknowledged failed:", error);
      throw error;
    }
  }
  async markAllAsRead(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");
      const query = {
        ...this.buildRecipientQuery(userId, user.role),
        "readBy.user": {
          $ne: userId,
        },
      };
      const notifications = await Notification.find(query);
      const updatePromises = notifications.map((notification) =>
        Notification.markAsRead(notification._id, userId),
      );
      await Promise.all(updatePromises);
      socketManager.emitNotificationCountUpdate(userId, {
        unreadCount: 0,
      });
      socketManager.emitNotificationUpdate("all", userId, "read");
      return {
        success: true,
        count: notifications.length,
      };
    } catch (error) {
      logger.error("Mark all as read failed:", error);
      throw error;
    }
  }
  async dismissNotification(notificationId, userId) {
    try {
      const user = await User.findById(userId).select("role");
      if (!user) {
        throw new Error("User not found");
      }
      const notification = await Notification.findOneAndUpdate(
        this.buildUserNotificationActionQuery(
          notificationId,
          userId,
          user.role,
        ),
        {
          $push: {
            hiddenFor: {
              user: userId,
              hiddenAt: new Date(),
            },
          },
        },
        {
          new: true,
        },
      );
      if (!notification) {
        throw new Error("Notification not found");
      }
      socketManager.emitNotificationUpdate(
        notification._id,
        userId,
        "dismissed",
      );
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
          $push: {
            hiddenFor: {
              user: userId,
              hiddenAt: new Date(),
            },
          },
        },
      );
      socketManager.emitNotificationUpdate("all", userId, "cleared");
      socketManager.emitNotificationCountUpdate(userId, {
        unreadCount: 0,
      });
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
      {
        _id: notificationId,
        customerSessionId: sessionId,
      },
      {
        $addToSet: {
          readBySessions: {
            sessionId,
            readAt: new Date(),
          },
        },
        $set: {
          status: "read",
        },
      },
      {
        new: true,
      },
    );
    if (!notification) {
      throw new Error("Notification not found");
    }
    return this.shapeNotification(notification, {
      isRead: true,
      effectiveStatus: "read",
    });
  }
  async markAllSessionNotificationsAsRead(sessionId) {
    const notifications = await Notification.find({
      ...this.buildSessionQuery(sessionId),
      "readBySessions.sessionId": {
        $ne: sessionId,
      },
    });
    await Promise.all(
      notifications.map((notification) =>
        Notification.findByIdAndUpdate(notification._id, {
          $addToSet: {
            readBySessions: {
              sessionId,
              readAt: new Date(),
            },
          },
          $set: {
            status: "read",
          },
        }),
      ),
    );
    return {
      success: true,
      count: notifications.length,
    };
  }
  async clearAllSessionNotifications(sessionId) {
    const result = await Notification.updateMany(
      this.buildSessionQuery(sessionId),
      {
        $push: {
          hiddenForSessions: {
            sessionId,
            hiddenAt: new Date(),
          },
        },
      },
    );
    return {
      success: true,
      count: result.modifiedCount || 0,
    };
  }
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: {
          $lt: new Date(),
        },
      });
      logger.info(`Cleaned up ${result.deletedCount} expired notifications`);
      return result;
    } catch (error) {
      logger.error("Cleanup expired notifications failed:", error);
      throw error;
    }
  }
  async getNotificationStats(userId, period = "today") {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");
      const notificationUserId = new mongoose.Types.ObjectId(String(userId));
      const dateFilter = this.getDateFilter(period);
      const baseQuery = {
        ...this.buildRecipientQuery(notificationUserId, user.role),
        createdAt: dateFilter,
      };
      const stats = await Notification.aggregate([
        {
          $match: baseQuery,
        },
        {
          $facet: {
            total: [
              {
                $count: "count",
              },
            ],
            unreadCount: [
              {
                $match: {
                  "readBy.user": {
                    $ne: notificationUserId,
                  },
                },
              },
              {
                $count: "count",
              },
            ],
          },
        },
      ]);
      return {
        total: stats[0]?.total[0]?.count || 0,
        unreadCount: stats[0]?.unreadCount[0]?.count || 0,
        period,
      };
    } catch (error) {
      logger.error("Get notification stats failed:", error);
      throw error;
    }
  }
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
          actions: [
            {
              label: "Start Preparing",
              type: "button",
              action: `/api/kitchen-orders/${orderData._id}/start`,
              color: "primary",
            },
            {
              label: "View Order Details",
              type: "link",
              action: `/dashboard/kitchen/orders/${orderData._id}`,
              color: "secondary",
            },
          ],
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
  async emitNotification(notification) {
    let io;
    try {
      io = socketManager.getIO();
    } catch (_error) {
      return;
    }
    if (
      notification.recipientType === "user" &&
      notification.recipients.length > 0
    ) {
      notification.recipients.forEach((recipientId) => {
        io.to(`user-${recipientId}`).emit("new_notification", {
          ...this.shapeNotification(notification, {
            isRead: false,
            effectiveStatus: "unread",
          }),
          isUnread: true,
        });
      });
    }
    if (
      notification.recipientType === "role" &&
      notification.roles.length > 0
    ) {
      notification.roles.forEach((role) => {
        io.to(`role-${role}`).emit("new_notification", {
          ...this.shapeNotification(notification, {
            isRead: false,
            effectiveStatus: "unread",
          }),
          isUnread: true,
        });
      });
    }
    if (notification.recipientType === "all") {
      io.to("staff-room").emit("new_notification", {
        ...this.shapeNotification(notification, {
          isRead: false,
          effectiveStatus: "unread",
        }),
        isUnread: true,
      });
    }
    if (notification.customerSessionId) {
      io.to(`customer-${notification.customerSessionId}`).emit(
        "new_notification",
        {
          ...this.shapeNotification(notification, {
            isRead: false,
            effectiveStatus: "unread",
          }),
          isUnread: true,
        },
      );
    }
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
      "readBy.user": {
        $ne: userId,
      },
    });
  }
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
        return {
          $gte: startDate,
          $lte: endDate,
        };
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(0);
    }
    return {
      $gte: startDate,
    };
  }
  async scheduleCleanup() {
    try {
      if (this.cleanupTimer) {
        return;
      }
      this.cleanupTimer = setInterval(
        async () => {
          await this.cleanupExpiredNotifications();
        },
        60 * 60 * 1000,
      );
      this.cleanupTimer.unref?.();
    } catch (error) {
      logger.error("Schedule cleanup failed:", error);
    }
  }
}
module.exports = new NotificationManager();
