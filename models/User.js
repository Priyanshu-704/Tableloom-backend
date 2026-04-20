const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Permissions, RolePermissions } = require("../config/permissions");
const { getDefaultRolePermissions } = require("../utils/permissionSettings");
const {
  MIN_PASSWORD_LENGTH,
  passwordPolicyMessage,
  validatePasswordStrength,
} = require("../utils/passwordPolicy");
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
    minlength: MIN_PASSWORD_LENGTH,
    validate: {
      validator: function (value) {
        return validatePasswordStrength(value).isValid;
      },
      message: passwordPolicyMessage,
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
  sessionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  permissionsUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  permissionsUpdatedAt: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
  refreshToken: String,
  refreshTokenExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
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
  {
    tenantId: 1,
    email: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      email: {
        $type: "string",
      },
    },
  },
);
userSchema.index({
  email: 1,
  role: 1,
  createdAt: 1,
});
userSchema.pre("save", function () {
  this.updatedAt = Date.now();
});
userSchema.pre("save", async function () {
  if (!this.customPermissions || this.customPermissions.length === 0) {
    this.customPermissions = await getDefaultRolePermissions(this.role);
  }
});
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const password = this.password;
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) {
    throw new Error(passwordPolicyMessage);
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(password, salt);
});
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};
userSchema.methods.generateRefreshToken = function () {
  const refreshToken = crypto.randomBytes(40).toString("hex");
  this.refreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  this.refreshTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return refreshToken;
};
userSchema.methods.clearRefreshToken = function () {
  this.refreshToken = undefined;
  this.refreshTokenExpires = undefined;
};
userSchema.methods.getPermissions = function () {
  if (
    Array.isArray(this.resolvedPermissions) &&
    this.resolvedPermissions.length > 0
  ) {
    return this.resolvedPermissions;
  }
  if (this.customPermissions && this.customPermissions.length > 0) {
    return this.customPermissions;
  }
  return RolePermissions[this.role] || [];
};
userSchema.methods.hasPermission = function (permission) {
  if (["super_admin", "admin"].includes(String(this.role).toLowerCase()))
    return true;
  const userPermissions = this.getPermissions();
  return userPermissions.includes(permission);
};
userSchema.methods.hasAnyPermission = function (permissionsArray) {
  if (["super_admin", "admin"].includes(String(this.role).toLowerCase()))
    return true;
  const userPermissions = this.getPermissions();
  return permissionsArray.some((permission) =>
    userPermissions.includes(permission),
  );
};
userSchema.methods.canManageRole = function (targetRole) {
  const hierarchy = {
    super_admin: ["admin", "manager", "chef", "waiter", "customer"],
    admin: ["admin", "manager", "chef", "waiter", "customer"],
    manager: ["chef", "waiter", "customer"],
    chef: [],
    waiter: [],
    customer: [],
  };
  return hierarchy[this.role]?.includes(targetRole) || false;
};
userSchema.methods.updatePermissions = function (permissions, updatedBy) {
  this.customPermissions = permissions;
  this.permissionsUpdatedBy = updatedBy;
  this.permissionsUpdatedAt = new Date();
  this.updatedBy = updatedBy;
};
userSchema.methods.resetToDefaultPermissions = function (updatedBy) {
  this.customPermissions =
    this.resolvedRolePermissions || RolePermissions[this.role] || [];
  this.permissionsUpdatedBy = updatedBy;
  this.permissionsUpdatedAt = new Date();
  this.updatedBy = updatedBy;
};
userSchema.methods.trackLogin = function () {
  this.lastLogin = new Date();
  this.loginCount = (this.loginCount || 0) + 1;
};
userSchema.statics.findByEmail = function (email) {
  return this.findOne({
    email: new RegExp(`^${email}$`, "i"),
  });
};
userSchema.statics.findActiveByRole = function (role) {
  return this.find({
    role,
    isActive: true,
  }).select("-password -refreshToken -__v");
};
userSchema.statics.getUserStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$role",
        count: {
          $sum: 1,
        },
        active: {
          $sum: {
            $cond: [
              {
                $eq: ["$isActive", true],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        role: "$_id",
        total: "$count",
        active: 1,
        inactive: {
          $subtract: ["$count", "$active"],
        },
      },
    },
    {
      $sort: {
        role: 1,
      },
    },
  ]);
  const totalUsers = await this.countDocuments();
  const activeUsers = await this.countDocuments({
    isActive: true,
  });
  return {
    total: totalUsers,
    active: activeUsers,
    inactive: totalUsers - activeUsers,
    byRole: stats,
  };
};
userSchema.virtual("fullName").get(function () {
  return this.name;
});
userSchema.virtual("formattedRole").get(function () {
  if (!this.role || typeof this.role !== "string") return "Unknown";
  return this.role.charAt(0).toUpperCase() + this.role.slice(1);
});
userSchema.virtual("isStaff").get(function () {
  return this.role !== "customer";
});
userSchema.query.active = function () {
  return this.where({
    isActive: true,
  });
};
userSchema.query.byRoles = function (roles) {
  return this.where({
    role: {
      $in: roles,
    },
  });
};
userSchema.query.search = function (searchTerm) {
  if (!searchTerm) return this;
  const regex = new RegExp(searchTerm, "i");
  return this.or([
    {
      name: regex,
    },
    {
      email: regex,
    },
  ]);
};
userSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.refreshTokenExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    ret.permissions = doc.getPermissions();
    return ret;
  },
});
userSchema.set("toObject", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.refreshTokenExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    ret.permissions = doc.getPermissions();
    return ret;
  },
});
module.exports = mongoose.model("User", userSchema);
