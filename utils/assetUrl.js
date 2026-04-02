const { getCurrentTenant } = require("./tenantContext");

const getApiBaseUrl = (req = null) =>
  process.env.BACKEND_URL ||
  `${req?.protocol || "http"}://${req?.get?.("host") || "localhost"}/api`;

const buildTenantAssetQuery = (tenant = getCurrentTenant()) => {
  if (!tenant?.slug || !tenant?.key) {
    return "";
  }

  return `?tenantSlug=${encodeURIComponent(tenant.slug)}&tenantKey=${encodeURIComponent(tenant.key)}`;
};

const buildTenantAssetUrl = (
  req = null,
  path = "",
  tenant = req?.tenant || getCurrentTenant(),
) => `${getApiBaseUrl(req)}${path}${buildTenantAssetQuery(tenant)}`;

module.exports = {
  buildTenantAssetQuery,
  buildTenantAssetUrl,
  getApiBaseUrl,
};
