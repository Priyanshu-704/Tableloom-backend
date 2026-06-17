const { logger } = require("./../utils/logger.js");
const AppSetting = require("../models/AppSetting");
const Tenant = require("../models/Tenant");
const { deleteImageVariants } = require("../utils/imageStorage");
const { sendSuccess, sendError } = require("../utils/httpResponse");
const delayMonitor = require("../utils/delayMonitor");
const { buildTenantImageAssetUrl } = require("../utils/assetUrl");
const { invalidateTenantTaxSettings } = require("../utils/taxCalculator");
const {
  applyPaymentGatewayRestrictions,
  buildPaymentGatewaySummary,
  encryptPaymentCredential,
  loadTenantPaymentConfiguration,
  maskPaymentCredential,
  validateEnabledPaymentMethods,
} = require("../utils/paymentGatewayManager");
const formatFieldName = (field = "") =>
  String(field)
    .split(".")
    .pop()
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
const getSettingsUpdateErrorResponse = (error) => {
  const validationMessages = Object.values(error?.errors || {})
    .map((fieldError) => fieldError?.message)
    .filter(Boolean);
  if (error?.name === "ValidationError" && validationMessages.length > 0) {
    return {
      statusCode: 400,
      message: validationMessages[0],
      extra: {
        details: validationMessages,
      },
    };
  }
  if (error?.name === "CastError") {
    return {
      statusCode: 400,
      message: `${formatFieldName(error.path)} is invalid. Please provide a valid value.`,
    };
  }
  if (error?.code === 11000) {
    const duplicateField = Object.keys(
      error.keyPattern || error.keyValue || {},
    )[0];
    return {
      statusCode: 409,
      message: duplicateField
        ? `${formatFieldName(duplicateField)} already exists. Please use a different value.`
        : "A record with the same value already exists.",
    };
  }
  if (typeof error?.statusCode === "number") {
    return {
      statusCode: error.statusCode,
      message: error.message || "Failed to update settings",
      extra: error.details
        ? {
            details: error.details,
          }
        : {},
    };
  }
  return null;
};
const deepMerge = (target = {}, source = {}) => {
  const output = {
    ...(target || {}),
  };
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
const getActiveBranchId = (req) =>
  req.isAllBranches ? null : req.branchId || null;
const getOrCreateSettings = async (tenantId, branchId = null) => {
  if (!tenantId) {
    throw new Error("Tenant context is required for settings access");
  }
  let settings = await AppSetting.findOne({
    key: "app-settings",
    tenantId,
    branchId,
  });
  if (!settings) {
    settings = await AppSetting.create({
      key: "app-settings",
      tenantId,
      branchId,
    });
  }
  return settings;
};
const buildRestaurantSettings = (req, restaurant = {}) => ({
  ...(restaurant || {}),
  logo:
    restaurant?.logo && !String(restaurant.logo).startsWith("/")
      ? buildTenantImageAssetUrl(req, "/images/restaurant-logo")
      : restaurant?.logo || "/tableloom-mark.svg",
  logoThumbnail:
    restaurant?.logo && !String(restaurant.logo).startsWith("/")
      ? buildTenantImageAssetUrl(req, "/images/restaurant-logo", {
          variant: "thumbnail",
        })
      : restaurant?.logoThumbnail || restaurant?.logo || "/tableloom-mark.svg",
});
const toPublicSettings = (req, settings, paymentConfiguration = null) => ({
  restaurant: buildRestaurantSettings(req, settings?.restaurant || {}),
  businessHours: settings?.businessHours || {},
  paymentMethods:
    paymentConfiguration?.paymentMethods ||
    applyPaymentGatewayRestrictions(
      settings?.paymentMethods || {},
      buildPaymentGatewaySummary(null),
    ),
  taxSettings: settings?.taxSettings || {},
});
const toAdminSettings = (req, settings, paymentConfiguration = null) => ({
  restaurant: buildRestaurantSettings(req, settings?.restaurant || {}),
  businessHours: settings?.businessHours || {},
  taxSettings: settings?.taxSettings || {},
  paymentMethods:
    paymentConfiguration?.paymentMethods ||
    applyPaymentGatewayRestrictions(
      settings?.paymentMethods || {},
      buildPaymentGatewaySummary(null),
    ),
  paymentGateway:
    paymentConfiguration?.paymentGateway || buildPaymentGatewaySummary(null),
  notifications: settings?.notifications || {},
  operations: settings?.operations || {},
});
const shapeDelayMonitorStatus = (status = {}) => ({
  isRunning: Boolean(status?.isRunning),
  enabled: Boolean(status?.enabled),
  intervalMinutes: Number(status?.intervalMinutes || 0),
  notifyOnDelay: Boolean(status?.notifyOnDelay),
  criticalThresholdMinutes: Number(status?.criticalThresholdMinutes || 0),
  lastCheck: status?.lastCheck || null,
  lastError: status?.lastError || null,
  lastRunSummary: {
    delayedOrdersFound: Number(
      status?.lastRunSummary?.delayedOrdersFound || 0,
    ),
    criticalDelayedOrders: Number(
      status?.lastRunSummary?.criticalDelayedOrders || 0,
    ),
    autoCancelledExpiredOrders: Number(
      status?.lastRunSummary?.autoCancelledExpiredOrders || 0,
    ),
    trigger: status?.lastRunSummary?.trigger || null,
    checkedAt: status?.lastRunSummary?.checkedAt || null,
  },
});
exports.getPublicSettings = async (req, res) => {
  try {
    const branchId = getActiveBranchId(req);
    const settings = await getOrCreateSettings(req.tenant?._id, branchId);
    const rawSettings = settings.toObject();
    const paymentConfiguration = await loadTenantPaymentConfiguration(
      req.tenant?._id,
      {
        branchId,
        branchDocument: req.branch?.toObject ? req.branch.toObject() : req.branch,
        settingsDocument: rawSettings,
      },
    );
    return sendSuccess(
      res,
      200,
      null,
      toPublicSettings(req, rawSettings, paymentConfiguration),
    );
  } catch (error) {
    logger.error("Get public settings failed:", error);
    return sendError(res, 500, "Failed to get public settings");
  }
};
exports.getAdminSettings = async (req, res) => {
  try {
    const branchId = getActiveBranchId(req);
    const settings = await getOrCreateSettings(req.tenant?._id, branchId);
    const rawSettings = settings.toObject();
    const paymentConfiguration = await loadTenantPaymentConfiguration(
      req.tenant?._id,
      {
        branchId,
        branchDocument: req.branch?.toObject ? req.branch.toObject() : req.branch,
        settingsDocument: rawSettings,
      },
    );
    await delayMonitor.syncWithSettings(req.tenant?._id);
    return sendSuccess(
      res,
      200,
      null,
      toAdminSettings(req, rawSettings, paymentConfiguration),
      {
        meta: {
          delayMonitorStatus: shapeDelayMonitorStatus(
            delayMonitor.getStatus(req.tenant?._id),
          ),
        },
      },
    );
  } catch (error) {
    logger.error("Get admin settings failed:", error);
    return sendError(res, 500, "Failed to get settings");
  }
};
exports.updateSettings = async (req, res) => {
  try {
    const branchId = getActiveBranchId(req);
    const settings = await getOrCreateSettings(req.tenant?._id, branchId);
    const tenant = await Tenant.findById(req.tenant?._id);
    if (!tenant) {
      return sendError(res, 404, "Tenant not found");
    }
    const branch = branchId ? req.branch : null;
    const paymentOwner = branch || tenant;
    const currentSettings = settings.toObject();
    const parsedPayload = parseSettingsPayload(req.body || {});
    const mergedSettings = deepMerge(currentSettings, parsedPayload);
    if (req.file?.url) {
      if (
        settings.restaurant?.logo &&
        !String(settings.restaurant.logo).startsWith("/") &&
        (settings.restaurant?.logoPublicId ||
          settings.restaurant?.logoThumbnailPublicId)
      ) {
        await deleteImageVariants({
          image: settings.restaurant.logo,
          thumbnail: settings.restaurant.logoThumbnail,
          imagePublicId: settings.restaurant.logoPublicId,
          thumbnailPublicId: settings.restaurant.logoThumbnailPublicId,
          provider: settings.restaurant.logoProvider,
        }).catch((error) => {
          logger.warn(
            "Failed to delete previous restaurant logo:",
            error?.message || error,
          );
        });
      }
      mergedSettings.restaurant = {
        ...(mergedSettings.restaurant || {}),
        logo: req.file.url,
        logoThumbnail: req.file.thumbnailUrl,
        logoPublicId: req.file.publicId,
        logoThumbnailPublicId: req.file.thumbnailPublicId,
        logoProvider: req.file.storageProvider || "cloudinary",
      };
    }
    const paymentGatewayPayload = parsedPayload?.paymentGateway || {};
    const shouldUpdateGateway =
      parsedPayload &&
      Object.prototype.hasOwnProperty.call(parsedPayload, "paymentGateway");
    if (shouldUpdateGateway) {
      const removeCredentials = paymentGatewayPayload?.removeCredentials === true;
      const nextKeyId = String(paymentGatewayPayload?.keyId || "").trim();
      const nextKeySecret = String(paymentGatewayPayload?.keySecret || "").trim();

      if (removeCredentials) {
        paymentOwner.paymentGateway = {
          provider: "none",
          status: "inactive",
          keyIdEncrypted: "",
          keySecretEncrypted: "",
          keyIdMask: "",
          configuredAt: null,
          updatedAt: new Date(),
          updatedBy: req.user?._id || null,
        };
      } else if (nextKeyId || nextKeySecret) {
        if (!nextKeyId || !nextKeySecret) {
          return sendError(
            res,
            400,
            "Provide both Razorpay Key ID and Key Secret to save payment credentials.",
          );
        }

        paymentOwner.paymentGateway = {
          provider: "razorpay",
          status: "active",
          keyIdEncrypted: encryptPaymentCredential(nextKeyId),
          keySecretEncrypted: encryptPaymentCredential(nextKeySecret),
          keyIdMask: maskPaymentCredential(nextKeyId),
          configuredAt: paymentOwner.paymentGateway?.configuredAt || new Date(),
          updatedAt: new Date(),
          updatedBy: req.user?._id || null,
        };
      }
    }
    const paymentGatewaySummary = buildPaymentGatewaySummary(
      paymentOwner.toObject ? paymentOwner.toObject() : paymentOwner,
    );
    const nextPaymentMethods = validateEnabledPaymentMethods(
      applyPaymentGatewayRestrictions(
        mergedSettings.paymentMethods || settings.paymentMethods,
        paymentGatewaySummary,
      ),
    );
    settings.restaurant = mergedSettings.restaurant || settings.restaurant;
    settings.businessHours =
      mergedSettings.businessHours || settings.businessHours;
    settings.taxSettings = mergedSettings.taxSettings || settings.taxSettings;
    settings.paymentMethods = nextPaymentMethods;
    settings.notifications =
      mergedSettings.notifications || settings.notifications;
    settings.staff = mergedSettings.staff || settings.staff;
    settings.operations = mergedSettings.operations || settings.operations;
    settings.updatedBy = req.user?._id || null;
    await Promise.all([settings.save(), paymentOwner.save()]);
    invalidateTenantTaxSettings(req.tenant?._id);
    await delayMonitor.syncWithSettings(req.tenant?._id);
    const savedSettings = settings.toObject();
    const paymentConfiguration = {
      paymentGateway: paymentGatewaySummary,
      paymentMethods: nextPaymentMethods,
    };
    return sendSuccess(
      res,
      200,
      "Settings updated successfully",
      toAdminSettings(req, savedSettings, paymentConfiguration),
      {
        publicSettings: toPublicSettings(
          req,
          savedSettings,
          paymentConfiguration,
        ),
        meta: {
          delayMonitorStatus: shapeDelayMonitorStatus(
            delayMonitor.getStatus(req.tenant?._id),
          ),
        },
      },
    );
  } catch (error) {
    logger.error("Update settings failed:", error);
    const normalizedError = getSettingsUpdateErrorResponse(error);
    if (normalizedError) {
      return sendError(
        res,
        normalizedError.statusCode,
        normalizedError.message,
        error,
        normalizedError.extra || {},
      );
    }
    return sendError(res, 500, "Failed to update settings", error);
  }
};
