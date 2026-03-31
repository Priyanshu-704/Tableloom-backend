const { logger } = require("./../utils/logger.js");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const {
  generateQRCode,
  generateQRData,
  deleteQRFile,
} = require("../utils/qrGenerator");
require("dotenv").config({ quiet: true });

const getBaseUrl = () => process.env.BACKEND_URL;
const getFrontendUrl = () => process.env.FRONTEND_URL;

const buildTableQrUrl = (table) => {
  if (!table?.qrToken || !table?.tableNumber || !table?._id) {
    return null;
  }

  const baseUrl = getFrontendUrl();
  const encodedTableNumber = encodeURIComponent(String(table.tableNumber));

  return `${baseUrl}/table/${encodedTableNumber}?table=${table._id}&token=${table.qrToken}`;
};

const sanitizeTable = (table, { includeAdminFields = true } = {}) => {
  const tableObj = table.toObject ? table.toObject() : { ...table };

  if (tableObj.createdBy?.name) {
    tableObj.createdBy = {
      _id: tableObj.createdBy._id,
      name: tableObj.createdBy.name,
    };
  }

  if (!includeAdminFields) {
    delete tableObj.notes;
    delete tableObj.createdBy;
  }

  tableObj.qrCode = tableObj.qrCode
    ? `${getBaseUrl()}/images/table-qr/${tableObj._id}`
    : null;
  tableObj.qrUrl = buildTableQrUrl(tableObj);

  if (tableObj.qrTokenExpiry) {
    const remainingMs = new Date(tableObj.qrTokenExpiry) - new Date();
    tableObj.tokenExpiry = tableObj.qrTokenExpiry;
    tableObj.tokenDaysRemaining = Math.max(
      0,
      Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
    );
    tableObj.tokenExpired = remainingMs <= 0;
  } else {
    tableObj.tokenExpiry = null;
    tableObj.tokenDaysRemaining = 0;
    tableObj.tokenExpired = true;
  }

  delete tableObj.qrToken;
  delete tableObj.qrTokenExpiry;
  delete tableObj.qrImageBucket;
  delete tableObj.qrPublicId;
  delete tableObj.qrProvider;

  return tableObj;
};

const filterTablesByPermission = (user, query = {}) => {
  const userRole = user.role;

  switch (userRole) {
    case "admin":
    case "manager":
      return query;
    case "waiter":
    case "chef":
      return { ...query, isActive: true };
    default:
      return { ...query, isActive: true, status: "available" };
  }
};

exports.createTable = async (req, res) => {
  try {
    const { tableNumber, tableName, capacity, location, notes } = req.body;

    const existingTable = await Table.findOne({ tableNumber });
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: "Table with this number already exists",
      });
    }

    const table = await Table.create({
      tableNumber,
      tableName,
      capacity,
      location,
      notes,
      createdBy: req.user.id,
    });

    const qrInfo = generateQRData(table._id, tableNumber);

    const qrUpload = await generateQRCode(qrInfo.url, tableNumber);

    table.qrToken = qrInfo.token;
    table.qrTokenExpiry = qrInfo.expiry;
    table.qrCode = qrUpload.url;
    table.qrPublicId = qrUpload.publicId;
    table.qrProvider = qrUpload.provider;

    await table.save();
    await table.populate("createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Table created successfully with QR code",
      data: sanitizeTable(table),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getTables = async (req, res) => {
  try {
    const {
      status,
      location,
      activeOnly = "true",
      capacity,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    let query = {};

    query = filterTablesByPermission(req.user, query);

    if (status) {
      query.status = status;
    }

    if (location) {
      query.location = location;
    }
    if (capacity) {
      query.capacity =
        capacity === "8+" ? { $gte: 8 } : Number(capacity);
    }

    if (activeOnly !== undefined) {
      query.isActive = activeOnly === "true";
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { tableName: regex },
        { location: regex },
        ...(Number.isNaN(Number(search))
          ? []
          : [{ tableNumber: Number(search) }]),
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const tables = await Table.find(query)
      .select("-currentOrder -currentCustomer")
      .populate("createdBy", "name")
      .sort({ tableNumber: 1 })
      .skip(skip)
      .limit(limitNum);

    const sanitizedTables = tables.map((table) =>
      sanitizeTable(table, {
        includeAdminFields: ["admin", "manager"].includes(req.user.role),
      }),
    );

    const total = await Table.countDocuments(query);

    res.status(200).json({
      success: true,
      count: sanitizedTables.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      data: sanitizedTables,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id)
      .populate("createdBy", "name")
      .select("-currentOrder -currentCustomer");

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    res.status(200).json({
      success: true,
      data: sanitizeTable(table, {
        includeAdminFields: ["admin", "manager"].includes(req.user.role),
      }),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { tableNumber, tableName, capacity, location, notes } = req.body;

    if (tableNumber) {
      const existingTable = await Table.findOne({
        tableNumber,
        _id: { $ne: req.params.id },
      });

      if (existingTable) {
        return res.status(400).json({
          success: false,
          message: "Table with this number already exists",
        });
      }
    }

    const table = await Table.findByIdAndUpdate(
      req.params.id,
      {
        tableNumber,
        tableName,
        capacity,
        location,
        notes,
      },
      { new: true, runValidators: true },
    ).populate("createdBy", "name");

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Table updated successfully",
      data: sanitizeTable(table),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateTableStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const tableId = req.params.id;

    const table = await Table.findById(tableId);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    const validTransitions = {
      available: ["occupied", "reserved", "maintenance", "cleaning"],
      occupied: ["available", "cleaning"],
      reserved: ["available", "occupied"],
      maintenance: ["available"],
      cleaning: ["available"],
    };

    if (!validTransitions[table.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${table.status} to ${status}`,
      });
    }
    if (
      table.status === "occupied" &&
      (status === "available" || status === "cleaning")
    ) {
      const activeSession = await Customer.findOne({
        table: tableId,
        sessionStatus: { $in: ["active", "payment_pending"] },
        isActive: true,
      });

      if (activeSession) {
        return res.status(400).json({
          success: false,
          message: `Cannot make table status ${status}. There is an active session (${activeSession.sessionId}). Please end the session first.`,
          data: {
            sessionId: activeSession.sessionId,
            sessionStatus: activeSession.sessionStatus,
          },
        });
      }
    }

    const updateData = { status };

    if (status === "occupied") {
      updateData.lastOccupied = new Date();
    } else if (status === "cleaning") {
      updateData.lastCleaned = new Date();
    } else if (status === "available") {
      updateData.currentOrder = null;
      updateData.currentCustomer = null;

      await Customer.updateMany(
        {
          table: tableId,
          sessionStatus: "active",
          isActive: true,
        },
        {
          sessionStatus: "ended",
          sessionEnd: new Date(),
          isActive: false,
          notes: "Session ended due to table status change to available",
        },
      );
    }

    if (notes) {
      updateData.notes = notes;
    }

    await Table.findByIdAndUpdate(tableId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: `Table status updated to ${status}`,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.toggleTableActive = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    table.isActive = !table.isActive;
    await table.save();

    res.status(200).json({
      success: true,
      message: `Table ${
        table.isActive ? "activated" : "deactivated"
      } successfully`,
      data: sanitizeTable(table),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    if (["occupied", "billing"].includes(table.status) || table.currentOrder) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete table that is currently occupied",
      });
    }

    const activeSession = await Customer.findOne({
      table: req.params.id,
      sessionStatus: "active",
      isActive: true,
    });

    if (activeSession) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete table with active session. Please end the session first.",
        sessionId: activeSession.sessionId,
      });
    }

    if (table.qrCode) {
      await deleteQRFile(table.qrPublicId || table.qrImageBucket);
    }

    await Table.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Table deleted successfully",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getTableStatistics = async (req, res) => {
  try {
    const [
      totalTables,
      availableTables,
      occupiedTables,
      reservedTables,
      maintenanceTables,
    ] = await Promise.all([
      Table.countDocuments({ isActive: true }),
      Table.countDocuments({ isActive: true, status: "available" }),
      Table.countDocuments({ isActive: true, status: "occupied" }),
      Table.countDocuments({ isActive: true, status: "reserved" }),
      Table.countDocuments({ isActive: true, status: "maintenance" }),
    ]);

    const occupancyRate =
      totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        totalTables,
        available: availableTables,
        occupied: occupiedTables,
        reserved: reservedTables,
        maintenance: maintenanceTables,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.downloadQRCode = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table || !table.qrCode) {
      return res.status(404).json({
        success: false,
        message: "QR code not found",
      });
    }

    if (/^https?:\/\//i.test(String(table.qrCode || ""))) {
      return res.redirect(table.qrCode);
    }

    return res.status(404).json({
      success: false,
      message: "QR code not found",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Error downloading QR code",
      error: error.message,
    });
  }
};

exports.regenerateQRCode = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    if (table.status === "occupied") {
      return res.status(400).json({
        success: false,
        message: "Cannot regenerate QR code for occupied table",
      });
    }
    if (table.qrCode) {
      await deleteQRFile(table.qrPublicId || table.qrImageBucket);
    }

    const qrInfo = generateQRData(table._id, table.tableNumber);
    const qrUpload = await generateQRCode(qrInfo.url, table.tableNumber);

    table.qrToken = qrInfo.token;
    table.qrTokenExpiry = qrInfo.expiry;
    table.qrCode = qrUpload.url;
    table.qrPublicId = qrUpload.publicId;
    table.qrProvider = qrUpload.provider;

    await table.save();

    const baseUrl = getBaseUrl();

    res.status(200).json({
      success: true,
      message: "QR code regenerated successfully",
      data: {
        qrCode: `${baseUrl}/images/table-qr/${table._id}`,
        qrUrl: qrInfo.url,
        tokenExpiry: qrInfo.expiry,
        tokenDaysRemaining: 30,
        tokenExpired: false,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to regenerate QR code",
      error: error.message,
    });
  }
};

exports.refreshQRToken = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    const qrInfo = generateQRData(table._id, table.tableNumber);

    table.qrToken = qrInfo.token;
    table.qrTokenExpiry = qrInfo.expiry;
    await table.save();

    res.status(200).json({
      success: true,
      message: "QR token refreshed successfully",
      data: {
        qrCode: table.qrCode ? `${getBaseUrl()}/images/table-qr/${table._id}` : null,
        tokenExpiry: qrInfo.expiry,
        tokenDaysRemaining: 30,
        qrUrl: qrInfo.url,
        tokenExpired: false,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh QR token",
      error: error.message,
    });
  }
};

exports.getQRTokenStatus = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id).select(
      "qrToken qrTokenExpiry tableNumber status isActive",
    );

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
      });
    }

    const tokenStatus = {
      tableNumber: table.tableNumber,
      hasToken: !!table.qrToken,
      tokenExpiry: table.qrTokenExpiry,
      status: table.status,
      isActive: table.isActive,
      tokenValid: false,
    };

    if (table.qrToken && table.qrTokenExpiry) {
      tokenStatus.tokenValid = new Date() <= new Date(table.qrTokenExpiry);
      tokenStatus.daysRemaining = Math.ceil(
        (new Date(table.qrTokenExpiry) - new Date()) / (1000 * 60 * 60 * 24),
      );
    }

    res.status(200).json({
      success: true,
      data: tokenStatus,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get QR token status",
      error: error.message,
    });
  }
};
