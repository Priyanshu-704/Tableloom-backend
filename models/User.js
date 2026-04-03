const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Permissions, RolePermissions } = require("../config/permissions");
const { getDefaultRolePermissions } = require("../utils/permissionSettings");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: 8,
    validate: {
      validator: function (value) {
        // Count each type of character
        const uppercaseCount = (value.match(/[A-Z]/g) || []).length;
        const lowercaseCount = (value.match(/[a-z]/g) || []).length;
        const numberCount = (value.match(/\d/g) || []).length;
        const specialCharCount = (
          value.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []
        ).length;

        // Check if at least 2 of each type
        const checks = [
          uppercaseCount >= 2,
          lowercaseCount >= 2,
          numberCount >= 2,
          specialCharCount >= 2,
        ];

        // All 4 conditions must be true
        return checks.every(Boolean);
      },
      message:
        "Password must be at least 8 characters with minimum 2 uppercase, 2 lowercase, 2 numbers, and 2 special characters",
    },
    select: false,
  },
  role: {
    type: String,
    enum: ["super_admin", "admin", "manager", "chef", "waiter", "customer"],
    default: "waiter",
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    default: null,
    index: true,
  },

  customPermissions: [
    {
      type: String,
      enum: Object.values(Permissions),
    },
  ],

  // For customers: link to their active session
  sessionId: {
    type: String,
    unique: true,
    sparse: true,
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  // Track who updated permissions
  permissionsUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  permissionsUpdatedAt: Date,

  isActive: {
    type: Boolean,
    default: true,
  },

  // Token management
  refreshToken: String,
  refreshTokenExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Activity tracking
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0,
  },
  forcePasswordChange: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.index(
  { tenantId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);
userSchema.index({ email: 1, role: 1, createdAt: 1 });

// ==================== MIDDLEWARE ====================

// Update timestamps
userSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Set default permissions based on role if customPermissions not set
userSchema.pre("save", async function () {
  // If customPermissions is not set or empty, set default permissions for the role
  if (!this.customPermissions || this.customPermissions.length === 0) {
    this.customPermissions = await getDefaultRolePermissions(this.role);
  }
});

// Encrypt password using bcrypt (maintaining your architecture)
userSchema.pre("save", async function () {
  // Only run if password is modified
  if (!this.isModified("password")) return;

  // Password validation
  const password = this.password;

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
  const lowercaseCount = (password.match(/[a-z]/g) || []).length;
  const numberCount = (password.match(/\d/g) || []).length;
  const specialCharCount = (
    password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []
  ).length;

  if (
    uppercaseCount < 2 ||
    lowercaseCount < 2 ||
    numberCount < 2 ||
    specialCharCount < 2
  ) {
    throw new Error(
      "Password must contain at least 2 uppercase, 2 lowercase, 2 numbers, and 2 special characters"
    );
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(password, salt);
});

// ==================== INSTANCE METHODS ====================

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Generate and store refresh token
userSchema.methods.generateRefreshToken = function () {
  const refreshToken = crypto.randomBytes(40).toString("hex");

  this.refreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  this.refreshTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  return refreshToken;
};

// Clear refresh token
userSchema.methods.clearRefreshToken = function () {
  this.refreshToken = undefined;
  this.refreshTokenExpires = undefined;
};

// Get user's permissions (returns customPermissions if set, otherwise role-based)
userSchema.methods.getPermissions = function () {
  if (Array.isArray(this.resolvedPermissions) && this.resolvedPermissions.length > 0) {
    return this.resolvedPermissions;
  }

  // If customPermissions exist and is not empty, use them
  if (this.customPermissions && this.customPermissions.length > 0) {
    return this.customPermissions;
  }

  // Otherwise use role-based permissions
  return RolePermissions[this.role] || [];
};

// Check if user has a specific permission
userSchema.methods.hasPermission = function (permission) {
  if (["super_admin", "admin"].includes(String(this.role).toLowerCase())) return true;

  const userPermissions = this.getPermissions();
  return userPermissions.includes(permission);
};

// Check if user has any of the specified permissions
userSchema.methods.hasAnyPermission = function (permissionsArray) {
  if (["super_admin", "admin"].includes(String(this.role).toLowerCase())) return true;

  const userPermissions = this.getPermissions();
  return permissionsArray.some((permission) =>
    userPermissions.includes(permission)
  );
};

// Check if user can manage another user's role
userSchema.methods.canManageRole = function (targetRole) {
  const hierarchy = {
    super_admin: ["admin", "manager", "chef", "waiter", "customer"],
    admin: ["admin", "manager", "chef", "waiter", "customer"],
    manager: ["chef", "waiter", "customer"],
    chef: [], // Chefs cannot manage any roles
    waiter: [], // Waiters cannot manage any roles
    customer: [], // Customers cannot manage any roles
  };

  return hierarchy[this.role]?.includes(targetRole) || false;
};

// Update permissions and track who updated them
userSchema.methods.updatePermissions = function (permissions, updatedBy) {
  this.customPermissions = permissions;
  this.permissionsUpdatedBy = updatedBy;
  this.permissionsUpdatedAt = new Date();
  this.updatedBy = updatedBy;
};

// Reset to default role permissions
userSchema.methods.resetToDefaultPermissions = function (updatedBy) {
  this.customPermissions =
    this.resolvedRolePermissions || RolePermissions[this.role] || [];
  this.permissionsUpdatedBy = updatedBy;
  this.permissionsUpdatedAt = new Date();
  this.updatedBy = updatedBy;
};

// Track login activity
userSchema.methods.trackLogin = function () {
  this.lastLogin = new Date();
  this.loginCount = (this.loginCount || 0) + 1;
};

// ==================== STATIC METHODS ====================

// Find user by email (case insensitive)
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: new RegExp(`^${email}$`, "i") });
};

// Get all active users by role
userSchema.statics.findActiveByRole = function (role) {
  return this.find({
    role,
    isActive: true,
  }).select("-password -refreshToken -__v");
};

// Get user statistics
userSchema.statics.getUserStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
      },
    },
    {
      $project: {
        role: "$_id",
        total: "$count",
        active: 1,
        inactive: { $subtract: ["$count", "$active"] },
      },
    },
    { $sort: { role: 1 } },
  ]);

  const totalUsers = await this.countDocuments();
  const activeUsers = await this.countDocuments({ isActive: true });

  return {
    total: totalUsers,
    active: activeUsers,
    inactive: totalUsers - activeUsers,
    byRole: stats,
  };
};

// ==================== VIRTUAL PROPERTIES ====================

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return this.name;
});

// Virtual for formatted role
userSchema.virtual("formattedRole").get(function () {
  if (!this.role || typeof this.role !== "string") return "Unknown";
  return this.role.charAt(0).toUpperCase() + this.role.slice(1);
});

// Virtual to check if user is staff (not customer)
userSchema.virtual("isStaff").get(function () {
  return this.role !== "customer";
});

// ==================== QUERY HELPERS ====================

// Query helper to exclude inactive users
userSchema.query.active = function () {
  return this.where({ isActive: true });
};

// Query helper to filter by multiple roles
userSchema.query.byRoles = function (roles) {
  return this.where({ role: { $in: roles } });
};

// Query helper to search by name or email
userSchema.query.search = function (searchTerm) {
  if (!searchTerm) return this;

  const regex = new RegExp(searchTerm, "i");
  return this.or([{ name: regex }, { email: regex }]);
};

userSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    // Remove sensitive fields
    delete ret.password;
    delete ret.refreshToken;
    delete ret.refreshTokenExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;

    // Add computed permissions
    ret.permissions = doc.getPermissions();

    return ret;
  },
});

// Ensure we don't expose permissions in toObject() either
userSchema.set("toObject", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    // Remove sensitive fields
    delete ret.password;
    delete ret.refreshToken;
    delete ret.refreshTokenExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;

    // Add computed permissions
    ret.permissions = doc.getPermissions();

    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
