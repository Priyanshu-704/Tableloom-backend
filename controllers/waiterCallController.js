const { logger } = require("./../utils/logger.js");
const waiterCallManager = require("../utils/waiterCallManager");
const WaiterCall = require("../models/WaiterCall");
const { sendSuccess, sendError } = require("../utils/httpResponse");
const { getOrSetCache } = require("../utils/responseCache");

const parsePagination = (page, limit) => {
  const pageNum = Math.max(parseInt(page || 1, 10), 1);
  const limitNum = Math.min(Math.max(parseInt(limit || 20, 10), 1), 100);
  const skip = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, skip };
};

const handleCallError = (res, error, fallbackMessage) => {
  logger.error(fallbackMessage, error);

  if (error.message.includes("not found")) {
    return sendError(res, 404, error.message);
  }

  if (
    error.message.includes("already") ||
    error.message.includes("Invalid status transition") ||
    error.message.includes("Cannot")
  ) {
    return sendError(res, 400, error.message);
  }

  return sendError(
    res,
    500,
    fallbackMessage,
    process.env.NODE_ENV === "development" ? error.message : undefined
  );
};

exports.createWaiterCall = async (req, res) => {
  try {
    const { sessionId, callType, priority, message, coordinates } = req.body;

    if (!sessionId) {
      return sendError(res, 400, "Session ID is required");
    }

    const waiterCall = await waiterCallManager.createWaiterCall(sessionId, {
      callType: callType || "waiter",
      priority: priority || "medium",
      message: message || "",
      coordinates: coordinates || null,
    });

    return sendSuccess(res, 201, "Waiter call created successfully", waiterCall);
  } catch (error) {
    return handleCallError(res, error, "Failed to create waiter call");
  }
};

exports.acknowledgeCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { estimatedTime } = req.body;

    const waiterCall = await waiterCallManager.acknowledgeCall(
      callId,
      req.user.id,
      estimatedTime
    );

    return sendSuccess(res, 200, "Call acknowledged successfully", waiterCall);
  } catch (error) {
    return handleCallError(res, error, "Failed to acknowledge call");
  }
};

exports.completeCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { resolutionNotes } = req.body;

    const waiterCall = await waiterCallManager.completeCall(
      callId,
      req.user.id,
      resolutionNotes
    );

    return sendSuccess(res, 200, "Call completed successfully", waiterCall);
  } catch (error) {
    return handleCallError(res, error, "Failed to complete call");
  }
};

exports.cancelCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { sessionId, reason } = req.body;

    if (!sessionId) {
      return sendError(res, 400, "Session ID is required");
    }

    const waiterCall = await waiterCallManager.cancelCall(callId, sessionId, reason || "");
    return sendSuccess(res, 200, "Call cancelled successfully", waiterCall);
  } catch (error) {
    return handleCallError(res, error, "Failed to cancel call");
  }
};

exports.getPendingCalls = async (req, res) => {
  try {
    const { location, callType, priority } = req.query;
    const filters = {};

    if (location) filters.location = location;
    if (callType) filters.callType = callType;
    if (priority) filters.priority = priority;

    const pendingCalls = await waiterCallManager.getPendingCalls(filters);
    return sendSuccess(res, 200, null, pendingCalls, { count: pendingCalls.length });
  } catch (error) {
    return handleCallError(res, error, "Failed to get pending calls");
  }
};

exports.getActiveCalls = async (_req, res) => {
  try {
    const activeCalls = await waiterCallManager.getActiveCalls();
    return sendSuccess(res, 200, null, activeCalls, { count: activeCalls.length });
  } catch (error) {
    return handleCallError(res, error, "Failed to get active calls");
  }
};

exports.getSessionActiveCalls = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return sendError(res, 400, "Session ID is required");
    }

    const activeCalls = await waiterCallManager.getSessionActiveCalls(sessionId);
    return sendSuccess(res, 200, null, activeCalls, { count: activeCalls.length });
  } catch (error) {
    return handleCallError(res, error, "Failed to get session active calls");
  }
};

exports.getAllCalls = async (req, res) => {
  try {
    const {
      status,
      callType,
      priority,
      startDate,
      endDate,
      location,
      staffId,
      search,
      page = 1,
      limit = 20,
    } =
      req.query;

    const { pageNum, limitNum, skip } = parsePagination(page, limit);

    const query = {};
    if (status) query.status = status;
    if (callType) query.callType = callType;
    if (priority) query.priority = priority;
    if (location) query.location = location;

    if (staffId) {
      query.$or = [
        { assignedTo: staffId },
        { acknowledgedBy: staffId },
        { completedBy: staffId },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const cacheKey = `waiter-call:list:${req.tenantId || "default"}:${req.originalUrl}`;
    const payload = await getOrSetCache(cacheKey, 8000, async () => {
      let callsQuery = WaiterCall.find(query)
        .populate("table", "tableNumber tableName location coordinates")
        .populate("customer", "name phone")
        .populate("acknowledgedBy", "name role profileImage")
        .populate("assignedTo", "name role")
        .populate("startedBy", "name role")
        .populate("completedBy", "name role")
        .populate("assignedBy", "name role")
        .sort({ createdAt: -1 })
        .lean();

      if (!search) {
        callsQuery = callsQuery.skip(skip).limit(limitNum);
      }

      let calls = await callsQuery;

      if (search) {
        const keyword = search.trim().toLowerCase();
        calls = calls.filter((call) => (
          String(call.callId || "").toLowerCase().includes(keyword) ||
          String(call.table?.tableNumber || call.tableNumber || "")
            .toLowerCase()
            .includes(keyword) ||
          String(call.customer?.name || call.customerName || "")
            .toLowerCase()
            .includes(keyword) ||
          String(call.message || "").toLowerCase().includes(keyword) ||
          String(call.location || call.table?.location || "")
            .toLowerCase()
            .includes(keyword)
        ));
      }

      const total = search ? calls.length : await WaiterCall.countDocuments(query);
      const paginatedCalls = search ? calls.slice(skip, skip + limitNum) : calls;

      return {
        data: paginatedCalls,
        count: paginatedCalls.length,
        total,
        pagination: {
          page: pageNum,
          pages: Math.ceil(total / limitNum),
        },
      };
    });

    return sendSuccess(res, 200, null, payload.data, {
      count: payload.count,
      total: payload.total,
      pagination: payload.pagination,
    });
  } catch (error) {
    return handleCallError(res, error, "Failed to get calls");
  }
};

exports.getCallStatistics = async (req, res) => {
  try {
    const { period = "today" } = req.query;
    const stats = await waiterCallManager.getCallStatistics(period);
    return sendSuccess(res, 200, null, stats);
  } catch (error) {
    return handleCallError(res, error, "Failed to get call statistics");
  }
};

exports.getStaffPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return sendError(res, 400, "Start date and end date are required");
    }

    const performance = await waiterCallManager.getStaffPerformance(startDate, endDate);
    return sendSuccess(res, 200, null, performance);
  } catch (error) {
    return handleCallError(res, error, "Failed to get staff performance");
  }
};

exports.getCallDashboard = async (_req, res) => {
  try {
    const dashboardData = await waiterCallManager.getCallDashboard();
    return sendSuccess(res, 200, null, dashboardData);
  } catch (error) {
    return handleCallError(res, error, "Failed to get dashboard data");
  }
};

exports.updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return sendError(res, 400, "Status is required");
    }

    const updatedCall = await waiterCallManager.updateCallStatus(callId, status, req.user.id, notes);
    return sendSuccess(res, 200, "Call status updated successfully", updatedCall);
  } catch (error) {
    return handleCallError(res, error, "Failed to update call status");
  }
};

exports.assignCallToStaff = async (req, res) => {
  try {
    const { callId } = req.params;
    const { staffId } = req.body;

    if (!staffId) {
      return sendError(res, 400, "Staff ID is required");
    }

    const assignedCall = await waiterCallManager.assignCallToStaff(callId, staffId, req.user.id);
    return sendSuccess(res, 200, "Call assigned successfully", assignedCall);
  } catch (error) {
    return handleCallError(res, error, "Failed to assign call");
  }
};

exports.getCallsByStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { period = "today" } = req.query;

    const calls = await waiterCallManager.getCallsByStaff(staffId, period);
    return sendSuccess(res, 200, null, calls, { count: calls.length });
  } catch (error) {
    return handleCallError(res, error, "Failed to get staff calls");
  }
};

exports.getMyAssignedCalls = async (req, res) => {
  try {
    const assignedCalls = await waiterCallManager.getStaffAssignedCalls(req.user.id);
    return sendSuccess(res, 200, null, assignedCalls, { count: assignedCalls.length });
  } catch (error) {
    return handleCallError(res, error, "Failed to get assigned calls");
  }
};

exports.getAvailableStaff = async (_req, res) => {
  try {
    const availableStaff = await waiterCallManager.getAvailableStaff();
    return sendSuccess(res, 200, null, availableStaff, { count: availableStaff.length });
  } catch (error) {
    return handleCallError(res, error, "Failed to get available staff");
  }
};
