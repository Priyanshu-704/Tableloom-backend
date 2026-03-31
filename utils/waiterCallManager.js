const { logger } = require("./logger.js");
const WaiterCall = require("../models/WaiterCall");
const Customer = require("../models/Customer");
const User = require("../models/User");
const notificationManager = require("./notificationManager");
const socketManager = require("./socketManager");

const ACTIVE_SESSION_STATUSES = ["active", "payment_pending"];
const ACTIVE_CALL_STATUSES = ["pending", "assigned", "acknowledged", "in_progress"];

const getDateRange = (period) => {
  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else if (period === "month") {
    start.setMonth(start.getMonth() - 1);
  } else {
    start.setHours(0, 0, 0, 0);
  }

  return { $gte: start };
};

const toPriorityWeight = {
  critical: 5,
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const toCallTypeWeight = {
  emergency: 5,
  billing: 4,
  bill: 4,
  order: 3,
  order_help: 3,
  assistance: 2,
  waiter: 2,
  other: 1,
};

const getStatusMessage = (status) => {
  const messages = {
    pending: "Your request is pending. Staff will be with you shortly.",
    assigned: "A staff member has been assigned to your request.",
    acknowledged: "Staff member is on the way to your table.",
    in_progress: "Staff member is assisting you.",
    completed: "Request completed. Thank you!",
    cancelled: "Request cancelled.",
  };

  return messages[status] || "Request status updated.";
};

const getEstimatedWaitTime = (priority = "medium", callType = "waiter") => {
  const baseTimes = {
    emergency: 2,
    billing: 3,
    bill: 3,
    order: 4,
    order_help: 4,
    assistance: 5,
    waiter: 5,
    other: 6,
  };

  const multipliers = {
    critical: 0.5,
    urgent: 0.7,
    high: 0.8,
    medium: 1,
    low: 1.2,
  };

  return Math.round((baseTimes[callType] || 5) * (multipliers[priority] || 1));
};

const emitToCustomerSession = (sessionId, eventName, payload) => {
  try {
    const io = socketManager.getIO();
    io.to(`customer-${sessionId}`).emit(eventName, payload);
  } catch (_error) {}
};

const emitToStaffRoom = (eventName, payload) => {
  try {
    const io = socketManager.getIO();
    io.to("staff-room").emit(eventName, payload);
    io.to("management-room").emit(eventName, payload);
  } catch (_error) {}
};

const createCustomerNotification = async (sessionId, title, message, payload = {}) => {
  try {
    await notificationManager.createCustomerSessionNotification({
      customerSessionId: sessionId,
      title,
      message,
      type: "waiter_call",
      priority: payload.priority === "critical" ? "urgent" : payload.priority || "medium",
      relatedTo: payload._id || null,
      relatedModel: "WaiterCall",
      metadata: payload,
    });
  } catch (error) {
    logger.error("Failed to create customer session notification:", error);
  }
};

const buildCallPayload = (call) => ({
  callId: call.callId,
  sessionId: call.sessionId,
  tableNumber: call.tableNumber,
  tableName: call.tableName,
  location: call.location,
  callType: call.callType,
  priority: call.priority,
  urgencyLevel: call.urgencyLevel,
  status: call.status,
  message: call.message,
  coordinates: call.coordinates,
  acknowledgedAt: call.acknowledgedAt,
  completedAt: call.completedAt,
  assignedAt: call.assignedAt,
  createdAt: call.createdAt,
  updatedAt: call.updatedAt,
});

exports.calculateUrgencyLevel = (callType = "waiter", priority = "medium") => {
  const callTypeWeight = toCallTypeWeight[callType] || 2;
  const priorityWeight = toPriorityWeight[priority] || 2;
  const score = Math.round((callTypeWeight + priorityWeight) / 2);

  if (score >= 4) return "critical";
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
};

exports.getAvailableStaff = async () => {
  try {
    return await User.find({
      isActive: true,
      role: { $in: ["waiter", "manager", "admin"] },
    })
      .select("name role isActive")
      .lean();
  } catch (error) {
    logger.error("Get available staff failed:", error);
    return [];
  }
};

exports.createWaiterCall = async (sessionId, callData = {}) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ACTIVE_SESSION_STATUSES },
    }).populate("table");

    if (!customer || !customer.table) {
      throw new Error("Active customer session not found");
    }

    const existingActiveCall = await WaiterCall.findOne({
      sessionId,
      status: { $in: ACTIVE_CALL_STATUSES },
    })
      .populate("table", "tableNumber tableName location coordinates")
      .populate("customer", "name phone");

    if (existingActiveCall) {
      existingActiveCall.callType = callData.callType || existingActiveCall.callType;
      existingActiveCall.priority = callData.priority || existingActiveCall.priority;
      existingActiveCall.message = callData.message || existingActiveCall.message;
      existingActiveCall.coordinates = callData.coordinates || existingActiveCall.coordinates;
      existingActiveCall.urgencyLevel = this.calculateUrgencyLevel(
        existingActiveCall.callType,
        existingActiveCall.priority
      );
      await existingActiveCall.save();

      const payload = {
        ...buildCallPayload(existingActiveCall),
        customerName: existingActiveCall.customer?.name || "Customer",
        customerPhone: existingActiveCall.customer?.phone || "",
      };
      socketManager.emitNewCall(payload);
    emitToCustomerSession(sessionId, "waiter-call:updated", {
      ...payload,
      message: "Your existing request has been updated.",
    });
    await createCustomerNotification(
      sessionId,
      `Waiter request updated`,
      "Your existing waiter request has been updated.",
      payload,
    );

    return existingActiveCall;
    }

    const waiterCall = await WaiterCall.create({
      sessionId,
      customer: customer._id,
      table: customer.table._id,
      tableNumber: String(customer.table.tableNumber),
      tableName: customer.table.tableName || `Table ${customer.table.tableNumber}`,
      location: customer.table.location || "Dining Area",
      callType: callData.callType || "waiter",
      priority: callData.priority || "medium",
      message: callData.message || "",
      coordinates: callData.coordinates || null,
      urgencyLevel: this.calculateUrgencyLevel(callData.callType, callData.priority),
    });

    await waiterCall.populate("table", "tableNumber tableName location coordinates");
    await waiterCall.populate("customer", "name phone");

    const payload = {
      ...buildCallPayload(waiterCall),
      customerName: waiterCall.customer?.name || "Customer",
      customerPhone: waiterCall.customer?.phone || "",
    };

    socketManager.emitNewCall(payload);
    emitToCustomerSession(sessionId, "waiter-call:confirmed", {
      ...payload,
      estimatedWaitTime: getEstimatedWaitTime(waiterCall.priority, waiterCall.callType),
      message:
        "Your request has been received. A staff member will be with you shortly.",
    });
    await createCustomerNotification(
      sessionId,
      `Waiter request received`,
      "Your request has been received. A staff member will be with you shortly.",
      payload,
    );

    try {
      await notificationManager.createWaiterCallNotification({
        _id: waiterCall._id,
        callId: waiterCall.callId,
        tableNumber: waiterCall.tableNumber,
        tableName: waiterCall.tableName,
        location: waiterCall.location,
        callType: waiterCall.callType,
        priority: waiterCall.priority,
        message: waiterCall.message,
        customerName: waiterCall.customer?.name || "Customer",
        createdAt: waiterCall.createdAt,
      });
    } catch (notificationError) {
      logger.error("Failed to create waiter call notification:", notificationError);
    }

    await this.updateCallStatistics();
    return waiterCall;
  } catch (error) {
    logger.error("Create waiter call failed:", error);
    throw error;
  }
};

exports.acknowledgeCall = async (callId, staffId, estimatedTime = null) => {
  try {
    const waiterCall = await WaiterCall.findOne({ callId });
    if (!waiterCall) throw new Error("Waiter call not found");

    if (!["pending", "assigned"].includes(waiterCall.status)) {
      throw new Error(`Call is already ${waiterCall.status}`);
    }

    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    waiterCall.status = "acknowledged";
    waiterCall.acknowledgedBy = staffId;
    waiterCall.acknowledgedAt = new Date();
    waiterCall.responseTime = Math.floor(
      (waiterCall.acknowledgedAt.getTime() - waiterCall.createdAt.getTime()) / 1000
    );

    if (estimatedTime) {
      waiterCall.estimatedArrival = new Date(Date.now() + Number(estimatedTime) * 60000);
    }

    await waiterCall.save();
    await waiterCall.populate("acknowledgedBy", "name role profileImage");
    await waiterCall.populate("table", "tableNumber tableName location coordinates");

    const payload = {
      ...buildCallPayload(waiterCall),
      acknowledgedBy: waiterCall.acknowledgedBy?.name || "Staff",
      staffRole: waiterCall.acknowledgedBy?.role || "waiter",
      estimatedArrival: waiterCall.estimatedArrival,
    };

    socketManager.emitCallAcknowledged(waiterCall.sessionId, payload);
    emitToStaffRoom("waiter-call:taken", payload);
    await createCustomerNotification(
      waiterCall.sessionId,
      "Waiter request acknowledged",
      getStatusMessage("acknowledged"),
      payload,
    );
    await this.updateCallStatistics();

    return waiterCall;
  } catch (error) {
    logger.error("Acknowledge call failed:", error);
    throw error;
  }
};

exports.completeCall = async (callId, staffId, resolutionNotes = "") => {
  try {
    const waiterCall = await WaiterCall.findOne({ callId });
    if (!waiterCall) throw new Error("Waiter call not found");
    if (waiterCall.status === "completed") throw new Error("Call is already completed");

    const staff = await User.findById(staffId);
    if (!staff) throw new Error("Staff member not found");

    waiterCall.status = "completed";
    waiterCall.completedBy = staffId;
    waiterCall.completedAt = new Date();
    waiterCall.resolutionNotes = resolutionNotes;

    if (waiterCall.acknowledgedAt) {
      waiterCall.resolutionTime = Math.floor(
        (waiterCall.completedAt.getTime() - waiterCall.acknowledgedAt.getTime()) / 1000
      );
    }

    await waiterCall.save();
    await waiterCall.populate("completedBy", "name role profileImage");
    await waiterCall.populate("table", "tableNumber tableName location");

    const payload = {
      ...buildCallPayload(waiterCall),
      completedBy: waiterCall.completedBy?.name || "Staff",
      resolutionNotes: waiterCall.resolutionNotes || "",
    };

    socketManager.emitCallCompleted(waiterCall.sessionId, payload);
    emitToStaffRoom("waiter-call:completed-staff", payload);
    await createCustomerNotification(
      waiterCall.sessionId,
      "Waiter request completed",
      getStatusMessage("completed"),
      payload,
    );
    await this.updateCallStatistics();

    return waiterCall;
  } catch (error) {
    logger.error("Complete call failed:", error);
    throw error;
  }
};

exports.updateCallStatus = async (callId, status, staffId, notes = "") => {
  try {
    const waiterCall = await WaiterCall.findOne({ callId });
    if (!waiterCall) throw new Error("Waiter call not found");

    const validTransitions = {
      pending: ["assigned", "acknowledged", "in_progress", "cancelled"],
      assigned: ["acknowledged", "in_progress", "completed", "cancelled"],
      acknowledged: ["in_progress", "completed", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[waiterCall.status]?.includes(status)) {
      throw new Error(`Invalid status transition from ${waiterCall.status} to ${status}`);
    }

    waiterCall.status = status;
    waiterCall.updatedAt = new Date();

    if (status === "in_progress") {
      waiterCall.startedAt = new Date();
      if (staffId) waiterCall.startedBy = staffId;
    }

    if (notes) {
      waiterCall.notes = waiterCall.notes ? `${waiterCall.notes}\n${notes}` : notes;
    }

    await waiterCall.save();
    await waiterCall.populate("acknowledgedBy", "name role profileImage");
    await waiterCall.populate("startedBy", "name role");
    await waiterCall.populate("table", "tableNumber tableName location");

    const payload = {
      ...buildCallPayload(waiterCall),
      message: getStatusMessage(waiterCall.status),
      startedBy: waiterCall.startedBy?.name,
      notes: waiterCall.notes,
    };

    emitToStaffRoom("waiter-call:status-updated", payload);
    emitToCustomerSession(waiterCall.sessionId, "waiter-call:status-updated", payload);
    await createCustomerNotification(
      waiterCall.sessionId,
      "Waiter request status updated",
      payload.message,
      payload,
    );

    return waiterCall;
  } catch (error) {
    logger.error("Update call status failed:", error);
    throw error;
  }
};

exports.getPendingCalls = async (filters = {}) => {
  try {
    const query = { status: "pending" };

    if (filters.callType) query.callType = filters.callType;
    if (filters.priority) query.priority = filters.priority;
    if (filters.location) query.location = filters.location;

    return await WaiterCall.find(query)
      .populate("table", "tableNumber tableName location coordinates")
      .populate("customer", "name phone")
      .sort({ createdAt: 1 });
  } catch (error) {
    logger.error("Get pending calls failed:", error);
    throw error;
  }
};

exports.getActiveCalls = async () => {
  try {
    return await WaiterCall.find({ status: { $in: ACTIVE_CALL_STATUSES } })
      .populate("table", "tableNumber tableName location coordinates")
      .populate("customer", "name phone")
      .populate("acknowledgedBy", "name role profileImage")
      .populate("assignedTo", "name role")
      .sort({ updatedAt: -1, createdAt: -1 });
  } catch (error) {
    logger.error("Get active calls failed:", error);
    throw error;
  }
};

exports.getSessionActiveCalls = async (sessionId) => {
  try {
    if (!sessionId) {
      return [];
    }

    return await WaiterCall.find({
      sessionId,
      status: { $in: ACTIVE_CALL_STATUSES },
    })
      .populate("table", "tableNumber tableName location coordinates")
      .populate("customer", "name phone")
      .populate("acknowledgedBy", "name role profileImage")
      .populate("assignedTo", "name role")
      .sort({ updatedAt: -1, createdAt: -1 });
  } catch (error) {
    logger.error("Get session active calls failed:", error);
    throw error;
  }
};

exports.getCallsByStaff = async (staffId, period = "today") => {
  try {
    const dateFilter = { updatedAt: getDateRange(period) };

    return await WaiterCall.find({
      $or: [
        { assignedTo: staffId },
        { acknowledgedBy: staffId },
        { startedBy: staffId },
        { completedBy: staffId },
      ],
      ...dateFilter,
    })
      .populate("table", "tableNumber tableName")
      .populate("customer", "name")
      .sort({ updatedAt: -1 });
  } catch (error) {
    logger.error("Get calls by staff failed:", error);
    throw error;
  }
};

exports.getCallStatistics = async (period = "today") => {
  try {
    const dateFilter = { createdAt: getDateRange(period) };

    const grouped = await WaiterCall.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" },
          avgResolutionTime: { $avg: "$resolutionTime" },
        },
      },
    ]);

    const byStatus = grouped.map((item) => ({
      status: item._id,
      count: item.count,
      avgResponseTime: item.avgResponseTime || 0,
      avgResolutionTime: item.avgResolutionTime || 0,
    }));

    const totalCalls = byStatus.reduce((sum, item) => sum + item.count, 0);

    const byType = await WaiterCall.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$callType", count: { $sum: 1 } } },
      { $project: { _id: 0, callType: "$_id", count: 1 } },
    ]);

    const pendingCalls = await WaiterCall.countDocuments({ ...dateFilter, status: "pending" });
    const activeCalls = await WaiterCall.countDocuments({
      ...dateFilter,
      status: { $in: ACTIVE_CALL_STATUSES },
    });

    const avgResponseTime = byStatus.length
      ? byStatus.reduce((sum, item) => sum + item.avgResponseTime, 0) / byStatus.length
      : 0;

    const avgResolutionTime = byStatus.length
      ? byStatus.reduce((sum, item) => sum + item.avgResolutionTime, 0) / byStatus.length
      : 0;

    return {
      totalCalls,
      pendingCalls,
      activeCalls,
      byStatus,
      byType,
      avgResponseTime,
      avgResolutionTime,
      period,
    };
  } catch (error) {
    logger.error("Get call statistics failed:", error);
    throw error;
  }
};

exports.updateCallStatistics = async () => {
  try {
    const stats = await this.getCallStatistics("today");
    socketManager.emitCallStatsUpdate(stats);
  } catch (error) {
    logger.error("Update call statistics failed:", error);
  }
};

exports.getStaffPerformance = async (startDate, endDate) => {
  try {
    return await WaiterCall.aggregate([
      {
        $match: {
          status: "completed",
          acknowledgedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        },
      },
      {
        $group: {
          _id: "$acknowledgedBy",
          totalCalls: { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" },
          avgResolutionTime: { $avg: "$resolutionTime" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "staff",
        },
      },
      { $unwind: "$staff" },
      {
        $project: {
          _id: 0,
          staffId: "$staff._id",
          staffName: "$staff.name",
          staffRole: "$staff.role",
          totalCalls: 1,
          avgResponseTime: 1,
          avgResolutionTime: 1,
        },
      },
      { $sort: { totalCalls: -1 } },
    ]);
  } catch (error) {
    logger.error("Get staff performance failed:", error);
    throw error;
  }
};

exports.getCallDashboard = async () => {
  try {
    const [pendingCalls, activeCalls, statistics, recentCompleted] = await Promise.all([
      this.getPendingCalls(),
      this.getActiveCalls(),
      this.getCallStatistics("today"),
      WaiterCall.find({ status: "completed" })
        .sort({ completedAt: -1 })
        .limit(10)
        .populate("table", "tableNumber tableName")
        .populate("acknowledgedBy", "name")
        .populate("completedBy", "name"),
    ]);

    return {
      pendingCalls,
      activeCalls,
      statistics,
      recentCompleted,
      lastUpdated: new Date(),
    };
  } catch (error) {
    logger.error("Get call dashboard failed:", error);
    throw error;
  }
};

exports.assignCallToStaff = async (callId, staffId, assignerId = null) => {
  try {
    const call = await WaiterCall.findOne({ callId }).populate("customer", "name phone");
    if (!call) throw new Error("Call not found");

    if (!["pending", "assigned"].includes(call.status)) {
      throw new Error(`Cannot assign call that is ${call.status}`);
    }

    const staff = await User.findById(staffId).select("name role");
    if (!staff) throw new Error("Staff member not found");

    const assigner = assignerId ? await User.findById(assignerId).select("name") : null;

    call.assignedTo = staff._id;
    call.assignedBy = assignerId;
    call.assignedAt = new Date();
    call.status = "assigned";
    await call.save();

    await call.populate("assignedTo", "name role");

    const payload = {
      ...buildCallPayload(call),
      assignedTo: call.assignedTo?.name || "Staff",
      assignedBy: assigner?.name || "System",
    };

    emitToStaffRoom("waiter-call:assigned", payload);
    emitToCustomerSession(call.sessionId, "waiter-call:assigned", {
      ...payload,
      message: `${call.assignedTo?.name || "A staff member"} has been assigned to assist you.`,
    });
    await createCustomerNotification(
      call.sessionId,
      "Staff assigned",
      `${call.assignedTo?.name || "A staff member"} has been assigned to assist you.`,
      payload,
    );

    return call;
  } catch (error) {
    logger.error("Assign call to staff failed:", error);
    throw error;
  }
};

exports.getStaffAssignedCalls = async (staffId) => {
  try {
    return await WaiterCall.find({
      assignedTo: staffId,
      status: { $in: ["assigned", "acknowledged", "in_progress"] },
    })
      .populate("table", "tableNumber tableName location")
      .populate("customer", "name")
      .sort({ assignedAt: 1, createdAt: 1 });
  } catch (error) {
    logger.error("Get staff assigned calls failed:", error);
    throw error;
  }
};

exports.cancelCall = async (callId, sessionId, reason = "") => {
  try {
    const waiterCall = await WaiterCall.findOne({ callId, sessionId });
    if (!waiterCall) throw new Error("Waiter call not found");
    if (waiterCall.status === "completed") throw new Error("Cannot cancel completed call");

    waiterCall.status = "cancelled";
    waiterCall.cancelledAt = new Date();
    waiterCall.cancellationReason = reason;
    await waiterCall.save();

    const payload = {
      ...buildCallPayload(waiterCall),
      message: waiterCall.cancellationReason || getStatusMessage("cancelled"),
    };

    emitToStaffRoom("waiter-call:cancelled", payload);
    emitToCustomerSession(sessionId, "waiter-call:cancelled", payload);
    await createCustomerNotification(
      sessionId,
      "Waiter request cancelled",
      payload.message,
      payload,
    );
    await this.updateCallStatistics();

    return waiterCall;
  } catch (error) {
    logger.error("Cancel call failed:", error);
    throw error;
  }
};
