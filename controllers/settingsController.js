const { logger } = require("./../utils/logger.js");
const AppSetting = require("../models/AppSetting");
const { deleteAsset } = require("../utils/cloudinaryStorage");
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

const parseSettingsPayload = (payload = {}) =>
  Object.entries(payload || {}).reduce((accumulator, [key, value]) => {
    if (typeof value !== "string") {
      accumulator[key] = value;
      return accumulator;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      accumulator[key] = value;
      return accumulator;
    }

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        accumulator[key] = JSON.parse(trimmed);
        return accumulator;
      } catch {
        accumulator[key] = value;
        return accumulator;
      }
    }

    accumulator[key] = value;
    return accumulator;
  }, {});

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

const buildRestaurantSettings = (req, restaurant = {}) => ({
  ...(restaurant || {}),
  logo:
    restaurant?.logo && !String(restaurant.logo).startsWith("/")
      ? `${process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}/api`}/images/restaurant-logo`
      : restaurant?.logo || "/tableloom-mark.svg",
});

const toPublicSettings = (req, settings) => ({
  restaurant: buildRestaurantSettings(req, settings?.restaurant || {}),
  businessHours: settings?.businessHours || {},
  paymentMethods: settings?.paymentMethods || {},
  taxSettings: settings?.taxSettings || {},
});

const toAdminSettings = (req, settings) => ({
  restaurant: buildRestaurantSettings(req, settings?.restaurant || {}),
  businessHours: settings?.businessHours || {},
  taxSettings: settings?.taxSettings || {},
  paymentMethods: settings?.paymentMethods || {},
  notifications: settings?.notifications || {},
  operations: settings?.operations || {},
});

exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.tenant?._id);
    return sendSuccess(res, 200, null, toPublicSettings(req, settings.toObject()));
  } catch (error) {
    logger.error("Get public settings failed:", error);
    return sendError(res, 500, "Failed to get public settings");
  }
};

exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.tenant?._id);
    return sendSuccess(res, 200, null, toAdminSettings(req, settings.toObject()), {
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
    const parsedPayload = parseSettingsPayload(req.body || {});
    const mergedSettings = deepMerge(currentSettings, parsedPayload);

    if (req.file?.url) {
      if (
        settings.restaurant?.logo &&
        !String(settings.restaurant.logo).startsWith("/") &&
        settings.restaurant?.logoPublicId
      ) {
        await deleteAsset(settings.restaurant.logoPublicId, "image").catch((error) => {
          logger.warn("Failed to delete previous restaurant logo:", error?.message || error);
        });
      }

      mergedSettings.restaurant = {
        ...(mergedSettings.restaurant || {}),
        logo: req.file.url,
        logoPublicId: req.file.publicId,
        logoProvider: req.file.storageProvider || "cloudinary",
      };
    }

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
      toAdminSettings(req, settings.toObject()),
      {
        publicSettings: toPublicSettings(req, settings.toObject()),
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
