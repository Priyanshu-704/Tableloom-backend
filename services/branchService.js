const Tenant = require("../models/Tenant");
const Branch = require("../models/Branch");
const { normalizeTenantSlug } = require("../utils/tenantWorkspace");

const normalizeBranchSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "main";

const buildMainBranchPayload = (tenant = {}, actorId = null) => ({
  tenantId: tenant._id,
  name: tenant.name || "Main Location",
  slug: normalizeBranchSlug(tenant.slug || tenant.name || "main"),
  type: "main",
  parentBranchId: null,
  status: "active",
  isDefault: true,
  phone: tenant.contact?.phone || "",
  email: tenant.contact?.email || tenant.requestedAdmin?.email || "",
  currency: tenant.payment?.currency || "INR",
  metadata: {
    createdBy: actorId,
    updatedBy: actorId,
    approvedBy: actorId,
    approvedAt: new Date(),
  },
});

const ensureMainBranch = async (tenant = {}, actorId = null) => {
  if (!tenant?._id) {
    throw new Error("Tenant is required to ensure a main branch");
  }

  let mainBranch = await Branch.findOne({
    tenantId: tenant._id,
    type: "main",
  });

  if (!mainBranch) {
    mainBranch = await Branch.create(buildMainBranchPayload(tenant, actorId));
  }

  if (!tenant.mainBranchId || String(tenant.mainBranchId) !== String(mainBranch._id)) {
    await Tenant.updateOne(
      { _id: tenant._id },
      { $set: { mainBranchId: mainBranch._id } },
    );
    tenant.mainBranchId = mainBranch._id;
  }

  return mainBranch;
};

const branchToClient = (branch = {}) => ({
  _id: branch._id,
  tenantId: branch.tenantId,
  name: branch.name,
  slug: branch.slug,
  type: branch.type,
  parentBranchId: branch.parentBranchId || null,
  status: branch.status,
  timezone: branch.timezone || "",
  currency: branch.currency || "INR",
  phone: branch.phone || "",
  email: branch.email || "",
  address: branch.address || {},
  geo: branch.geo || {},
  operatingHours: branch.operatingHours || {},
  isDefault: Boolean(branch.isDefault),
  createdAt: branch.createdAt,
  updatedAt: branch.updatedAt,
});

module.exports = {
  normalizeBranchSlug,
  buildMainBranchPayload,
  ensureMainBranch,
  branchToClient,
};
