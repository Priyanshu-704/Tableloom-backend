const User = require("../models/User");
const {
  AllPermissions,
  expandPermissionEntries,
  getDefaultRolePermissions,
  getEffectivePermissionsForUser,
  getPermissionMetadata,
  hydrateUserPermissions,
  normalizePermission,
  resetUserCustomPermissions,
  updateUserCustomPermissions,
} = require("../utils/permissionSettings");
exports.getAvailablePermissions = async (req, res) => {
  try {
    const permissionMetadata = await getPermissionMetadata(req.user?.tenantId);
    res.json({
      success: true,
      data: {
        ...permissionMetadata,
        source: "database",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
exports.getUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "customPermissions role tenantId",
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    await hydrateUserPermissions(user);
    res.json({
      success: true,
      data: {
        permissions: user.resolvedPermissions || (await getEffectivePermissionsForUser(user)),
        customPermissions: user.customPermissions || [],
        role: user.role,
        roles: user.roles || [],
        defaultPermissions: await getDefaultRolePermissions(
          user.role,
          user?.tenantId || null,
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
exports.updateUserPermissions = async (req, res) => {
  try {
    const { permissions = [] } = req.body;
    const userId = req.params.userId;
    const invalidPermissions = permissions.filter((permission) => {
      const normalizedPermission = normalizePermission(permission);
      return !normalizedPermission || !AllPermissions.includes(normalizedPermission);
    });
    const normalizedPermissions = expandPermissionEntries(permissions);
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid permissions: ${invalidPermissions.join(", ")}`,
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        error: "Cannot update permissions for admin role",
      });
    }
    const effectivePermissions = await updateUserCustomPermissions(
      user,
      normalizedPermissions,
      req.user.id,
    );
    await user.save();
    await hydrateUserPermissions(user);
    res.json({
      success: true,
      data: {
        permissions: effectivePermissions,
        role: user.role,
        roles: user.roles || [],
        updatedBy: req.user.id,
        updatedAt: user.permissionsUpdatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
exports.resetUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    await resetUserCustomPermissions(user, req.user.id);
    await user.save();
    await hydrateUserPermissions(user);
    const defaultPermissions = await getDefaultRolePermissions(
      user.role,
      user?.tenantId || null,
    );
    res.json({
      success: true,
      data: {
        permissions: defaultPermissions,
        role: user.role,
        roles: user.roles || [],
        message: "Permissions reset to role defaults",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select(
      "customPermissions role tenantId",
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    await hydrateUserPermissions(user);
    res.json({
      success: true,
      data: {
        role: user.role,
        roles: user.roles || [],
        permissions: user.resolvedPermissions || AllPermissions,
        defaultPermissions: await getDefaultRolePermissions(
          user.role,
          user?.tenantId || null,
        ),
        source: "database",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
