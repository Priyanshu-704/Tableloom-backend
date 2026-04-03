const Customer = require("../models/Customer");
const pushNotificationManager = require("../utils/pushNotificationManager");

const normalizeToken = (value) => String(value || "").trim();

const buildResponseData = (record) => ({
  _id: record?._id || null,
  audience: record?.audience || "",
  role: record?.role || null,
  customerSessionId: record?.customerSessionId || null,
  isActive: Boolean(record?.isActive),
  lastUsedAt: record?.lastUsedAt || null,
});

exports.registerStaffToken = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Push token is required",
      });
    }

    const record = await pushNotificationManager.registerToken({
      tenantId: req.tenantId,
      token,
      audience: "staff",
      userId: req.user?._id,
      role: req.user?.role || null,
      permission: req.body?.permission || "default",
      device: req.body?.device || {},
    });

    return res.status(200).json({
      success: true,
      message: "Staff push token registered successfully",
      data: buildResponseData(record),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to register staff push token",
      error: error.message,
    });
  }
};

exports.unregisterStaffToken = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Push token is required",
      });
    }

    const record = await pushNotificationManager.unregisterToken({
      tenantId: req.tenantId,
      token,
      audience: "staff",
      userId: req.user?._id,
    });

    return res.status(200).json({
      success: true,
      message: "Staff push token removed successfully",
      data: buildResponseData(record),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unregister staff push token",
      error: error.message,
    });
  }
};

exports.registerCustomerToken = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const sessionId = String(req.body?.sessionId || "").trim();

    if (!token || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Push token and sessionId are required",
      });
    }

    const customer = await Customer.findOne({ sessionId }).select("_id sessionId");
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer session not found",
      });
    }

    const record = await pushNotificationManager.registerToken({
      tenantId: req.tenantId,
      token,
      audience: "customer",
      customerSessionId: customer.sessionId,
      permission: req.body?.permission || "default",
      device: req.body?.device || {},
    });

    return res.status(200).json({
      success: true,
      message: "Customer push token registered successfully",
      data: buildResponseData(record),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to register customer push token",
      error: error.message,
    });
  }
};

exports.unregisterCustomerToken = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const sessionId = String(req.body?.sessionId || "").trim();

    if (!token || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Push token and sessionId are required",
      });
    }

    const record = await pushNotificationManager.unregisterToken({
      tenantId: req.tenantId,
      token,
      audience: "customer",
      customerSessionId: sessionId,
    });

    return res.status(200).json({
      success: true,
      message: "Customer push token removed successfully",
      data: buildResponseData(record),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unregister customer push token",
      error: error.message,
    });
  }
};
