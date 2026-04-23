const { logger } = require("./../utils/logger.js");
const User = require("../models/User");
require("dotenv").config({
  quiet: true,
});
const crypto = require("crypto");
const generatePassword = require("../utils/passwordGenerator");
const {
  sendStaffOnboardingEmail,
  sendPasswordResetEmail,
} = require("../utils/emailService");
const { Permissions } = require("../config/permissions");
const {
  assignRolesToUser,
  expandPermissionEntries,
  hydrateUserPermissions,
  normalizePermission,
  resetUserCustomPermissions,
  updateUserCustomPermissions,
} = require("../utils/permissionSettings");
const { normalizeTenantId } = require("../utils/tenantContext");
const { signAccessToken } = require("../utils/authTokens");
const {
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} = require("../utils/cookieOptions");
const {
  passwordPolicyMessage,
  validatePasswordStrength,
} = require("../utils/passwordPolicy");

const setTokensInCookies = (res, accessToken, refreshToken) => {
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
};
const clearTokensFromCookies = (res) => clearAuthCookies(res);
const canManageRole = (requesterRole, targetRole) => {
  const hierarchy = {
    super_admin: ["admin", "manager", "chef", "waiter"],
    admin: ["admin", "manager", "chef", "waiter"],
    manager: ["chef", "waiter"],
    chef: [],
    waiter: [],
  };
  return hierarchy[requesterRole]?.includes(targetRole) || false;
};
const ensureSameTenantAccess = (requester, targetUser) => {
  if (!targetUser) {
    return false;
  }
  if (requester?.role === "super_admin") {
    return true;
  }
  return (
    normalizeTenantId(requester?.tenantId) ===
    normalizeTenantId(targetUser?.tenantId)
  );
};
const shapeAuthUser = (user = {}, { permissions } = {}) => ({
  _id: user?._id || null,
  name: user?.name || "",
  email: user?.email || "",
  role: user?.role || "",
  roles: Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [
          {
            key: user.role,
            name: user.role,
          },
        ]
      : [],
  tenantId: user?.tenantId || null,
  forcePasswordChange: Boolean(user?.forcePasswordChange),
  isActive: user?.isActive !== false,
  ...(Array.isArray(permissions)
    ? {
        permissions,
      }
    : {}),
});
const shapeStaffUser = (user = {}, { permissions } = {}) => ({
  _id: user?._id || null,
  name: user?.name || "",
  email: user?.email || "",
  phone: user?.phone || "",
  role: user?.role || "",
  roles: Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [
          {
            key: user.role,
            name: user.role,
          },
        ]
      : [],
  isActive: user?.isActive !== false,
  forcePasswordChange: Boolean(user?.forcePasswordChange),
  createdAt: user?.createdAt || null,
  ...(Array.isArray(permissions)
    ? {
        permissions,
      }
    : Array.isArray(user?.customPermissions)
      ? {
          permissions: user.customPermissions,
        }
      : {}),
});
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, role, permissions = [] } = req.body;
    const requestingUser = req.user;
    const tenantId = normalizeTenantId(requestingUser.tenantId);
    if (!requestingUser.hasPermission(Permissions.USER_CREATE)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create users",
      });
    }
    if (!canManageRole(requestingUser.role, role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to register ${role} role`,
      });
    }
    const userExists = await User.findOne({
      email: String(email).trim().toLowerCase(),
      tenantId,
    });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }
    const tempPassword = generatePassword();
    const userData = {
      name,
      email,
      password: tempPassword,
      role,
      tenantId,
      forcePasswordChange: true,
      createdBy: requestingUser._id,
      updatedBy: requestingUser._id,
    };
    if (
      permissions.length > 0 &&
      requestingUser.hasPermission(Permissions.USER_MANAGE_PERMISSIONS)
    ) {
      const normalizedPermissions = expandPermissionEntries(permissions);
      const invalidPermissions = permissions.filter((permission) => {
        const normalizedPermission = normalizePermission(permission);
        return !normalizedPermission || !normalizedPermissions.includes(normalizedPermission);
      });
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid permissions: ${invalidPermissions.join(", ")}`,
        });
      }
    }
    const user = await User.create(userData);
    await assignRolesToUser(user, [role], {
      assignedBy: requestingUser._id,
    });
    if (
      permissions.length > 0 &&
      requestingUser.hasPermission(Permissions.USER_MANAGE_PERMISSIONS)
    ) {
      await updateUserCustomPermissions(user, permissions, requestingUser._id);
    } else {
      await resetUserCustomPermissions(user, requestingUser._id);
    }
    await hydrateUserPermissions(user);
    if (user) {
      const onboardingResetToken = user.getResetPasswordToken();
      await user.save({
        validateBeforeSave: false,
      });
      const emailSent = await sendStaffOnboardingEmail({
        email,
        name,
        role,
        resetToken: onboardingResetToken,
        tenant: req.tenant || null,
      });
      res.status(201).json({
        success: true,
        message:
          "Staff member registered successfully" +
          (emailSent ? " and setup email sent" : " but email failed"),
        data: {
          ...shapeStaffUser(user, {
            permissions: user.resolvedPermissions || [],
          }),
          emailSent,
        },
      });
    }
  } catch (error) {
    logger.error("Register staff error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;
    const tenantId = normalizeTenantId(req.tenant);
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    let user = null;
    if (tenantId) {
      user = await User.findOne({
        email: normalizedEmail,
        tenantId,
      }).select("+password");
    } else {
      const matchingUsers = await User.find({
        email: normalizedEmail,
      })
        .sort({
          role: 1,
          createdAt: 1,
        })
        .limit(2)
        .select("+password");
      if (matchingUsers.length > 1) {
        return res.status(400).json({
          success: false,
          message:
            "Restaurant workspace is required for this account. Please login from the restaurant workspace or provide tenant headers.",
        });
      }
      [user] = matchingUsers;
    }
    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated. Please contact administrator.",
        });
      }
      if (!tenantId && user.role !== "super_admin") {
        return res.status(403).json({
          success: false,
          message:
            "This account must sign in from its restaurant workspace admin panel. Use your tenant admin login URL.",
        });
      }
      await hydrateUserPermissions(user);
      const accessToken = signAccessToken(user);
      const refreshToken = user.generateRefreshToken();
      user.lastLogin = Date.now();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save({
        validateBeforeSave: false,
      });
      setTokensInCookies(res, accessToken, refreshToken);
      res.status(200).json({
        success: true,
        message: "Login successful",
        data: shapeAuthUser(user, {
          permissions: user.resolvedPermissions || [],
        }),
        accessToken,
        refreshToken,
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.clearRefreshToken();
      await user.save({
        validateBeforeSave: false,
      });
    }
    clearTokensFromCookies(res);
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.refreshToken = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token provided",
    });
  }
  try {
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const user = await User.findOne({
      refreshToken: hashedRefreshToken,
      refreshTokenExpires: {
        $gt: Date.now(),
      },
    });
    if (!user) {
      clearTokensFromCookies(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again.",
      });
    }
    await hydrateUserPermissions(user);
    const accessToken = signAccessToken(user);
    const rotatedRefreshToken = user.generateRefreshToken();
    await user.save({
      validateBeforeSave: false,
    });
    setTokensInCookies(res, accessToken, rotatedRefreshToken);
    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        ...shapeAuthUser(user, {
          permissions: user.resolvedPermissions || [],
        }),
        sessionId: user.sessionId,
      },
      accessToken,
      refreshToken: rotatedRefreshToken,
    });
  } catch (error) {
    logger.error("Refresh token error:", error);
    clearTokensFromCookies(res);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.getAllStaff = async (req, res) => {
  try {
    if (!req.user.hasPermission(Permissions.USER_VIEW_ALL)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view all users",
      });
    }
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
    const tenantId =
      normalizeTenantId(req.tenant) || normalizeTenantId(req.user?.tenantId);
    let query = {};
    query.role = {
      $in: ["admin", "manager", "chef", "waiter"],
    };
    query.tenantId = tenantId;
    if (role) {
      query.role = role;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        {
          name: regex,
        },
        {
          email: regex,
        },
      ];
    }
    if (req.user.role === "manager") {
      query.role = {
        $in: ["chef", "waiter"],
      };
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const users = await User.find(query)
      .select(
        "name email phone role tenantId isActive forcePasswordChange createdAt customPermissions",
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNum)
      .lean();
    const total = await User.countDocuments(query);
    const hydratedUsers = await Promise.all(
      users.map(async (user) => {
        await hydrateUserPermissions(user);
        return shapeStaffUser(user, {
          permissions: user.resolvedPermissions || [],
        });
      }),
    );
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      data: hydratedUsers,
    });
  } catch (error) {
    logger.error("Get all staff error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email role tenantId forcePasswordChange isActive",
    );
    await hydrateUserPermissions(user);
    res.status(200).json({
      success: true,
      data: shapeAuthUser(user, {
        permissions: user.resolvedPermissions || [],
      }),
    });
  } catch (error) {
    logger.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      updatedBy: req.user._id,
    };
    if (req.body.email) {
      const existingUser = await User.findOne({
        email: req.body.email,
        tenantId: req.user.tenantId,
        _id: {
          $ne: req.user._id,
        },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }
    const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    }).select("name email role tenantId forcePasswordChange isActive");
    await hydrateUserPermissions(user);
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: shapeAuthUser(user, {
        permissions: user.resolvedPermissions || [],
      }),
    });
  } catch (error) {
    logger.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    const newPassword = String(req.body?.newPassword || "");
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordPolicyMessage,
      });
    }
    const isFirstTimePasswordUpdate = Boolean(user?.forcePasswordChange);
    const isCurrentPasswordCorrect = await user.matchPassword(
      req.body?.currentPassword,
    );
    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }
    user.password = newPassword;
    user.forcePasswordChange = false;
    user.updatedBy = req.user._id;
    await user.save();
    user.clearRefreshToken();
    await user.save({
      validateBeforeSave: false,
    });
    clearTokensFromCookies(res);
    if (isFirstTimePasswordUpdate) {
      return res.status(200).json({
        success: true,
        message: "Password updated successfully. Please login again.",
        logoutRequired: true,
      });
    }
    res.status(200).json({
      success: true,
      message: "Password updated successfully. Please login again.",
      logoutRequired: true,
    });
  } catch (error) {
    logger.error("Update password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.forgotPassword = async (req, res) => {
  let user;
  try {
    const forgotPasswordQuery = {
      email: String(req.body.email || "")
        .trim()
        .toLowerCase(),
    };
    if (req.tenant?._id) {
      forgotPasswordQuery.tenantId = req.tenant._id;
    } else {
      forgotPasswordQuery.role = "super_admin";
    }
    user = await User.findOne(forgotPasswordQuery);
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists for that email, password reset instructions will be sent.",
      });
    }
    const resetToken = user.getResetPasswordToken();
    await user.save({
      validateBeforeSave: false,
    });
    const emailSent = await sendPasswordResetEmail(user.email, resetToken);
    res.status(200).json({
      success: true,
      message: emailSent
        ? "If an account exists for that email, password reset instructions will be sent."
        : "If an account exists for that email, password reset instructions will be sent.",
    });
  } catch (error) {
    logger.error("Forgot password error:", error);
    if (user) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({
        validateBeforeSave: false,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.validateResetToken = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");
    const user = await User.findOne({
      passwordResetToken: resetPasswordToken,
      passwordResetExpires: {
        $gt: Date.now(),
      },
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }
    res.status(200).json({
      success: true,
      message: "Valid reset token",
    });
  } catch (error) {
    logger.error("Validate reset token error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordPolicyMessage,
      });
    }
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");
    const user = await User.findOne({
      passwordResetToken: resetPasswordToken,
      passwordResetExpires: {
        $gt: Date.now(),
      },
    }).select("+password");
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }
    const isSameAsOldPassword = await user.matchPassword(password);
    if (isSameAsOldPassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as old password",
      });
    }
    user.password = password;
    user.forcePasswordChange = false;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.updatedBy = user._id;
    user.clearRefreshToken();
    await user.save();
    clearTokensFromCookies(res);
    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    logger.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.toggleStaffStatus = async (req, res) => {
  try {
    if (!req.user.hasPermission(Permissions.USER_CHANGE_STATUS)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change user status",
      });
    }
    const { isActive } = req.body;
    const targetUserId = req.params.id;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (!ensureSameTenantAccess(req.user, targetUser)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage users from another restaurant",
      });
    }
    if (!canManageRole(req.user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to manage ${targetUser.role} role`,
      });
    }
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot change your own status",
      });
    }
    targetUser.isActive = isActive;
    targetUser.updatedBy = req.user._id;
    await targetUser.save();
    await hydrateUserPermissions(targetUser);
    if (!isActive) {
      targetUser.clearRefreshToken();
      await targetUser.save({
        validateBeforeSave: false,
      });
    }
    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: shapeStaffUser(targetUser, {
        permissions: targetUser.resolvedPermissions || [],
      }),
    });
  } catch (error) {
    logger.error("Toggle user status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.deleteStaff = async (req, res) => {
  try {
    if (!req.user.hasPermission(Permissions.USER_DELETE)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete users",
      });
    }
    const targetUserId = req.params.id;
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (!ensureSameTenantAccess(req.user, targetUser)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage users from another restaurant",
      });
    }
    if (!canManageRole(req.user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to delete ${targetUser.role} role`,
      });
    }
    await User.findByIdAndDelete(targetUserId);
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.getUserById = async (req, res) => {
  try {
    if (!req.user.hasPermission(Permissions.USER_VIEW_ALL)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view user details",
      });
    }
    const user = await User.findById(req.params.id)
      .select("-password -refreshToken -__v")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (!ensureSameTenantAccess(req.user, user)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user",
      });
    }
    if (
      req.user.role === "manager" &&
      ["admin", "manager"].includes(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user",
      });
    }
    await hydrateUserPermissions(user);
    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        permissions: user.resolvedPermissions || [],
      },
    });
  } catch (error) {
    logger.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
exports.updateUserRole = async (req, res) => {
  try {
    if (!req.user.hasPermission(Permissions.USER_CHANGE_ROLE)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change user roles",
      });
    }
    const { role } = req.body;
    const targetUserId = req.params.id;
    if (!["admin", "manager", "chef", "waiter"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }
    if (!canManageRole(req.user.role, role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to assign ${role} role`,
      });
    }
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (!ensureSameTenantAccess(req.user, targetUser)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage users from another restaurant",
      });
    }
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot change your own role",
      });
    }
    const wasActive = targetUser.isActive;
    const currentStatus = targetUser.status || "active";
    targetUser.role = role;
    targetUser.customPermissions = [];
    targetUser.updatedBy = req.user._id;
    targetUser.isActive = wasActive;
    if (targetUser.status) {
      targetUser.status = currentStatus;
    }
    await targetUser.save();
    await assignRolesToUser(targetUser, [role], {
      assignedBy: req.user._id,
    });
    await resetUserCustomPermissions(targetUser, req.user._id);
    await hydrateUserPermissions(targetUser);
    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: shapeStaffUser(targetUser, {
        permissions: targetUser.resolvedPermissions || [],
      }),
    });
  } catch (error) {
    logger.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
