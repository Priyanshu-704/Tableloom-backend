const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
      default: "percentage",
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.methods.isCurrentlyValid = function () {
  const now = new Date();

  if (!this.isActive) {
    return false;
  }

  if (this.startDate && new Date(this.startDate) > now) {
    return false;
  }

  if (this.endDate && new Date(this.endDate) < now) {
    return false;
  }

  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return false;
  }

  return true;
};

couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
couponSchema.index({ tenantId: 1, code: 1 }, { unique: true });
couponSchema.plugin(tenantScoped);

module.exports = mongoose.model("Coupon", couponSchema);
