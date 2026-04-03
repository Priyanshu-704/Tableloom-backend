const { logger } = require("./../utils/logger.js");
const Customer = require("../models/Customer");
const sessionManager = require("../utils/sessionManager");
const { verifyQRToken } = require("../utils/qrGenerator");
const mongoose = require("mongoose");
require("dotenv").config({ quiet: true });

const shapeCustomerSessionResponse = (session) => {
  if (!session) {
    return null;
  }

  return {
    _id: session._id,
    sessionId: session.sessionId,
    sessionStatus: session.sessionStatus,
    sessionStart: session.sessionStart,
    sessionEnd: session.sessionEnd || null,
    lastActivity: session.lastActivity || null,
    paymentStatus: session.paymentStatus || "pending",
    paymentMethod: session.paymentMethod || "",
    totalAmount: Number(session.totalAmount || 0),
    name: session.name || "",
    email: session.email || "",
    phone: session.phone || "",
    table: session.table
      ? {
          _id: session.table._id,
          tableNumber: session.table.tableNumber,
          tableName: session.table.tableName || "",
          capacity: session.table.capacity,
          location: session.table.location || "",
          status: session.table.status,
        }
      : null,
    currentOrder: session.currentOrder
      ? {
          _id: session.currentOrder._id,
          orderNumber: session.currentOrder.orderNumber,
          status: session.currentOrder.status,
          totalAmount: Number(session.currentOrder.totalAmount || 0),
          itemsCount: Array.isArray(session.currentOrder.items)
            ? session.currentOrder.items.length
            : 0,
        }
      : null,
  };
};

const getSessionCreationValidationResponse = (error) => {
  const validationMessages = Object.values(error?.errors || {})
    .map((fieldError) => fieldError?.message)
    .filter(Boolean);

  if (error?.name === "ValidationError" && validationMessages.length > 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: validationMessages[0],
        details: validationMessages,
      },
    };
  }

  const errorMessage = String(error?.message || "");
  const knownValidationMessages = [
    "Name is required to start a session",
    "Email is required to start a session",
    "Phone is required to start a session",
    "Invalid email format",
    "Invalid phone number",
    "Table is currently occupied",
    "Table has a pending payment session",
    "Table is not active",
    "Table not found",
    "Table is under maintenance",
  ];

  if (knownValidationMessages.some((message) => errorMessage.includes(message))) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: errorMessage,
      },
    };
  }

  return null;
};

exports.createSessionByScan = async (req, res) => {
  try {
    const { tableId, token, customerData = {} } = req.body;

    if (!tableId || !token) {
      return res.status(400).json({
        success: false,
        message: "Table ID and token are required",
      });
    }

    const verification = await verifyQRToken(tableId, token);

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid or expired QR code",
      });
    }

    try {
      const result = await sessionManager.createCustomerSession(
        tableId,
        token,
        customerData,
      );

      const { session, isExisting } = result;

      return res.status(isExisting ? 200 : 201).json({
        success: true,
        message: isExisting
          ? "Existing active session found"
          : "New customer session created successfully",
        data: {
          sessionId: session.sessionId,
          sessionStatus: session.sessionStatus,
          table: session.table,
          isExistingSession: isExisting,
        },
      });
    } catch (error) {
      const validationResponse = getSessionCreationValidationResponse(error);

      if (validationResponse) {
        return res
          .status(validationResponse.statusCode)
          .json(validationResponse.body);
      }

      throw error;
    }
  } catch (error) {
    logger.error("Session creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create customer session",
    });
  }
};

exports.validateSessionScan = async (req, res) => {
  try {
    const { tableId, token } = req.body;

    if (!tableId || !token) {
      return res.status(400).json({
        success: false,
        message: "Table ID and token are required",
      });
    }

    const verification = await verifyQRToken(tableId, token);

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid or expired QR code",
      });
    }

    return res.status(200).json({
      success: true,
      message: "QR code verified successfully",
      data: {
        table: {
          _id: verification.table._id,
          tableNumber: verification.table.tableNumber,
          tableName: verification.table.tableName || "",
          capacity: verification.table.capacity,
          location: verification.table.location,
          status: verification.table.status,
        },
      },
    });
  } catch (error) {
    logger.error("QR validation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate QR code",
    });
  }
};

exports.getCustomerSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const customerSession = await sessionManager.getCustomerSession(sessionId);

    if (!customerSession) {
      return res.status(404).json({
        success: false,
        message: "Customer session not found or expired",
      });
    }

    await sessionManager.updateSessionActivity(sessionId);

    res.status(200).json({
      success: true,
      data: shapeCustomerSessionResponse(customerSession),
    });
  } catch (error) {
    logger.error(" Get session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get customer session",
      error: error.message,
    });
  }
};

exports.completeSessionOnline = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { paymentData = {} } = req.body;

    const completedSession = await sessionManager.completeSessionOnline(
      sessionId,
      paymentData,
    );

    res.status(200).json({
      success: true,
      message: "Session completed successfully with online payment",
      data: completedSession,
    });
  } catch (error) {
    logger.error(" Complete online error:", error);

    if (error.message.includes("Active customer session not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to complete session with online payment",
      error: error.message,
    });
  }
};

exports.customerLogout = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const loggedOutSession = await sessionManager.customerLogout(sessionId);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
      data: loggedOutSession,
    });
  } catch (error) {
    if (error.message.includes("Active customer session not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("You have an unpaid order")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to logout",
      error: error.message,
    });
  }
};

exports.completeSessionOffline = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;

    const completedSession = await sessionManager.completeSessionOffline(
      sessionId,
      req.user.id,
      notes,
    );

    res.status(200).json({
      success: true,
      message: "Session completed successfully with offline payment",
      data: completedSession,
    });
  } catch (error) {
    logger.error(" Complete offline error:", error);

    if (error.message.includes("Active customer session not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to complete session with offline payment",
      error: error.message,
    });
  }
};

exports.cancelSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const cancelledSession = await sessionManager.cancelSession(
      sessionId,
      reason,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      message: "Session cancelled successfully",
      data: cancelledSession,
    });
  } catch (error) {
    logger.error(" Cancel session error:", error);

    if (error.message.includes("Active customer session not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to cancel session",
      error: error.message,
    });
  }
};


exports.getSessionByTable = async (req, res) => {
  try {
    const { tableId } = req.params;

    const session = await sessionManager.getSessionByTable(tableId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this table",
      });
    }

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(" Get session by table error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get session by table",
      error: error.message,
    });
  }
};

exports.extendSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { minutes = 30 } = req.body;

    const extendedSession = await sessionManager.extendSession(
      sessionId,
      minutes,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      message: `Session extended by ${minutes} minutes`,
      data: extendedSession,
    });
  } catch (error) {
    logger.error(" Extend session error:", error);

    if (error.message.includes("Active session not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to extend session",
      error: error.message,
    });
  }
};

exports.getSessionAnalytics = async (req, res) => {
  try {
    const { period = "today" } = req.query;

    let startDate = new Date();

    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const analytics = await Customer.aggregate([
      {
        $match: {
          $or: [
            { sessionStart: { $gte: startDate } },
            { sessionEnd: { $gte: startDate } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$sessionStart", startDate] },
                    { $eq: ["$isActive", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          activeSessions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$sessionStart", startDate] },
                    { $eq: ["$isActive", true] },
                    {
                      $in: [
                        "$sessionStatus",
                        ["active", "payment_pending"],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completedSessions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$sessionEnd", startDate] },
                    { $eq: ["$isActive", true] },
                    { $eq: ["$sessionStatus", "completed"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$sessionEnd", startDate] },
                    { $eq: ["$sessionStatus", "completed"] },
                  ],
                },
                { $ifNull: ["$totalSpent", 0] },
                0,
              ],
            },
          },
          averageSessionMinutesTotal: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$sessionStart", startDate] },
                    { $eq: ["$sessionStatus", "completed"] },
                    { $ne: ["$sessionEnd", null] },
                  ],
                },
                {
                  $divide: [
                    { $subtract: ["$sessionEnd", "$sessionStart"] },
                    60000,
                  ],
                },
                0,
              ],
            },
          },
          averageSessionMinutesCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$sessionStart", startDate] },
                    { $eq: ["$sessionStatus", "completed"] },
                    { $ne: ["$sessionEnd", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const summary = analytics[0] || {};
    const averageSessionTime =
      summary.averageSessionMinutesCount > 0
        ? summary.averageSessionMinutesTotal /
          summary.averageSessionMinutesCount
        : 0;

    res.status(200).json({
      success: true,
      data: {
        period,
        totalSessions: summary.totalSessions || 0,
        activeSessions: summary.activeSessions || 0,
        completedSessions: summary.completedSessions || 0,
        averageSessionTime,
        revenue: summary.revenue || 0,
      },
    });
  } catch (error) {
    logger.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get analytics",
      error: error.message,
    });
  }
};

exports.generateBillBeforePayment = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await sessionManager.generateBillBeforePayment(sessionId);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Generate bill before payment failed:", error);

    if (error.message.includes("Active customer session not found")) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired",
      });
    }

    if (error.message.includes("No unpaid orders found")) {
      return res.status(400).json({
        success: false,
        message: "No unpaid orders found for this session",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate bill",
    });
  }
};

exports.getSessionWithBill = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = await sessionManager.getSessionWithBill(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired",
      });
    }

    res.status(200).json({
      success: true,
      data: sessionData,
    });
  } catch (error) {
    logger.error("Get session with bill failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get session details",
    });
  }
};

exports.requestBillForSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email, forceNew = false } = req.body;

    const result = await sessionManager.requestBillForSession(
      sessionId,
      email,
      forceNew,
    );

    res.json(result);
  } catch (error) {
    logger.error("Request bill failed:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.markBillAsPaid = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentMethod, transactionId, staffId } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const result = await sessionManager.markBillAsPaid(
      billId,
      {
        method: paymentMethod,
        transactionId: transactionId || `offline_${Date.now()}`,
        gateway: paymentMethod === "online" ? "payment_gateway" : "offline",
      },
      staffId,
    );

    res.json(result);
  } catch (error) {
    logger.error("Mark bill as paid failed:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSessionBillSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = await sessionManager.getSessionWithBill(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        session: sessionData.session,
        summary: sessionData.summary,
        bill: sessionData.bill,
        canRequestBill: sessionData.canRequestBill,
        canCompleteSession: sessionData.canCompleteSession,
      },
    });
  } catch (error) {
    logger.error("Get session bill summary failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get session summary",
    });
  }
};

exports.getAllSessions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      mode,
      tableId,
      search,
      startDate,
      endDate,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(Math.max(1, parseInt(limit)), 100);
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    if (mode === "active") {
      query.isActive = true;
      query.sessionStatus = { $in: ["active", "payment_pending"] };

      if (status) {
        const allowedStatuses = ["active", "payment_pending"];
        if (!allowedStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `Status '${status}' is not valid for active mode. Valid statuses are: ${allowedStatuses.join(", ")}`,
          });
        }
        query.sessionStatus = status;
      }
    } else if (mode === "inactive") {
      query.isActive = false;

      if (status) {
        query.sessionStatus = status;
      } else {
        query.sessionStatus = { $in: ["completed", "cancelled", "timeout"] };
      }
    } else {
      if (status) {
        query.sessionStatus = status;
      }

      if (!query.isActive) {
        query.isActive = true;
      }
    }

    if (tableId) {
      if (!mongoose.Types.ObjectId.isValid(tableId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tableId format",
        });
      }
      query.table = tableId;
    }

    if (startDate || endDate) {
      query.sessionStart = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate format",
          });
        }
        query.sessionStart.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate format",
          });
        }
        end.setHours(23, 59, 59, 999);
        query.sessionStart.$lte = end;
      }

      if (Object.keys(query.sessionStart).length === 0) {
        delete query.sessionStart;
      }
    }

    const sortCriteria =
      mode === "active" ? { lastActivity: -1 } : { sessionStart: -1 };

    let sessionsQuery = Customer.find(query)
      .populate("table", "tableNumber tableName capacity location")
      .populate("currentOrder", "orderNumber status totalAmount items")
      .sort(sortCriteria);

    if (!search) {
      sessionsQuery = sessionsQuery.skip(skip).limit(limitNum);
    }

    let sessions = await sessionsQuery.lean();

    if (search) {
      const keyword = search.trim().toLowerCase();
      sessions = sessions.filter((session) => (
        String(session.sessionId || "").toLowerCase().includes(keyword) ||
        String(session.name || "").toLowerCase().includes(keyword) ||
        String(session.phone || "").toLowerCase().includes(keyword) ||
        String(session.table?.tableNumber || "").toLowerCase().includes(keyword)
      ));
    }

    const total = search ? sessions.length : await Customer.countDocuments(query);
    const paginatedSessions = search
      ? sessions.slice(skip, skip + limitNum)
      : sessions;

    const response = {
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
      data: paginatedSessions,
    };

    return res.status(200).json(response);
  } catch (error) {
    let errorMessage = "Failed to get sessions";
    let statusCode = 500;

    if (error.name === "CastError") {
      errorMessage = "Invalid data format in query parameters";
      statusCode = 400;
    } else if (error.name === "ValidationError") {
      errorMessage = "Validation error in query parameters";
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
