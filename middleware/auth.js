const { logger } = require("./../utils/logger.js");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const {
  hydrateUserPermissions,
  normalizePermission,
  normalizeRoleKey,
  userHasPermission,
} = require("../utils/permissionSettings");
const crypto = require("crypto");
const { normalizeTenantId } = require("../utils/tenantContext");
const {
  getTokenUserId,
  signAccessToken,
  verifyAccessToken,
} = require("../utils/authTokens");
const {
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} = require("../utils/cookieOptions");
const {
  getSubscriptionState,
  isSubscriptionActive,
} = require("../services/subscriptionService");
require("dotenv").config({
  quiet: true,
});
const buildSubscriptionInactiveResponse = (tenant = {}) => ({
  success: false,
  code: "SUBSCRIPTION_INACTIVE",
  message:
    "This restaurant subscription has expired. Renew the subscription to access the main branch and sub-branches.",
  subscriptionState: getSubscriptionState(tenant || {}),
});
const getUserTenant = async (user = {}, resolvedTenant = null) => {
  if (!user?.tenantId || String(user.role || "").toLowerCase() === "super_admin") {
    return null;
  }
  if (resolvedTenant?._id && resolvedTenant?.slug && resolvedTenant?.key) {
    return resolvedTenant;
  }
  return Tenant.findById(user.tenantId)
    .select("_id slug key subscription status")
    .lean();
};
const enforceActiveTenantSubscription = async (req, res) => {
  const tenant = await getUserTenant(req.user, req.tenant);
  if (!tenant || isSubscriptionActive(tenant)) {
    return true;
  }
  clearAuthCookies(res);

  let renewalToken = "";
  if (req.user && String(req.user.role || "").toLowerCase() === "admin") {
    const crypto = require("crypto");
    renewalToken = crypto.randomBytes(32).toString("hex");
    const RENEWAL_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
    const renewalTokenExpiresAt = new Date(Date.now() + RENEWAL_TOKEN_TTL_MS);

    await Tenant.updateOne(
      { _id: tenant._id },
      {
        "subscription.renewalTokenHash": crypto
          .createHash("sha256")
          .update(renewalToken)
          .digest("hex"),
        "subscription.renewalTokenExpiresAt": renewalTokenExpiresAt,
      }
    );
  }

  res.status(402).json({
    ...buildSubscriptionInactiveResponse(tenant),
    renewalToken: renewalToken || undefined,
    tenantSlug: tenant.slug,
    tenantKey: tenant.key,
  });
  return false;
};
const getUserRoleKeys = (user) => {
  const explicitRoles = Array.isArray(user?.roles)
    ? user.roles.map((role) => normalizeRoleKey(role?.key || role))
    : [];
  const roleKeys = Array.isArray(user?.roleKeys) ? user.roleKeys : [];
  return [...new Set([...explicitRoles, ...roleKeys, normalizeRoleKey(user?.role)])]
    .filter(Boolean);
};

exports.checkPermission = (user, permission) => userHasPermission(user, permission);
exports.can = exports.checkPermission;
exports.protect = async (req, res, next) => {
  let accessToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    accessToken = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    accessToken = req.cookies.accessToken;
  }
  if (!accessToken) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
  try {
    const decoded = verifyAccessToken(accessToken);
    req.user = await User.findById(getTokenUserId(decoded));
    await hydrateUserPermissions(req.user);
    if (!req.user || req.user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
    if (!(await enforceActiveTenantSubscription(req, res))) {
      return;
    }
    const requestTenantId = normalizeTenantId(req.tenant);
    const userTenantId = normalizeTenantId(req.user?.tenantId);
    if (
      requestTenantId &&
      req.user?.role !== "super_admin" &&
      userTenantId !== requestTenantId
    ) {
      return res.status(403).json({
        success: false,
        message: "User does not belong to this restaurant workspace",
      });
    }
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return this.refreshAccessToken(req, res, next);
    }
    logger.error("Token verification error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};
exports.refreshAccessToken = async (req, res, next) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token provided",
    });
  }
  try {
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const user = await User.findOne({
      refreshToken: hashedRefreshToken,
      refreshTokenExpires: {
        $gt: Date.now(),
      },
    });
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again.",
      });
    }
    const newAccessToken = signAccessToken(user);
    const rotatedRefreshToken = user.generateRefreshToken();
    await user.save({
      validateBeforeSave: false,
    });
    setAccessTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, rotatedRefreshToken);
    req.user = user;
    await hydrateUserPermissions(req.user);
    if (!req.user || req.user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
    if (!(await enforceActiveTenantSubscription(req, res))) {
      return;
    }
    const requestTenantId = normalizeTenantId(req.tenant);
    const userTenantId = normalizeTenantId(req.user?.tenantId);
    if (
      requestTenantId &&
      req.user?.role !== "super_admin" &&
      userTenantId !== requestTenantId
    ) {
      return res.status(403).json({
        success: false,
        message: "User does not belong to this restaurant workspace",
      });
    }
    next();
  } catch (error) {
    logger.error("Refresh token error:", error);
    clearAuthCookies(res);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh token",
    });
  }
};
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
    const allowedRoles = roles.map(normalizeRoleKey);
    const userRoles = getUserRoleKeys(req.user);
    if (!allowedRoles.some((role) => userRoles.includes(role))) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
exports.authorize = exports.requireRole;
exports.hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
    if (!exports.checkPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }
    next();
  };
};
exports.hasAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
    const normalizedPermissions = permissions.map(normalizePermission);
    if (
      !normalizedPermissions.some((permission) =>
        exports.checkPermission(req.user, permission),
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }
    next();
  };
};
exports.optionalAuth = async (req, res, next) => {
  let accessToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    accessToken = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    accessToken = req.cookies.accessToken;
  }
  if (!accessToken) return next();
  try {
    const decoded = verifyAccessToken(accessToken);
    req.user = await User.findById(getTokenUserId(decoded));
    await hydrateUserPermissions(req.user);
  } catch (e) {}
  next();
};
