const {
  getCurrentTenant
} = require("./tenantContext");
const getApiBaseUrl = (req = null) => process.env.BACKEND_URL || `${req?.protocol || "http"}://${req?.get?.("host") || "localhost"}/api`;
const buildTenantAssetQuery = (tenant = getCurrentTenant()) => {
  if (!tenant?.slug || !tenant?.key) {
    return "";
  }
  return `tenantSlug=${encodeURIComponent(tenant.slug)}&tenantKey=${encodeURIComponent(tenant.key)}`;
};
const appendQuery = (path = "", query = "") => {
  if (!query) {
    return path;
  }
  return `${path}${String(path).includes("?") ? "&" : "?"}${query}`;
};
const buildTenantAssetUrl = (req = null, path = "", tenant = req?.tenant || getCurrentTenant()) => `${getApiBaseUrl(req)}${appendQuery(path, buildTenantAssetQuery(tenant))}`;
const buildTenantImageAssetUrl = (req = null, path = "", {
  variant = "image",
  tenant = req?.tenant || getCurrentTenant()
} = {}) => buildTenantAssetUrl(req, appendQuery(path, variant === "thumbnail" ? "variant=thumbnail" : ""), tenant);
module.exports = {
  appendQuery,
  buildTenantAssetQuery,
  buildTenantAssetUrl,
  buildTenantImageAssetUrl,
  getApiBaseUrl
};
