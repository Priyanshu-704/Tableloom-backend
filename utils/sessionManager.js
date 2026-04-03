const { logger } = require("./logger.js");
const crypto = require("crypto");
const Customer = require("../models/Customer");
const User = require("../models/User");
const Table = require("../models/Table");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const billManager = require("./billManager");
const Bill = require("../models/Bill");
const path = require("path");
require("dotenv").config({ quiet: true });
const {
  getCacheEntry,
  setCacheEntry,
} = require("./responseCache");
const { createTaxSnapshot } = require("./taxCalculator");

const SESSION_TIMEOUT_MINUTES = 60;
const SESSION_ACTIVITY_WRITE_TTL_MS = 30 * 1000;

const generateSessionId = () => {
  return `sess_${crypto.randomBytes(16).toString("hex")}_${Date.now()}`;
};

exports.createCustomerSession = async (tableId, token, customerData = {}) => {
  try {
    const { name, email, phone } = customerData;

    if (!name) {
      throw new Error("Name is required to start a session");
    }
    if (!email) {
      throw new Error("Email is required to start a session");
    }

    if (!phone) {
      throw new Error("Phone is required to start a session");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error("Invalid phone number");
    }

    const table = await Table.findById(tableId);

    if (!table) {
      throw new Error("Table not found");
    }

    if (!table.isActive) {
      throw new Error("Table is not active");
    }

    const existingSession = await Customer.findOne({
      table: tableId,
      sessionStatus: { $in: ["active", "payment_pending"] },
      isActive: true,
    }).populate("table", "tableNumber tableName capacity location");

    if (existingSession) {
      const timeoutMinutes = SESSION_TIMEOUT_MINUTES;
      const timeoutTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      if (existingSession.lastActivity < timeoutTime) {
        existingSession.sessionStatus = "timeout";
        existingSession.sessionEnd = new Date();
        existingSession.notes = "Session timed out due to inactivity";
        await existingSession.save();

        table.status = "cleaning";
        table.currentCustomer = null;
        await table.save();
      } else {
        return {
          session: existingSession,
          isExisting: true,
        };
      }
    }

    if (table.status === "occupied") {
      throw new Error("Table is currently occupied");
    }

    if (table.status === "maintenance") {
      throw new Error("Table is under maintenance");
    }
    const sessionId = generateSessionId();
    const customer = await Customer.create({
      sessionId,
      table: tableId,
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      sessionStart: new Date(),
      lastActivity: new Date(),
      sessionStatus: "active",
      isActive: true,
    });

    table.status = "occupied";
    table.currentCustomer = customer._id;
    table.lastOccupied = new Date();
    await table.save();

    const populatedCustomer = await Customer.findById(customer._id);

    return {
      session: populatedCustomer,
      isExisting: false,
    };
  } catch (error) {
    throw error;
  }
};

exports.getCustomerSession = async (sessionId) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    })
      .populate("table", "tableNumber tableName capacity location status")
      .populate("currentOrder", "orderNumber status totalAmount items");

    if (!customer) {
      logger.info("Session not found or expired:", sessionId);
      return null;
    }

    const timeoutMinutes = SESSION_TIMEOUT_MINUTES;
    const timeoutTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    if (customer.lastActivity < timeoutTime) {
      customer.sessionStatus = "timeout";
      customer.sessionEnd = new Date();
      customer.notes = "Session timed out due to inactivity";
      await customer.save();

      if (customer.table) {
        customer.table.status = "cleaning";
        customer.table.currentCustomer = null;
        await customer.table.save();
      }

      return null;
    }

    return customer;
  } catch (error) {
    throw error;
  }
};

exports.updateSessionActivity = async (sessionId) => {
  try {
    const activityCacheKey = `session:activity:${sessionId}`;
    if (getCacheEntry(activityCacheKey)) {
      return null;
    }

    const customer = await Customer.findOneAndUpdate(
      {
        sessionId,
        isActive: true,
        sessionStatus: { $in: ["active", "payment_pending"] },
      },
      {
        lastActivity: new Date(),
        $inc: { activityCount: 1 },
      },
      { new: true },
    );

    if (!customer) {
      return null;
    }

    setCacheEntry(activityCacheKey, true, SESSION_ACTIVITY_WRITE_TTL_MS);
    return customer;
  } catch (error) {
    throw error;
  }
};

exports.customerLogout = async (sessionId) => {
  try {
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error("Valid sessionId is required");
    }
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: "active",
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    if (customer.currentOrder) {
      const order = await Order.findById(customer.currentOrder);
      if (
        order &&
        order.status !== "completed" &&
        order.status !== "cancelled"
      ) {
        throw new Error(
          "You have an unpaid order. Please complete payment first.",
        );
      }
    }

    customer.sessionStatus = "completed";
    customer.sessionEnd = new Date();
    customer.notes = "Customer logged out";

    await customer.save();
    if (customer.table) {
      customer.table.status = "available";
      customer.table.currentCustomer = null;
      customer.table.currentOrder = null;
      await customer.table.save();
    }

    return customer;
  } catch (error) {
    throw error;
  }
};

async function calculateSessionTotal(customerId) {
  try {
    const orders = await Order.find({
      customerId,
      status: { $in: ["active", "pending", "preparing"] },
    });

    const total = orders.reduce((sum, order) => {
      return sum + (order.totalAmount || 0);
    }, 0);

    return total;
  } catch (error) {
    return 0;
  }
}

exports.cancelSession = async (sessionId, reason = "", cancelledBy = null) => {
  try {
    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      sessionId.trim().length === 0
    ) {
      throw {
        message: "Valid sessionId is required",
        statusCode: 400,
        errorType: "validation_error",
      };
    }

    const trimmedSessionId = sessionId.trim();
    const trimmedReason = reason ? reason.trim() : "";

    let cancelledByUser = null;
    if (cancelledBy) {
      if (!mongoose.Types.ObjectId.isValid(cancelledBy)) {
        throw {
          message: "Invalid cancelledBy ID format",
          statusCode: 400,
          errorType: "validation_error",
        };
      }

      cancelledByUser = await User.findById(cancelledBy);
      if (!cancelledByUser) {
        throw {
          message: "User who is cancelling not found",
          statusCode: 404,
          errorType: "user_not_found",
        };
      }
    }

    if (cancelledByUser) {
      if (!cancelledByUser.hasPermission("SESSION_CANCEL")) {
        throw {
          message: "You don't have permission to cancel sessions",
          statusCode: 403,
        };
      }
    }
    if (trimmedReason && trimmedReason.length > 500) {
      throw {
        message: "Reason cannot exceed 500 characters",
        statusCode: 400,
        errorType: "validation_error",
      };
    }

    const forbiddenPatterns = [
      /<script>/i,
      /javascript:/i,
      /onclick/i,
      /onload/i,
    ];
    if (forbiddenPatterns.some((pattern) => pattern.test(trimmedReason))) {
      throw {
        message: "Reason contains potentially harmful content",
        statusCode: 400,
        errorType: "security_error",
      };
    }

    const customer = await Customer.findOne({
      sessionId: trimmedSessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      const existingSession = await Customer.findOne({
        sessionId: trimmedSessionId,
      });
      if (existingSession) {
        if (existingSession.sessionStatus === "cancelled") {
          throw {
            message: "Session is already cancelled",
            statusCode: 400,
            errorType: "already_cancelled",
          };
        }
        if (existingSession.sessionStatus === "completed") {
          throw {
            message: "Cannot cancel a completed session",
            statusCode: 400,
            errorType: "invalid_operation",
          };
        }
        if (!existingSession.isActive) {
          throw {
            message: "Session is not active",
            statusCode: 400,
            errorType: "inactive_session",
          };
        }
      }

      throw {
        message: "Active customer session not found",
        statusCode: 404,
        errorType: "session_not_found",
      };
    }

    customer.sessionStatus = "cancelled";
    customer.sessionEnd = new Date();
    customer.isActive = false;
    customer.cancellationReason = trimmedReason;
    customer.cancelledAt = new Date();

    if (cancelledByUser) {
      customer.cancelledBy = cancelledByUser._id;
      customer.cancelledByName = cancelledByUser.name;
      customer.cancelledByRole = cancelledByUser.role;
      customer.notes = `Session cancelled by ${cancelledByUser.role}: ${cancelledByUser.name}. ${trimmedReason}`;
    } else {
      customer.notes = `Session cancelled automatically. ${trimmedReason}`;
    }

    customer.cancellationMetadata = {
      sessionStart: customer.sessionStart,
      hadTable: !!customer.table,
      hadOrders: customer.totalAmount > 0,
      originalStatus: customer.sessionStatus,
      timestamp: new Date(),
    };

    await customer.save();

    if (customer.table) {
      customer.table.status = "available";
      customer.table.currentCustomer = null;
      customer.table.currentOrder = null;
      customer.table.lastCleaned = new Date();
      customer.table.lastCleanedReason = "session_cancelled";

      if (cancelledByUser) {
        customer.table.cleanedBy = cancelledByUser._id;
        customer.table.cleanedByName = cancelledByUser.name;
      }

      await customer.table.save();
    }

    const activeOrders = await Order.find({
      customerId: customer._id,
      status: { $in: ["pending", "preparing", "ready"] },
    });

    if (activeOrders.length > 0) {
      await Order.updateMany(
        {
          customerId: customer._id,
          status: { $in: ["pending", "preparing", "ready"] },
        },
        {
          $set: {
            status: "cancelled",
            cancellationReason: `Session cancelled: ${trimmedReason}`,
            cancelledAt: new Date(),
            cancelledBy: cancelledByUser?._id,
          },
        },
      );
    }

    return {
      session: {
        id: customer._id,
        sessionId: customer.sessionId,
        status: customer.sessionStatus,
        startTime: customer.sessionStart,
        endTime: customer.sessionEnd,
        cancellationReason: trimmedReason,
        cancelledBy: cancelledByUser
          ? {
              id: cancelledByUser._id,
              name: cancelledByUser.name,
              role: cancelledByUser.role,
            }
          : null,
        cancellationTime: customer.cancelledAt,
      },
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      },

      ordersCancelled: activeOrders.length,
      timestamp: new Date(),
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw {
      success: false,
      statusCode: 500,
      message: error.message || "Failed to cancel session",
      errorType: "server_error",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
};

exports.getSessionByTable = async (tableId) => {
  try {
    const customer = await Customer.findOne({
      table: tableId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    })
      .populate("table", "tableNumber tableName capacity location status")
      .populate("currentOrder", "orderNumber status totalAmount");

    return customer;
  } catch (error) {
    logger.error("Get session by table failed:", error);
    throw error;
  }
};

exports.extendSession = async (sessionId, minutes = 30, staffId) => {
  try {
    let staff = null;
    if (staffId) {
      staff = await User.findById(staffId);
      if (staff && !staff.hasPermission("SESSION_UPDATE")) {
        throw new Error("You don't have permission to extend sessions");
      }
    }
    const customer = await Customer.findOneAndUpdate(
      {
        sessionId,
        isActive: true,
        sessionStatus: "active",
      },
      {
        lastActivity: new Date(Date.now() + minutes * 60 * 1000),
      },
      { new: true },
    );

    if (!customer) {
      throw new Error("Active session not found");
    }

    return customer;
  } catch (error) {
    throw error;
  }
};

exports.getSessionStatistics = async (staffId) => {
  try {
    if (staffId) {
      const staff = await User.findById(staffId);
      if (staff && !staff.hasPermission("SESSION_STATISTICS")) {
        throw new Error("You don't have permission to view session statistics");
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalSessions,
      activeSessions,
      completedToday,
      averageDuration,
      revenueToday,
    ] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      Customer.countDocuments({
        sessionStatus: { $in: ["active", "payment_pending"] },
        isActive: true,
      }),
      Customer.countDocuments({
        sessionStatus: "completed",
        sessionEnd: { $gte: today },
        isActive: true,
      }),
      Customer.aggregate([
        {
          $match: {
            sessionStatus: "completed",
            sessionStart: { $exists: true },
            sessionEnd: { $exists: true },
          },
        },
        {
          $addFields: {
            duration: {
              $divide: [{ $subtract: ["$sessionEnd", "$sessionStart"] }, 60000],
            },
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: "$duration" },
          },
        },
      ]),
      Customer.aggregate([
        {
          $match: {
            sessionStatus: "completed",
            sessionEnd: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalSpent" },
          },
        },
      ]),
    ]);

    return {
      totalSessions,
      activeSessions,
      completedToday,
      averageDuration: averageDuration[0]?.average || 0,
      revenueToday: revenueToday[0]?.total || 0,
    };
  } catch (error) {
    logger.error("Session statistics failed:", error);
    throw error;
  }
};

exports.getInactiveSessions = async (
  timeoutMinutes = SESSION_TIMEOUT_MINUTES,
) => {
  try {
    const timeoutTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const inactiveSessions = await Customer.find({
      sessionStatus: "active",
      lastActivity: { $lt: timeoutTime },
      isActive: true,
    }).populate("table");

    return inactiveSessions;
  } catch (error) {
    throw error;
  }
};

exports.timeoutInactiveSessions = async (
  timeoutMinutes = SESSION_TIMEOUT_MINUTES,
) => {
  try {
    const inactiveSessions = await this.getInactiveSessions(timeoutMinutes);
    const results = [];

    for (const session of inactiveSessions) {
      try {
        session.sessionStatus = "timeout";
        session.sessionEnd = new Date();
        session.notes = "Session timed out due to inactivity";
        await session.save();

        if (session.table) {
          session.table.status = "cleaning";
          session.table.currentCustomer = null;
          session.table.currentOrder = null;
          await session.table.save();
        }

        results.push({
          sessionId: session.sessionId,
          table: session.table?.tableNumber,
          success: true,
          message: "Session timed out",
        });
      } catch (error) {
        results.push({
          sessionId: session.sessionId,
          table: session.table?.tableNumber,
          success: false,
          error: error.message,
        });
      }
    }
    return results;
  } catch (error) {
    throw error;
  }
};

exports.completeSessionOnline = async (sessionId, paymentData = {}) => {
  try {
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error("Valid sessionId is required");
    }

    if (!paymentData || typeof paymentData !== "object") {
      throw new Error("Payment data is required");
    }

    if (!paymentData.transactionId) {
      throw new Error("Payment Transaction ID is required");
    }

    let bill = await Bill.findOne({
      sessionId,
      paymentStatus: "pending",
      billStatus: { $in: ["draft", "sent", "viewed"] },
    });

    let isNewBill = false;

    if (!bill) {
      logger.info("No existing bill found, generating new bill...");

      const customerForBill = await Customer.findOne({
        sessionId,
        isActive: true,
        sessionStatus: { $in: ["active", "payment_pending"] },
      }).populate("table");

      if (!customerForBill) {
        throw new Error(
          "Active customer session not found for bill generation",
        );
      }

      const orders = await Order.find({
        customer: customerForBill._id,
        paymentStatus: { $ne: "paid" },
      })
        .populate("items.menuItem", "name description category")
        .populate("items.sizeId", "name code");

      if (orders.length === 0) {
        throw new Error("No orders found for bill generation");
      }

      let subtotal = 0;
      let taxAmount = 0;
      let serviceCharge = 0;
      let discountAmount = 0;
      const allItems = [];

      orders.forEach((order) => {
        subtotal += order.subtotal || 0;
        taxAmount += order.taxAmount || 0;
        serviceCharge += order.serviceCharge || 0;
        discountAmount += order.discountAmount || 0;

        order.items.forEach((item) => {
          allItems.push({
            menuItem: item.menuItem,
            name: item.menuItem?.name || "Unknown Item",
            size: item.sizeName || "Regular",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          });
        });
      });

      const totalAmount = orders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0,
      );
      const taxSnapshot = createTaxSnapshot({
        taxRate: orders[0]?.taxRate,
        serviceCharge: orders[0]?.serviceChargeRate,
        taxInclusive: orders[0]?.taxInclusive,
        currency: orders[0]?.currency,
        currencySymbol: orders[0]?.currencySymbol,
      });

      bill = await Bill.create({
        orderId: orders[0]._id,
        sessionId,
        customerId: customerForBill._id,
        tableId: customerForBill.table?._id,
        subtotal,
        taxAmount,
        taxRate: taxSnapshot.taxRate,
        taxInclusive: taxSnapshot.taxInclusive,
        serviceCharge,
        serviceChargeRate: taxSnapshot.serviceChargeRate,
        discountAmount,
        totalAmount,
        currency: taxSnapshot.currency,
        currencySymbol: taxSnapshot.currencySymbol,
        items: allItems,
        customerEmail: customerForBill.email,
        customerPhone: customerForBill.phone,
        customerName: customerForBill.name,
        paymentStatus: "pending",
        billStatus: "draft",
        metadata: {
          orderCount: orders.length,
          orderNumbers: orders.map((o) => o.orderNumber),
          customerSessionStart: customerForBill.sessionStart,
          tableNumber: customerForBill.table?.tableNumber,
        },
      });

      try {
        await billManager.generateAndSavePDF(bill);
      } catch (pdfError) {
        logger.warn(
          "PDF generation failed, continuing without PDF:",
          pdfError,
        );
      }

      isNewBill = true;
      logger.info("New bill created:", bill.billNumber);
    }

    const customer = await Customer.findOne({
      sessionId,
      $or: [
        {
          isActive: true,
          sessionStatus: { $in: ["active", "payment_pending"] },
        },
        {
          isActive: false,
          sessionStatus: "completed",
          retainSessionData: true,
        },
      ],
    }).populate("table");

    if (!customer) {
      throw new Error("Customer session not found");
    }

    const resolvedPaymentMethod = paymentData.paymentMethod || "online";
    const resolvedGateway =
      paymentData.gateway ||
      (resolvedPaymentMethod === "online" ? "online" : resolvedPaymentMethod);

    if (bill) {
      bill.paymentStatus = "paid";
      bill.paymentMethod = resolvedPaymentMethod;
      bill.transactionId = paymentData.transactionId;
      bill.paidAt = new Date();
      bill.paymentGateway = resolvedGateway;
      bill.billStatus = "paid";
      bill.finalizedAt = new Date();
      await bill.save();

      try {
        await billManager.generateAndSavePDF(bill);
      } catch (pdfError) {
        logger.warn("Failed to refresh paid bill PDF:", pdfError);
      }

      if (bill.customerEmail) {
        try {
          await billManager.sendPaymentConfirmationEmail(bill, {
            method: resolvedPaymentMethod,
            transactionId: paymentData.transactionId,
            gateway: resolvedGateway,
          });
        } catch (emailError) {
          logger.warn("Payment confirmation email failed:", emailError);
        }
      }
    }

    customer.sessionStatus = "completed";
    customer.sessionEnd = new Date();
    customer.paymentMethod = resolvedPaymentMethod;
    customer.paymentReference = paymentData.transactionId;
    customer.paymentStatus = paymentData.status || "paid";
    customer.retainSessionData = true;
    customer.retainUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    customer.isAccessibleForBilling = true;
    customer.totalAmount = bill ? bill.totalAmount : customer.totalAmount;

    if (paymentData.amount) {
      customer.totalSpent += paymentData.amount;
    } else if (bill) {
      customer.totalSpent += bill.totalAmount;
    }

    await customer.save();

    if (customer.table) {
      customer.table.status = "cleaning";
      customer.table.currentCustomer = null;
      customer.table.currentOrder = null;
      customer.table.lastCleaned = new Date();
      await customer.table.save();
    }

    await Order.updateMany(
      {
        customer: customer._id,
        paymentStatus: { $ne: "paid" },
      },
      {
          $set: {
            paymentStatus: "paid",
            paymentMethod: resolvedPaymentMethod,
            paymentDetails: {
              transactionId: paymentData.transactionId,
              paymentGateway: resolvedGateway,
              paidAmount: bill ? bill.totalAmount : paymentData.amount,
              paidAt: new Date(),
            },
          status: "completed",
        },
      },
    );

    return {
      success: true,
      message: "Payment successful and session completed",
      data: {
        session: {
          id: customer._id,
          sessionId: customer.sessionId,
          status: customer.sessionStatus,
          startTime: customer.sessionStart,
          endTime: customer.sessionEnd,
          totalAmount: bill ? bill.totalAmount : customer.totalAmount,
          paymentMethod: customer.paymentMethod,
          paymentStatus: customer.paymentStatus,
          paymentReference: customer.paymentReference,
        },
        customer: {
          id: customer._id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          totalSpent: customer.totalSpent,
        },
        bill: bill
          ? {
              id: bill._id,
              billNumber: bill.billNumber,
              totalAmount: bill.totalAmount,
              paymentStatus: bill.paymentStatus,
              pdfUrl: bill.pdfUrl,
            }
          : null,
        billDownloadUrl: bill?.pdfUrl || null,
        table: customer.table
          ? {
              id: customer.table._id,
              tableNumber: customer.table.tableNumber,
              status: customer.table.status,
            }
          : null,
        timestamp: customer.sessionEnd,
      },
    };
  } catch (error) {
    logger.error("Complete session online failed:", error);
    throw {
      success: false,
      statusCode: 500,
      message: error.message || "Failed to complete session online",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
};

exports.completeSessionOffline = async (sessionId, staffId, notes = "") => {
  try {
    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      sessionId.trim().length === 0
    ) {
      throw {
        message: "Valid sessionId is required",
        statusCode: 400,
      };
    }

    if (
      !staffId ||
      typeof staffId !== "string" ||
      staffId.trim().length === 0
    ) {
      throw {
        message: "Valid staffId is required",
        statusCode: 400,
      };
    }

    const trimmedSessionId = sessionId.trim();
    const trimmedStaffId = staffId.trim();
    const trimmedNotes = notes ? notes.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(trimmedStaffId)) {
      throw {
        message: "Invalid staffId format",
        statusCode: 400,
      };
    }

    const staff = await User.findById(trimmedStaffId);
    if (!staff) {
      throw {
        message: "Staff member not found",
        statusCode: 404,
      };
    }

    if (!staff.isActive) {
      throw {
        message: "Staff member is not active",
        statusCode: 403,
      };
    }

    if (staff.role === "customer") {
      throw {
        message:
          "Customers cannot process payments. Only staff members are allowed.",
        statusCode: 403,
      };
    }

    if (!staff.hasPermission("cart_checkout")) {
      throw {
        message: "You don't have permission to process payments",
        statusCode: 403,
      };
    }
    if (!staff.hasPermission("SESSION_COMPLETE_OFFLINE")) {
      throw {
        message: "You don't have permission to complete sessions offline",
        statusCode: 403,
      };
    }

    const customer = await Customer.findOne({
      sessionId: trimmedSessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      throw {
        message: "Active customer session not found",
        statusCode: 404,
      };
    }

    const pendingBill = await Bill.findOne({
      sessionId: trimmedSessionId,
      paymentStatus: "pending",
      billStatus: { $in: ["draft", "sent", "viewed"] },
    });

    let billPaid = false;
    let billData = null;

    if (pendingBill) {
      billPaid = true;
      pendingBill.paymentStatus = "paid";
      pendingBill.paymentMethod = "cash";
      pendingBill.paidAt = new Date();
      pendingBill.billStatus = "paid";
      pendingBill.finalizedAt = new Date();
      await pendingBill.save();

      billData = pendingBill;

      if (pendingBill.customerEmail) {
        await billManager.sendPaymentConfirmationEmail(pendingBill, {
          method: "offline",
          processedBy: staff.name,
        });
      }
    }

    if (!customer.totalAmount) {
      customer.totalAmount = await calculateSessionTotal(customer._id);
      if (pendingBill && !customer.totalAmount) {
        customer.totalAmount = pendingBill.totalAmount;
      }
    }

    customer.sessionStatus = "completed";
    customer.sessionEnd = new Date();
    customer.paymentMethod = "cash";
    customer.paymentStatus = "paid";
    customer.closedBy = staff._id;
    customer.notes =
      trimmedNotes ||
      `Payment completed offline by ${staff.role}: ${staff.name}`;
    customer.closedByName = staff.name;
    customer.closedByRole = staff.role;

    if (customer.totalAmount) {
      customer.totalSpent += customer.totalAmount;
    }

    await customer.save();

    if (customer.table) {
      customer.table.status = "cleaning";
      customer.table.currentCustomer = null;
      customer.table.currentOrder = null;
      customer.table.lastCleaned = new Date();
      customer.table.cleanedBy = staff._id;
      customer.table.cleanedByName = staff.name;
      await customer.table.save();
    }

    await Order.updateMany(
      {
        customer: customer._id,
        paymentStatus: { $ne: "paid" },
      },
      {
        $set: {
          paymentStatus: "paid",
          paymentMethod: "cash",
          paymentDetails: {
            paidAmount: pendingBill
              ? pendingBill.totalAmount
              : customer.totalAmount,
            paidAt: new Date(),
            processedBy: staff.name,
          },
          status: "completed",
        },
      },
    );

    return {
      success: true,
      statusCode: 200,
      message: "Payment processed successfully",
      data: {
        session: {
          id: customer._id,
          sessionId: customer.sessionId,
          status: customer.sessionStatus,
          startTime: customer.sessionStart,
          endTime: customer.sessionEnd,
          totalAmount: pendingBill
            ? pendingBill.totalAmount
            : customer.totalAmount,
          paymentMethod: customer.paymentMethod,
          paymentStatus: customer.paymentStatus,
        },
        customer: {
          id: customer._id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          totalSpent: customer.totalSpent,
        },
        staff: {
          id: staff._id,
          name: staff.name,
          role: staff.role,
        },
        bill: billPaid
          ? {
              id: pendingBill._id,
              billNumber: pendingBill.billNumber,
              totalAmount: pendingBill.totalAmount,
              paymentStatus: pendingBill.paymentStatus,
            }
          : null,
        table: customer.table
          ? {
              id: customer.table._id,
              tableNumber: customer.table.tableNumber,
              status: customer.table.status,
            }
          : null,
        timestamp: customer.sessionEnd,
        notes: customer.notes,
      },
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw {
      success: false,
      statusCode: 500,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
};

async function calculateSessionTotal(customerId) {
  try {
    const orders = await Order.find({
      customer: customerId,
      status: {
        $in: [
          "completed",
          "served",
          "pending",
          "confirmed",
          "preparing",
          "ready",
        ],
      },
      paymentStatus: { $ne: "paid" },
    });

    const total = orders.reduce((sum, order) => {
      return sum + (order.totalAmount || 0);
    }, 0);

    return total;
  } catch (error) {
    return 0;
  }
}

exports.getSessionWithBill = async (sessionId) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      $or: [
        {
          isActive: true,
          sessionStatus: { $in: ["active", "payment_pending"] },
        },
        {
          retainSessionData: true,
          isAccessibleForBilling: true,
          sessionStatus: "completed",
        },
      ],
    })
      .populate("table", "tableNumber tableName capacity location status")
      .populate("currentOrder", "orderNumber status totalAmount items");

    if (!customer) {
      return null;
    }

    const bill = await Bill.findOne({
      sessionId,
      ...(customer.sessionStatus === "completed"
        ? {}
        : {
            paymentStatus: "pending",
            billStatus: { $in: ["draft", "sent", "viewed"] },
          }),
    }).sort({ createdAt: -1 });

    const orders = await Order.find({
      customer: customer._id,
      paymentStatus: { $ne: "paid" },
    })
      .populate("items.menuItem", "name")
      .populate("items.sizeId", "name");

    let subtotal = 0;
    let taxAmount = 0;
    let serviceCharge = 0;
    let discountAmount = 0;
    let totalAmount = 0;
    let itemsCount = 0;

    orders.forEach((order) => {
      subtotal += order.subtotal || 0;
      taxAmount += order.taxAmount || 0;
      serviceCharge += order.serviceCharge || 0;
      discountAmount += order.discountAmount || 0;
      totalAmount += order.totalAmount || 0;
      itemsCount += order.items.length || 0;
    });

    return {
      session: customer,
      bill: bill,
      orders: orders,
      summary: {
        orderCount: orders.length || bill?.metadata?.get?.("orderCount") || bill?.metadata?.orderCount || 0,
        itemsCount: itemsCount || bill?.items?.length || 0,
        subtotal: subtotal || bill?.subtotal || 0,
        taxAmount: taxAmount || bill?.taxAmount || 0,
        serviceCharge: serviceCharge || bill?.serviceCharge || 0,
        discountAmount: discountAmount || bill?.discountAmount || 0,
        totalAmount: totalAmount || bill?.totalAmount || 0,
      },
      hasActiveBill: !!bill,
      canRequestBill:
        customer.sessionStatus === "active" ||
        customer.sessionStatus === "payment_pending",
      canCompleteSession: orders.length > 0 || Boolean(bill),
    };
  } catch (error) {
    logger.error("Get session with bill failed:", error);
    throw error;
  }
};

exports.requestBillForSession = async (
  sessionId,
  email = null,
  forceNew = false,
) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    const bill = await billManager.generateBill(sessionId, email, forceNew);

    if (email && !customer.email) {
      customer.email = email;
      await customer.save();
    }

    return {
      success: true,
      message: email
        ? "Bill generated and sent via email"
        : "Bill generated successfully",
      data: {
        bill,
        session: customer,
      },
    };
  } catch (error) {
    logger.error("Request bill for session failed:", error);
    throw error;
  }
};

exports.markBillAsPaid = async (billId, paymentData, staffId = null) => {
  try {
    const bill = await Bill.findById(billId);
    if (!bill) {
      throw new Error("Bill not found");
    }

    const updatedBill = await billManager.updateBillPayment(
      billId,
      paymentData,
    );

    const customer = await Customer.findOne({
      sessionId: bill.sessionId,
      isActive: true,
    });

    if (customer) {
      const paidAt = new Date();

      customer.sessionStatus = "completed";
      customer.sessionEnd = paidAt;
      customer.paymentStatus = "paid";
      customer.paymentMethod = paymentData.method;
      customer.paymentReference = paymentData.transactionId;
      customer.retainSessionData = true;
      customer.retainUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      customer.isAccessibleForBilling = true;
      customer.totalAmount = updatedBill.totalAmount;
      customer.totalSpent += updatedBill.totalAmount;

      if (staffId) {
        customer.closedBy = staffId;
        const staff = await User.findById(staffId);
        if (staff) {
          customer.closedByName = staff.name;
          customer.closedByRole = staff.role;
        }
      }

      await customer.save();

      if (customer.table) {
        const table = await Table.findById(customer.table);
        if (table) {
          table.status = "cleaning";
          table.currentCustomer = null;
          table.currentOrder = null;
          table.lastCleaned = paidAt;
          await table.save();
        }
      }

      await Order.updateMany(
        {
          customer: customer._id,
          paymentStatus: { $ne: "paid" },
        },
        {
          $set: {
            paymentStatus: "paid",
            paymentMethod: paymentData.method,
            paymentDetails: {
              transactionId: paymentData.transactionId,
              paymentGateway: paymentData.gateway || paymentData.method,
              paidAmount: updatedBill.totalAmount,
              paidAt,
            },
            status: "completed",
          },
        },
      );
    }

    return {
      success: true,
      message: "Bill marked as paid successfully",
      data: {
        bill: updatedBill,
        customer: customer,
      },
    };
  } catch (error) {
    logger.error("Mark bill as paid failed:", error);
    throw error;
  }
};
exports.generateBillBeforePayment = async (sessionId) => {
  try {
    logger.info("Generating bill before payment for session:", sessionId);

    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    const existingBill = await Bill.findOne({
      sessionId,
      paymentStatus: "pending",
    });

    if (existingBill) {
      logger.info("Bill already exists:", existingBill.billNumber);
      return {
        success: true,
        message: "Bill already exists",
        data: existingBill,
      };
    }

    const orders = await Order.find({
      customer: customer._id,
      paymentStatus: { $ne: "paid" },
    })
      .populate("items.menuItem", "name description category")
      .populate("items.sizeId", "name code");

    if (orders.length === 0) {
      throw new Error("No unpaid orders found");
    }

    let subtotal = 0;
    let taxAmount = 0;
    let serviceCharge = 0;
    let discountAmount = 0;
    const allItems = [];

    orders.forEach((order) => {
      subtotal += order.subtotal || 0;
      taxAmount += order.taxAmount || 0;
      serviceCharge += order.serviceCharge || 0;
      discountAmount += order.discountAmount || 0;

      order.items.forEach((item) => {
        allItems.push({
          menuItem: item.menuItem,
          name: item.menuItem?.name || item.name || "Menu item",
          size: item.sizeName || item.sizeId?.name || "Regular",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        });
      });
    });

    const totalAmount = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );
    const taxSnapshot = createTaxSnapshot({
      taxRate: orders[0]?.taxRate,
      serviceCharge: orders[0]?.serviceChargeRate,
      taxInclusive: orders[0]?.taxInclusive,
      currency: orders[0]?.currency,
      currencySymbol: orders[0]?.currencySymbol,
    });

    const date = new Date();
    const dateStr =
      date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0");

    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    const billNumber = await billManager.generateBillNumber();

    logger.info("Generated bill number:", billNumber);

    const billData = {
      orderId: orders[0]._id,
      sessionId,
      customerId: customer._id,
      tableId: customer.table?._id,
      subtotal,
      taxAmount,
      taxRate: taxSnapshot.taxRate,
      taxInclusive: taxSnapshot.taxInclusive,
      serviceCharge,
      serviceChargeRate: taxSnapshot.serviceChargeRate,
      discountAmount,
      totalAmount,
      currency: taxSnapshot.currency,
      currencySymbol: taxSnapshot.currencySymbol,
      items: allItems,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerName: customer.name,
      paymentStatus: "pending",
      billStatus: "draft",
      billNumber: billNumber,
      billDate: new Date(),
      metadata: {
        orderCount: orders.length,
        orderNumbers: orders.map((o) => o.orderNumber),
        customerSessionStart: customer.sessionStart,
        tableNumber: customer.table?.tableNumber,
        generatedBeforePayment: true,
      },
    };

    logger.info("Creating bill with data:", {
      billNumber: billData.billNumber,
      sessionId: billData.sessionId,
      totalAmount: billData.totalAmount,
    });

    const bill = await Bill.create(billData);

    logger.info("Bill created successfully:", bill.billNumber);

    try {
      await billManager.generateAndSavePDF(bill);
      logger.info("PDF generated for bill:", bill.billNumber);
    } catch (pdfError) {
      logger.warn(
        "PDF generation failed (continuing without PDF):",
        pdfError.message,
      );
    }

    customer.lastBillId = bill._id;
    customer.lastBillNumber = bill.billNumber;
    customer.lastBillAmount = bill.totalAmount;
    customer.billGenerated = true;
    customer.billGeneratedAt = new Date();
    await customer.save();

    logger.info("Bill generated before payment successfully:", bill.billNumber);

    return {
      success: true,
      message: "Bill generated successfully",
      data: bill,
    };
  } catch (error) {
    logger.error("Generate bill before payment failed:", error);

    if (error.errors) {
      logger.error("Validation errors:", error.errors);
    }

    throw error;
  }
};

exports.getBillSummary = async (sessionId) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    const orders = await Order.find({
      customer: customer._id,
      paymentStatus: { $ne: "paid" },
    });

    if (orders.length === 0) {
      return {
        success: false,
        message: "No orders found",
        data: null,
      };
    }

    let subtotal = 0;
    let taxAmount = 0;
    let serviceCharge = 0;
    let discountAmount = 0;
    let totalAmount = 0;
    let itemCount = 0;

    orders.forEach((order) => {
      subtotal += order.subtotal || 0;
      taxAmount += order.taxAmount || 0;
      serviceCharge += order.serviceCharge || 0;
      discountAmount += order.discountAmount || 0;
      totalAmount += order.totalAmount || 0;
      itemCount += order.items.length || 0;
    });

    const existingBill = await Bill.findOne({
      sessionId,
      paymentStatus: "pending",
    });

    return {
      success: true,
      message: "Bill summary retrieved",
      data: {
        session: {
          id: customer._id,
          sessionId: customer.sessionId,
          name: customer.name,
          table: customer.table,
        },
        summary: {
          orderCount: orders.length,
          itemCount,
          subtotal,
          taxAmount,
          serviceCharge,
          discountAmount,
          totalAmount,
        },
        existingBill: existingBill
          ? {
              id: existingBill._id,
              billNumber: existingBill.billNumber,
              totalAmount: existingBill.totalAmount,
              status: existingBill.paymentStatus,
            }
          : null,
        canGenerateBill: orders.length > 0,
      },
    };
  } catch (error) {
    logger.error("Get bill summary failed:", error);
    throw error;
  }
};
