const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["main", "sub"],
      required: true,
    },
    parentBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "archived"],
      default: "active",
    },
    timezone: {
      type: String,
      trim: true,
      default: "",
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INR",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    address: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      postalCode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
    },
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    operatingHours: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paymentGateway: {
      provider: {
        type: String,
        enum: ["razorpay", "none"],
        default: "none",
      },
      status: {
        type: String,
        enum: ["inactive", "active"],
        default: "inactive",
      },
      keyIdEncrypted: {
        type: String,
        trim: true,
        default: "",
      },
      keySecretEncrypted: {
        type: String,
        trim: true,
        default: "",
      },
      keyIdMask: {
        type: String,
        trim: true,
        default: "",
      },
      configuredAt: {
        type: Date,
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    metadata: {
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

branchSchema.index(
  { tenantId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "main" },
  },
);
branchSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, status: 1 });
branchSchema.index({ tenantId: 1, parentBranchId: 1 });
branchSchema.index(
  { tenantId: 1, isDefault: 1 },
  {
    sparse: true,
    partialFilterExpression: { isDefault: true },
  },
);

branchSchema.pre("validate", async function enforceBranchShape() {
  if (this.type === "main") {
    this.parentBranchId = null;
    this.isDefault = true;
    return;
  }
  if (this.type === "sub") {
    this.isDefault = false;
    if (!this.parentBranchId) {
      throw new Error("Sub-branches must reference the tenant main branch");
    }
    const mainBranch = await this.constructor
      .findOne({
        _id: this.parentBranchId,
        tenantId: this.tenantId,
        type: "main",
      })
      .select("_id");
    if (!mainBranch) {
      throw new Error(
        "Sub-branch parent must be the main branch for the same tenant",
      );
    }
  }
});

module.exports = mongoose.model("Branch", branchSchema);
