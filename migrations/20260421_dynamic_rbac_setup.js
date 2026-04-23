const mongoose = require("mongoose");
const AppSetting = require("../models/AppSetting");
const User = require("../models/User");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const UserRole = require("../models/UserRole");
const { logger } = require("../utils/logger");
const {
  ensureDefaultRbacSeedData,
  expandPermissionEntries,
  getDefaultRolePermissions,
  normalizeRoleKey,
  setRolePermissions,
  updateUserCustomPermissions,
} = require("../utils/permissionSettings");

require("dotenv").config({
  quiet: true,
});

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }
  return mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
};

const syncRbacIndexes = async () => {
  await Promise.all([
    Permission.syncIndexes(),
    Role.syncIndexes(),
    RolePermission.syncIndexes(),
    UserRole.syncIndexes(),
  ]);
};

const upsertTenantRolesFromSettings = async () => {
  const settingsDocs = await AppSetting.find({
    "staff.roles.0": {
      $exists: true,
    },
  })
    .select("tenantId staff.roles")
    .lean();

  for (const settingsDoc of settingsDocs) {
    const tenantId = settingsDoc?.tenantId || null;
    const roleDefinitions = Array.isArray(settingsDoc?.staff?.roles)
      ? settingsDoc.staff.roles
      : [];

    for (const roleDefinition of roleDefinitions) {
      const roleKey = normalizeRoleKey(roleDefinition?.key || roleDefinition?.name);
      if (!roleKey) {
        continue;
      }

      const role = await Role.findOneAndUpdate(
        {
          tenantId,
          key: roleKey,
        },
        {
          $set: {
            name: roleDefinition?.name || roleKey,
            description: `Tenant-scoped role for ${roleDefinition?.name || roleKey}`,
            isSystem: false,
            isActive: true,
            userId: null,
          },
          $setOnInsert: {
            tenantId,
            key: roleKey,
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      await setRolePermissions(role._id, roleDefinition?.permissions || []);
    }
  }
};

const findBestRoleForUser = async (user) => {
  const normalizedRoleKey = normalizeRoleKey(user?.role);
  if (!normalizedRoleKey) {
    return null;
  }

  return (
    (await Role.findOne({
      tenantId: user?.tenantId || null,
      key: normalizedRoleKey,
    })) ||
    (await Role.findOne({
      tenantId: null,
      key: normalizedRoleKey,
    }))
  );
};

const backfillUserRoles = async () => {
  const users = await User.find({})
    .select("_id name email role tenantId customPermissions updatedBy");

  for (const user of users) {
    const matchedRole = await findBestRoleForUser(user);
    if (matchedRole) {
      await UserRole.updateOne(
        {
          userId: user._id,
          roleId: matchedRole._id,
        },
        {
          $setOnInsert: {
            userId: user._id,
            roleId: matchedRole._id,
            assignedBy: user.updatedBy || user._id,
          },
        },
        {
          upsert: true,
        },
      );
    }

    const normalizedCustomPermissions = expandPermissionEntries(
      user.customPermissions || [],
    );
    const defaultPermissions = await getDefaultRolePermissions(
      user.role,
      user?.tenantId || null,
    );

    if (
      normalizedCustomPermissions.length > 0 &&
      JSON.stringify([...normalizedCustomPermissions].sort()) !==
        JSON.stringify([...defaultPermissions].sort())
    ) {
      await updateUserCustomPermissions(
        user,
        normalizedCustomPermissions,
        user.updatedBy || user._id,
      );
      await user.save({
        validateBeforeSave: false,
      });
    }
  }
};

const migrateDynamicRbac = async () => {
  logger.info("Starting RBAC migration and backfill...");
  await connectDB();
  await syncRbacIndexes();
  await ensureDefaultRbacSeedData({ force: true });
  await upsertTenantRolesFromSettings();
  await backfillUserRoles();
  logger.info("RBAC migration completed successfully.");
};

if (require.main === module) {
  migrateDynamicRbac()
    .then(async () => {
      await mongoose.connection.close();
    })
    .catch(async (error) => {
      logger.error("RBAC migration failed:", error);
      await mongoose.connection.close();
      process.exit(1);
    });
}

module.exports = {
  migrateDynamicRbac,
};
