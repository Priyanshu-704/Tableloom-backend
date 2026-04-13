const { logger } = require("./../utils/logger.js");
const User = require("../models/User");
const { Permissions } = require("../config/permissions");
const {
  hydrateUserPermissions,
  normalizePermission,
} = require("../utils/permissionSettings");
const crypto = require("crypto");
const { normalizeTenantId } = require("../utils/tenantContext");
const {
  getTokenUserId,
  signAccessToken,
  verifyAccessToken,
} = require("../utils/authTokens");
require("dotenv").config({
  quiet: true,
});
exports.checkPermission = (user, permission) => {
  if (!user || !user.role) return false;
  if (["super_admin", "admin"].includes(String(user.role).toLowerCase())) {
    return true;
  }
  const targetPermission = normalizePermission(permission);
  const effectivePermissions =
    user.resolvedPermissions || user.getPermissions?.() || [];
  return effectivePermissions.includes(targetPermission);
};
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
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again.",
      });
    }
    const newAccessToken = signAccessToken(user);
    const cookieOptions = {
      httpOnly: process.env.COOKIE_HTTPONLY === "true",
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAMESITE || "strict",
      maxAge: 15 * 60 * 1000,
    };
    if (process.env.NODE_ENV === "production" && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    res.cookie("accessToken", newAccessToken, cookieOptions);
    req.user = user;
    await hydrateUserPermissions(req.user);
    if (!req.user || req.user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
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
    if (!roles.includes(req.user.role)) {
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
    const effectivePermissions =
      req.user.resolvedPermissions || req.user.getPermissions?.() || [];
    if (
      !["super_admin", "admin"].includes(String(req.user.role).toLowerCase()) &&
      !normalizedPermissions.some((permission) =>
        effectivePermissions.includes(permission),
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
  }
  if (!accessToken) return next();
  try {
    const decoded = verifyAccessToken(accessToken);
    req.user = await User.findById(getTokenUserId(decoded));
    await hydrateUserPermissions(req.user);
  } catch (e) {}
  next();
};
