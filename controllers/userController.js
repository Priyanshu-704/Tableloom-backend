const { logger } = require("./../utils/logger.js");
const User = require("../models/User");
require("dotenv").config({ quiet: true });
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const generatePassword = require("../utils/passwordGenerator");
const {
  sendStaffCredentials,
  sendPasswordResetEmail,
} = require("../utils/emailService");
const { Permissions } = require("../config/permissions");
const {
  getDefaultRolePermissions,
  getEffectivePermissionsForUser,
  hydrateUserPermissions,
} = require("../utils/permissionSettings");
const { normalizeTenantId } = require("../utils/tenantContext");

// Generate JWT Access Token
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "1h",
  });
};

// Set tokens in cookies
// const setTokensInCookies = (res, refreshToken) => {
//   // Cookie options based on environment
//   const cookieOptions = {
//     httpOnly: process.env.COOKIE_HTTPONLY === "true",
//     secure:
//       process.env.NODE_ENV === "production" &&
//       process.env.COOKIE_SECURE === "true",
//     sameSite: process.env.COOKIE_SAMESITE || "none",
//   };

//   // Add domain in production
//   if (process.env.NODE_ENV === "production" && process.env.COOKIE_DOMAIN) {
//     cookieOptions.domain = process.env.COOKIE_DOMAIN;
//   }

//   // Set refresh token cookie (7 days)
//   res.cookie("refreshToken", refreshToken, {
//     ...cookieOptions,
//     maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
//     path: "/",
//   });
// };

const setTokensInCookies = (res, refreshToken) => {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd, // ❗ prod = true, local = false
    sameSite: isProd ? "none" : "lax", // ❗ KEY FIX
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

// Clear tokens from cookies
const clearTokensFromCookies = (res) => {
  const cookieOptions = {
    httpOnly: process.env.COOKIE_HTTPONLY === "true",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE || "none",
  };

  if (process.env.NODE_ENV === "production" && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  res.clearCookie("refreshToken", cookieOptions);
};

// Helper function to check if user can manage specific role
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
    normalizeTenantId(requester?.tenantId) === normalizeTenantId(targetUser?.tenantId)
  );
};

// @desc    Register a new staff member
// @route   POST /api/users/register
// @access  Private (Admin with USER_CREATE, Manager with USER_CREATE but limited roles)
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, role, permissions = [] } = req.body;
    const requestingUser = req.user;
    const tenantId = normalizeTenantId(requestingUser.tenantId);

    // Check permission for creating users
    if (!requestingUser.hasPermission(Permissions.USER_CREATE)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create users",
      });
    }

    // Check if requester can manage the target role
    if (!canManageRole(requestingUser.role, role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to register ${role} role`,
      });
    }

    // Check if user exists
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

    // Generate random password
    const tempPassword = generatePassword();
    logger.info("Generated Temp Password:", tempPassword);

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
      // Validate permissions
      const allPermissions = Object.values(Permissions);
      const invalidPermissions = permissions.filter(
        (p) => !allPermissions.includes(p),
      );

      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid permissions: ${invalidPermissions.join(", ")}`,
        });
      }

      userData.customPermissions = permissions;
    } else {
      // Use default permissions for the role
      userData.customPermissions = await getDefaultRolePermissions(role);
    }

    // Create user
    const user = await User.create(userData);
    await hydrateUserPermissions(user);

    if (user) {
      // Send credentials email
      const emailSent = await sendStaffCredentials(
        email,
        name,
        tempPassword,
        role,
      );

      res.status(201).json({
        success: true,
        message:
          "Staff member registered successfully" +
          (emailSent ? " and credentials emailed" : " but email failed"),
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          forcePasswordChange: user.forcePasswordChange,
          emailSent: emailSent,
          permissions: await getEffectivePermissionsForUser(user),
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

// @desc    Login staff member
// @route   POST /api/users/login
// @access  Public
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
        .sort({ role: 1, createdAt: 1 })
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
      // Check if user is active
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

      // Generate access token with permissions
      const accessToken = generateAccessToken(user._id);

      // Generate and store refresh token
      const refreshToken = user.generateRefreshToken();

      // Update last login
      user.lastLogin = Date.now();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save({ validateBeforeSave: false });

      // Set tokens in cookies after persistence succeeds
      setTokensInCookies(res, refreshToken);

      res.status(200).json({
        success: true,
        message: "Login successful",
        accessToken,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          forcePasswordChange: user.forcePasswordChange,
        },
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

// @desc    Logout user / Clear refresh token
// @route   POST /api/users/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Clear refresh token from database
    if (user) {
      user.clearRefreshToken();
      await user.save({ validateBeforeSave: false });
    }

    // Clear tokens from cookies
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

// @desc    Refresh access token using refresh token
// @route   POST /api/users/refresh-token
// @access  Public (with refresh token)
exports.refreshToken = async (req, res) => {
  // const refreshToken = req.cookies?.refreshToken;
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  logger.info("Received Refresh Token:", refreshToken);
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  try {
    // Hash the refresh token to compare with stored hash
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const user = await User.findOne({
      refreshToken: hashedRefreshToken,
      refreshTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      // Clear invalid cookies
      clearTokensFromCookies(res);

      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please login again.",
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user._id);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        forcePasswordChange: user.forcePasswordChange,
        permissions: await getEffectivePermissionsForUser(user),
        sessionId: user.sessionId, // For customers
      },
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

// @desc    Get all staff members
// @route   GET /api/users/staff
// @access  Private (Admin/Manager with USER_VIEW_ALL permission)
exports.getAllStaff = async (req, res) => {
  try {
    // Check permission for viewing all users
    if (!req.user.hasPermission(Permissions.USER_VIEW_ALL)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view all users",
      });
    }

    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    let query = {};

    // Filter by role (exclude customers for staff view)
    query.role = { $in: ["admin", "manager", "chef", "waiter"] };
    query.tenantId = req.user.tenantId;

    if (role) {
      query.role = role;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ name: regex }, { email: regex }];
    }

    // Managers can only view chefs and waiters (not other managers or admins)
    if (req.user.role === "manager") {
      query.role = { $in: ["chef", "waiter"] };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const users = await User.find(query)
      .select("-password -refreshToken -__v -customPermissions")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      data: users.map((user) => ({
        ...user,
        createdBy: user.createdBy
          ? { id: user.createdBy._id, name: user.createdBy.name }
          : null,
        updatedBy: user.updatedBy
          ? { id: user.updatedBy._id, name: user.updatedBy.name }
          : null,
        lastLogin: user.lastLogin || null,
      })),
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

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -refreshToken -customPermissions",
    );

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        tenantId: user.tenantId,
      },
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

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      updatedBy: req.user._id,
    };

    // Check if email is being changed
    if (req.body.email) {
      const existingUser = await User.findOne({
        email: req.body.email,
        tenantId: req.user.tenantId,
        _id: { $ne: req.user._id },
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
    }).select("-password -refreshToken -customPermissions");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        ...user.toObject(),
        tenantId: user.tenantId,
      },
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

// @desc    Update password
// @route   PUT /api/users/update-password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    const isFirstTimePasswordUpdate = Boolean(user?.forcePasswordChange);

    // Check current password
    const isCurrentPasswordCorrect = await user.matchPassword(
      req.body?.currentPassword,
    );
    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = req.body?.newPassword;
    user.forcePasswordChange = false;
    user.updatedBy = req.user._id;
    await user.save();

    // Clear refresh token on password change for security and to force a fresh login
    user.clearRefreshToken();
    await user.save({ validateBeforeSave: false });

    // Clear cookies so the frontend can return the user to login cleanly
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

// @desc    Forgot password
// @route   POST /api/users/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  let user;
  try {
    const forgotPasswordQuery = {
      email: String(req.body.email || "").trim().toLowerCase(),
    };

    if (req.tenant?._id) {
      forgotPasswordQuery.tenantId = req.tenant._id;
    } else {
      forgotPasswordQuery.role = "super_admin";
    }

    user = await User.findOne(forgotPasswordQuery);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with that email",
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    logger.info("Generated Reset Token:", resetToken);
    await user.save({ validateBeforeSave: false });

    const emailSent = await sendPasswordResetEmail(user.email, resetToken);

    res.status(200).json({
      success: true,
      message: emailSent
        ? "Password reset email sent"
        : "Email could not be sent",
    });
  } catch (error) {
    logger.error("Forgot password error:", error);

    if (user) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Validate reset token
// @route   GET /api/users/validate-reset-token/:resetToken
// @access  Public
exports.validateResetToken = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: resetPasswordToken,
      passwordResetExpires: { $gt: Date.now() },
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
      data: {
        email: user.email,
      },
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

// @desc    Reset password
// @route   PUT /api/users/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    // Validate new password
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: resetPasswordToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Check if new password is same as old password
    const isSameAsOldPassword = await user.matchPassword(password);
    if (isSameAsOldPassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as old password",
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.updatedBy = user._id; // Self-update

    // Clear refresh token on password reset
    user.clearRefreshToken();

    await user.save();

    // Clear any existing cookies
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

// @desc    Activate/Deactivate staff member
// @route   PUT /api/users/:id/status
// @access  Private (Admin/Manager with USER_CHANGE_STATUS permission)
exports.toggleStaffStatus = async (req, res) => {
  try {
    // Check permission for changing user status
    if (!req.user.hasPermission(Permissions.USER_CHANGE_STATUS)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change user status",
      });
    }

    const { isActive } = req.body;
    const targetUserId = req.params.id;

    // Get target user
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

    // Check if requester can manage this user's role
    if (!canManageRole(req.user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to manage ${targetUser.role} role`,
      });
    }

    // Cannot deactivate yourself
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot change your own status",
      });
    }

    // Update user status
    targetUser.isActive = isActive;
    targetUser.updatedBy = req.user._id;
    await targetUser.save();

    // Clear refresh token if deactivating
    if (!isActive) {
      targetUser.clearRefreshToken();
      await targetUser.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        isActive: targetUser.isActive,
        permissions: await getEffectivePermissionsForUser(targetUser),
      },
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

// @desc    Delete staff member
// @route   DELETE /api/users/:id
// @access  Private (Admin with USER_DELETE permission)
exports.deleteStaff = async (req, res) => {
  try {
    // Check permission for deleting users
    if (!req.user.hasPermission(Permissions.USER_DELETE)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete users",
      });
    }

    const targetUserId = req.params.id;

    // Cannot delete yourself
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Get target user
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

    // Check if requester can manage this user's role
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

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin/Manager with USER_VIEW_ALL permission)
exports.getUserById = async (req, res) => {
  try {
    // Check permission for viewing user details
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

    // Managers can only view chefs and waiters
    if (
      req.user.role === "manager" &&
      ["admin", "manager"].includes(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        permissions: await getEffectivePermissionsForUser(user),
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

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private (Admin with USER_CHANGE_ROLE permission)
exports.updateUserRole = async (req, res) => {
  try {
    // Check permission for changing user role
    if (!req.user.hasPermission(Permissions.USER_CHANGE_ROLE)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change user roles",
      });
    }

    const { role } = req.body;
    const targetUserId = req.params.id;

    // Validate role
    if (!["admin", "manager", "chef", "waiter"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Check if requester can manage the target role
    if (!canManageRole(req.user.role, role)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to assign ${role} role`,
      });
    }

    // Get target user
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

    // Cannot change your own role
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot change your own role",
      });
    }

    const wasActive = targetUser.isActive;
    const currentStatus = targetUser.status || "active";

    // Update user role and permissions
    targetUser.role = role;
    targetUser.customPermissions = await getDefaultRolePermissions(role);
    targetUser.updatedBy = req.user._id;
    targetUser.isActive = wasActive;

    if (targetUser.status) {
      targetUser.status = currentStatus;
    }

    await targetUser.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        isActive: targetUser.isActive,
        status: targetUser.status || "active",
        permissions: await getEffectivePermissionsForUser(targetUser),
      },
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
