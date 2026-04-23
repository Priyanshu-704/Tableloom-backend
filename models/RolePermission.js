const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

rolePermissionSchema.index(
  {
    roleId: 1,
    permissionId: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
