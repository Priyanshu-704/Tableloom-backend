const { AsyncLocalStorage } = require("async_hooks");

const tenantStorage = new AsyncLocalStorage();

const normalizeTenantId = (tenant) => {
  if (!tenant) return null;
  if (typeof tenant === "string") return tenant;
  return tenant._id?.toString?.() || tenant.id || null;
};

const runWithTenant = (tenant, callback) =>
  tenantStorage.run(
    {
      tenant,
      tenantId: normalizeTenantId(tenant),
    },
    callback
  );

const getTenantContext = () => tenantStorage.getStore() || null;

const getCurrentTenant = () => getTenantContext()?.tenant || null;

const getCurrentTenantId = () => getTenantContext()?.tenantId || null;

module.exports = {
  getCurrentTenant,
  getCurrentTenantId,
  getTenantContext,
  normalizeTenantId,
  runWithTenant,
};
