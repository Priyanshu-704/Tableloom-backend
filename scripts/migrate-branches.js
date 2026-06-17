const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Branch = require("../models/Branch");
const { ensureMainBranch } = require("../services/branchService");
const { logger } = require("../utils/logger");

const OPERATIONAL_MODELS = [
  "MenuItem",
  "Category",
  "Size",
  "KitchenStation",
  "KitchenOrder",
  "Bill",
  "Customer",
  "Feedback",
  "Table",
  "Order",
  "InventoryItem",
  "WaiterCall",
  "Notification",
  "Cart",
];

const loadModels = () => {
  OPERATIONAL_MODELS.forEach((modelName) => {
    try {
      require(`../models/${modelName}`);
    } catch (error) {
      logger.warn(`Skipping missing model ${modelName}: ${error.message}`);
    }
  });
};

const backfillOperationalModel = async (modelName, tenantId, branchId) => {
  const Model = mongoose.models[modelName];
  if (!Model) return 0;
  const result = await Model.updateMany(
    {
      tenantId,
      $or: [{ branchId: { $exists: false } }, { branchId: null }],
    },
    { $set: { branchId } },
  );
  return result.modifiedCount || result.nModified || 0;
};

const backfillUsers = async (tenantId, mainBranchId) => {
  const admins = await User.updateMany(
    { tenantId, role: "admin" },
    {
      $set: {
        branchScope: "all",
        homeBranchId: mainBranchId,
      },
      $addToSet: { branchIds: mainBranchId },
    },
  );
  const staff = await User.updateMany(
    { tenantId, role: { $nin: ["super_admin", "admin"] } },
    {
      $set: {
        branchScope: "own",
        branchId: mainBranchId,
        homeBranchId: mainBranchId,
      },
      $addToSet: { branchIds: mainBranchId },
    },
  );
  return {
    admins: admins.modifiedCount || admins.nModified || 0,
    staff: staff.modifiedCount || staff.nModified || 0,
  };
};

const validateTenant = async (tenantId) => {
  const mainBranchCount = await Branch.countDocuments({
    tenantId,
    type: "main",
  });
  if (mainBranchCount !== 1) {
    throw new Error(`Tenant ${tenantId} has ${mainBranchCount} main branches`);
  }
};

const run = async () => {
  loadModels();
  await connectDB();

  await User.updateMany(
    { role: "super_admin" },
    {
      $set: {
        branchScope: "global",
        branchId: null,
        homeBranchId: null,
      },
      $setOnInsert: { branchIds: [] },
    },
  );

  const tenants = await Tenant.find({});
  const summary = [];

  for (const tenant of tenants) {
    const mainBranch = await ensureMainBranch(tenant);
    const modelCounts = {};
    for (const modelName of OPERATIONAL_MODELS) {
      modelCounts[modelName] = await backfillOperationalModel(
        modelName,
        tenant._id,
        mainBranch._id,
      );
    }
    const userCounts = await backfillUsers(tenant._id, mainBranch._id);
    await validateTenant(tenant._id);
    summary.push({
      tenantId: tenant._id,
      mainBranchId: mainBranch._id,
      modelCounts,
      userCounts,
    });
  }

  logger.info("Branch migration completed", summary);
  await mongoose.connection.close();
};

if (require.main === module) {
  run().catch(async (error) => {
    logger.error("Branch migration failed:", error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run };
