const mongoose = require("mongoose");

const userRoleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userRoleSchema.index(
  {
    userId: 1,
    roleId: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("UserRole", userRoleSchema);
