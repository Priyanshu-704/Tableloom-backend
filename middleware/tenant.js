const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { runWithTenant } = require("../utils/tenantContext");
const { getCacheEntry, setCacheEntry } = require("../utils/responseCache");
const { getTokenUserId, verifyAccessToken } = require("../utils/authTokens");
const TENANT_LOOKUP_CACHE_TTL_MS = 60 * 1000;
const SUPER_ADMIN_MONITORING_ROLES = new Set(["super_admin"]);
const SUPER_ADMIN_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const normalizeLookupCacheKey = (lookup = null) => {
  if (!lookup) {
    return "";
  }
  if (lookup._id) {
    return `tenant:id:${lookup._id}`;
  }
  return `tenant:slug-key:${lookup.slug}:${lookup.key}`;
};
const resolveTenantLookup = (req) => {
  const tenantId = req.header("x-tenant-id") || req.query.tenantId || null;
  const tenantSlug =
    req.header("x-tenant-slug") || req.query.tenantSlug || null;
  const tenantKey = req.header("x-tenant-key") || req.query.tenantKey || null;
  if (tenantId) {
    return {
      _id: tenantId,
    };
  }
  if (tenantSlug && tenantKey) {
    return {
      slug: String(tenantSlug).trim().toLowerCase(),
      key: String(tenantKey).trim().toLowerCase(),
    };
  }
  return null;
};
const extractAccessToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};
const resolveTenantLookupFromAccessToken = async (req) => {
  const accessToken = extractAccessToken(req);
  if (!accessToken) {
    return null;
  }
  try {
    const decoded = verifyAccessToken(accessToken);
    const userId = getTokenUserId(decoded);
    if (!userId) {
      return null;
    }
    const user = await User.findById(userId).select("role tenantId").lean();
    if (
      !user ||
      String(user.role || "").toLowerCase() === "super_admin" ||
      !user.tenantId
    ) {
      return null;
    }
    return {
      _id: user.tenantId,
    };
  } catch (_error) {
    return null;
  }
};
const isBypassedPath = (path = "") => {
  const normalized = String(path || "").trim().toLowerCase();
  return (
    normalized.includes("/users/login") ||
    normalized.includes("/users/refresh-token") ||
    normalized.includes("/users/logout") ||
    normalized.includes("/subscription-renewal") ||
    normalized.includes("/subscription-renewal-order") ||
    normalized.includes("/subscription-renewal-verify")
  );
};
const checkIsSuperAdmin = async (req) => {
  const accessToken = extractAccessToken(req);
  if (!accessToken) {
    return false;
  }
  try {
    const decoded = verifyAccessToken(accessToken);
    const userId = getTokenUserId(decoded);
    if (!userId) {
      return false;
    }
    const user = await User.findById(userId).select("role").lean();
    return user && String(user.role || "").toLowerCase() === "super_admin";
  } catch (e) {
    return false;
  }
};
exports.resolveTenant = async (req, res, next) => {
  try {
    const lookup =
      resolveTenantLookup(req) || (await resolveTenantLookupFromAccessToken(req));
    if (!lookup) {
      req.tenant = null;
      return runWithTenant(null, next);
    }
    const cacheKey = normalizeLookupCacheKey(lookup);
    let tenant = cacheKey ? getCacheEntry(cacheKey) : null;
    if (!tenant) {
      tenant = await Tenant.findOne(lookup)
        .select("_id name slug key status branding contact payment subscription mainBranchId")
        .lean();
      if (tenant && cacheKey) {
        setCacheEntry(cacheKey, tenant, TENANT_LOOKUP_CACHE_TTL_MS);
        if (tenant._id) {
          setCacheEntry(
            normalizeLookupCacheKey({
              _id: tenant._id,
            }),
            tenant,
            TENANT_LOOKUP_CACHE_TTL_MS,
          );
        }
      }
    }
    if (!tenant || tenant.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Restaurant workspace not found or inactive",
      });
    }
    const { isSubscriptionActive } = require("../services/subscriptionService");
    const isSuperAdminUser = await checkIsSuperAdmin(req);
    if (!isBypassedPath(req.originalUrl || req.path) && !isSuperAdminUser && !isSubscriptionActive(tenant)) {
      return res.status(402).json({
        success: false,
        code: "SUBSCRIPTION_INACTIVE",
        message: "This restaurant subscription has expired. Renew the subscription to access the main branch and sub-branches.",
        subscriptionState: "expired",
        tenantSlug: tenant.slug,
        tenantKey: tenant.key,
      });
    }
    req.tenant = tenant;
    req.tenantId = String(tenant._id || "");
    return runWithTenant(tenant, next);
  } catch (error) {
    return next(error);
  }
};
exports.requireTenant = (req, res, next) => {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      message: "Restaurant context is required for this request",
    });
  }
  return next();
};
exports.requireTenantScope = exports.requireTenant;
exports.enforceSuperAdminTenantReadOnly = (req, res, next) => {
  const normalizedRole = String(req.user?.role || "").toLowerCase();
  const normalizedMethod = String(req.method || "").toUpperCase();
  if (
    req.tenant &&
    SUPER_ADMIN_MONITORING_ROLES.has(normalizedRole) &&
    !SUPER_ADMIN_SAFE_METHODS.has(normalizedMethod)
  ) {
    return res.status(403).json({
      success: false,
      message: "Super admin monitoring mode is read-only",
    });
  }
  return next();
};
exports.blockSuperAdminTenantAccess = exports.enforceSuperAdminTenantReadOnly;
