const Branch = require("../models/Branch");
const Tenant = require("../models/Tenant");
const {
  branchToClient,
  ensureMainBranch,
  normalizeBranchSlug,
} = require("../services/branchService");
const {
  canCreateBranch,
  getBranchLimit,
  getSubscriptionState,
  isBranchLimitReached,
} = require("../services/subscriptionService");

const isMainAdmin = (user = {}) =>
  String(user?.branchScope || "").toLowerCase() === "all" ||
  String(user?.role || "").toLowerCase() === "admin";

const requireMainAdmin = (req, res) => {
  if (!isMainAdmin(req.user)) {
    res.status(403).json({
      success: false,
      message: "Main branch admin access is required",
    });
    return false;
  }
  return true;
};

const getTenant = async (req) => {
  if (req.tenant?.subscription) return req.tenant;
  return Tenant.findById(req.tenant?._id || req.user?.tenantId);
};

exports.listBranches = async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id || req.user?.tenantId;
    if (isMainAdmin(req.user)) {
      const branches = await Branch.find({ tenantId }).sort({
        type: 1,
        name: 1,
      });
      return res.status(200).json({
        success: true,
        data: branches.map(branchToClient),
      });
    }
    const branchId = req.user?.homeBranchId || req.user?.branchId || req.branchId;
    const branch = await Branch.findOne({ _id: branchId, tenantId });
    return res.status(200).json({
      success: true,
      data: branch ? [branchToClient(branch)] : [],
    });
  } catch (error) {
    return next(error);
  }
};

exports.getBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findOne({
      _id: req.params.id,
      tenantId: req.tenant?._id || req.user?.tenantId,
    });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }
    if (!isMainAdmin(req.user)) {
      const ownBranchId = String(req.user?.homeBranchId || req.user?.branchId || "");
      if (String(branch._id) !== ownBranchId) {
        return res.status(403).json({
          success: false,
          message: "You cannot access this branch",
        });
      }
    }
    return res.status(200).json({
      success: true,
      data: branchToClient(branch),
    });
  } catch (error) {
    return next(error);
  }
};

exports.createBranch = async (req, res, next) => {
  try {
    if (!requireMainAdmin(req, res)) return;
    const tenant = await getTenant(req);
    const tenantId = tenant?._id || req.tenant?._id || req.user?.tenantId;
    const currentBranchCount = await Branch.countDocuments({ tenantId });
    const creation = canCreateBranch(tenant, currentBranchCount);
    if (!creation.allowed) {
      return res.status(403).json({
        success: false,
        code: creation.reason,
        message: "Branch creation is not allowed for the current subscription",
        plan: creation.plan,
      });
    }

    const mainBranch = await ensureMainBranch(tenant, req.user?._id || null);
    const branch = await Branch.create({
      tenantId,
      name: req.body.name,
      slug: normalizeBranchSlug(req.body.slug || req.body.name),
      type: "sub",
      parentBranchId: mainBranch._id,
      status: req.body.status || "active",
      timezone: req.body.timezone || mainBranch.timezone || "",
      currency: req.body.currency || mainBranch.currency || "INR",
      phone: req.body.phone || "",
      email: req.body.email || "",
      address: req.body.address || {},
      geo: req.body.geo || {},
      operatingHours: req.body.operatingHours || {},
      metadata: {
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: branchToClient(branch),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Branch slug already exists for this tenant",
      });
    }
    return next(error);
  }
};

exports.updateBranch = async (req, res, next) => {
  try {
    if (!requireMainAdmin(req, res)) return;
    const branch = await Branch.findOne({
      _id: req.params.id,
      tenantId: req.tenant?._id || req.user?.tenantId,
    });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }
    const allowedFields = [
      "name",
      "slug",
      "timezone",
      "currency",
      "phone",
      "email",
      "address",
      "geo",
      "operatingHours",
    ];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        branch[field] = field === "slug" ? normalizeBranchSlug(req.body[field]) : req.body[field];
      }
    });
    branch.metadata = {
      ...(branch.metadata || {}),
      updatedBy: req.user?._id || null,
    };
    await branch.save();
    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      data: branchToClient(branch),
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateBranchStatus = async (req, res, next) => {
  try {
    if (!requireMainAdmin(req, res)) return;
    const status = String(req.body.status || "").toLowerCase();
    if (!["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch status",
      });
    }
    const branch = await Branch.findOne({
      _id: req.params.id,
      tenantId: req.tenant?._id || req.user?.tenantId,
    });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }
    if (branch.type === "main" && status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Main branch cannot be deactivated or suspended",
      });
    }
    branch.status = status;
    branch.metadata = {
      ...(branch.metadata || {}),
      updatedBy: req.user?._id || null,
    };
    await branch.save();
    return res.status(200).json({
      success: true,
      message: "Branch status updated successfully",
      data: branchToClient(branch),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getBranchSummary = async (req, res, next) => {
  try {
    const tenant = await getTenant(req);
    const tenantId = tenant?._id || req.tenant?._id || req.user?.tenantId;
    await ensureMainBranch(tenant, req.user?._id || null);
    const currentBranchCount = await Branch.countDocuments({
      tenantId,
      status: { $ne: "archived" },
    });
    const branchLimit = getBranchLimit(tenant);
    const creation = canCreateBranch(tenant, currentBranchCount);
    return res.status(200).json({
      success: true,
      data: {
        currentBranchCount,
        branchLimit,
        canCreateBranch: creation.allowed,
        branchLimitReached: isBranchLimitReached(tenant, currentBranchCount),
        subscriptionState: getSubscriptionState(tenant),
        plan: creation.plan,
      },
    });
  } catch (error) {
    return next(error);
  }
};
