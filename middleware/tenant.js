const Tenant = require("../models/Tenant");
const { runWithTenant } = require("../utils/tenantContext");

const resolveTenantLookup = (req) => {
  const tenantId = req.header("x-tenant-id") || req.query.tenantId || null;
  const tenantSlug = req.header("x-tenant-slug") || req.query.tenantSlug || null;
  const tenantKey = req.header("x-tenant-key") || req.query.tenantKey || null;

  if (tenantId) {
    return { _id: tenantId };
  }

  if (tenantSlug && tenantKey) {
    return {
      slug: String(tenantSlug).trim().toLowerCase(),
      key: String(tenantKey).trim().toLowerCase(),
    };
  }

  return null;
};

exports.resolveTenant = async (req, res, next) => {
  try {
    const lookup = resolveTenantLookup(req);

    if (!lookup) {
      req.tenant = null;
      return runWithTenant(null, next);
    }

    const tenant = await Tenant.findOne(lookup).lean();

    if (!tenant || tenant.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Restaurant workspace not found or inactive",
      });
    }

    req.tenant = tenant;
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

exports.blockSuperAdminTenantAccess = (req, res, next) => {
  if (req.user?.role === "super_admin") {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message:
        "Super admin monitoring mode is read-only inside restaurant workspaces",
    });
  }

  return next();
};
