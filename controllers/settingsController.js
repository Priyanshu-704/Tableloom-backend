const { logger } = require("./../utils/logger.js");
const AppSetting = require("../models/AppSetting");
const { sendSuccess, sendError } = require("../utils/httpResponse");
const delayMonitor = require("../utils/delayMonitor");

const deepMerge = (target = {}, source = {}) => {
  const output = { ...(target || {}) };

  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];

    if (Array.isArray(sourceValue)) {
      output[key] = sourceValue;
      return;
    }

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !(sourceValue instanceof Date)
    ) {
      output[key] = deepMerge(output[key] || {}, sourceValue);
      return;
    }

    if (sourceValue !== undefined) {
      output[key] = sourceValue;
    }
  });

  return output;
};

const getOrCreateSettings = async (tenantId) => {
  if (!tenantId) {
    throw new Error("Tenant context is required for settings access");
  }

  let settings = await AppSetting.findOne({ key: "app-settings", tenantId });

  if (!settings) {
    settings = await AppSetting.create({ key: "app-settings", tenantId });
  }

  return settings;
};

const toPublicSettings = (settings) => ({
  restaurant: settings?.restaurant || {},
  businessHours: settings?.businessHours || {},
  paymentMethods: settings?.paymentMethods || {},
  taxSettings: settings?.taxSettings || {},
});

const toAdminSettings = (settings) => ({
  restaurant: settings?.restaurant || {},
  businessHours: settings?.businessHours || {},
  taxSettings: settings?.taxSettings || {},
  paymentMethods: settings?.paymentMethods || {},
  notifications: settings?.notifications || {},
  operations: settings?.operations || {},
});

exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.tenant?._id);
    return sendSuccess(res, 200, null, toPublicSettings(settings.toObject()));
  } catch (error) {
    logger.error("Get public settings failed:", error);
    return sendError(res, 500, "Failed to get public settings");
  }
};

exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.tenant?._id);
    return sendSuccess(res, 200, null, toAdminSettings(settings.toObject()), {
      meta: {
        delayMonitorStatus: delayMonitor.getStatus(),
      },
    });
  } catch (error) {
    logger.error("Get admin settings failed:", error);
    return sendError(res, 500, "Failed to get settings");
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.tenant?._id);
    const currentSettings = settings.toObject();
    const mergedSettings = deepMerge(currentSettings, req.body || {});

    settings.restaurant = mergedSettings.restaurant || settings.restaurant;
    settings.businessHours =
      mergedSettings.businessHours || settings.businessHours;
    settings.taxSettings = mergedSettings.taxSettings || settings.taxSettings;
    settings.paymentMethods =
      mergedSettings.paymentMethods || settings.paymentMethods;
    settings.notifications =
      mergedSettings.notifications || settings.notifications;
    settings.staff = mergedSettings.staff || settings.staff;
    settings.operations = mergedSettings.operations || settings.operations;
    settings.updatedBy = req.user?._id || null;

    await settings.save();
    await delayMonitor.syncWithSettings();

    return sendSuccess(
      res,
      200,
      "Settings updated successfully",
      toAdminSettings(settings.toObject()),
      {
        publicSettings: toPublicSettings(settings.toObject()),
        meta: {
          delayMonitorStatus: delayMonitor.getStatus(),
        },
      }
    );
  } catch (error) {
    logger.error("Update settings failed:", error);
    return sendError(
      res,
      500,
      "Failed to update settings",
      error
    );
  }
};
