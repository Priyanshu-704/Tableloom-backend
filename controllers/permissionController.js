const User = require('../models/User');
const {
  AllPermissions,
  getDefaultRolePermissions,
  getEffectivePermissionsForUser,
  getPermissionMetadata,
  hydrateUserPermissions,
} = require('../utils/permissionSettings');

// Get all available permissions
exports.getAvailablePermissions = async (req, res) => {
  try {
    const permissionMetadata = await getPermissionMetadata();

    res.json({
      success: true,
      data: {
        ...permissionMetadata,
        source: 'database',
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get user permissions
exports.getUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('customPermissions role');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    await hydrateUserPermissions(user);

    res.json({
      success: true,
      data: {
        permissions: await getEffectivePermissionsForUser(user),
        customPermissions: user.customPermissions || [],
        role: user.role,
        defaultPermissions: await getDefaultRolePermissions(user.role)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Update user permissions
exports.updateUserPermissions = async (req, res) => {
  try {
    const { permissions = [] } = req.body;
    const userId = req.params.userId;
    
    // Validate permissions
    const invalidPermissions = permissions.filter(
      perm => !AllPermissions.includes(perm)
    );
    
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid permissions: ${invalidPermissions.join(', ')}`
      });
    }
    
    // Get the user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update permissions for admin role'
      });
    }
    
    // Update permissions
    user.updatePermissions(permissions, req.user.id);
    
    await user.save();
    
    res.json({
      success: true,
      data: {
        permissions: await getEffectivePermissionsForUser(user),
        role: user.role,
        updatedBy: req.user.id,
        updatedAt: user.permissionsUpdatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Reset user permissions to role defaults
exports.resetUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const defaultPermissions = await getDefaultRolePermissions(user.role);
    user.customPermissions = defaultPermissions;
    user.permissionsUpdatedBy = req.user.id;
    user.permissionsUpdatedAt = new Date();
    user.updatedBy = req.user.id;

    await user.save();
    
    res.json({
      success: true,
      data: {
        permissions: defaultPermissions,
        role: user.role,
        message: 'Permissions reset to role defaults'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get permissions of logged-in user
exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.id; 

    const user = await User.findById(userId).select("customPermissions role");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const effectivePermissions =
      user.role === "super_admin"
        ? AllPermissions
        : await getEffectivePermissionsForUser(user);

    res.json({
      success: true,
      data: {
        role: user.role,
        permissions: effectivePermissions,
        defaultPermissions: await getDefaultRolePermissions(user.role),
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
