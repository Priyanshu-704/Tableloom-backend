const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const cartSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: "Customer",
    required: true,
  },
  table: {
    type: mongoose.Schema.ObjectId,
    ref: "Table",
    required: true,
  },
  items: [
    {
      menuItem: {
        type: mongoose.Schema.ObjectId,
        ref: "MenuItem",
        required: true,
      },
      sizeId: {
        type: mongoose.Schema.ObjectId,
        ref: "Size",
        required: true,
      },
      sizeName: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
      unitPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      originalUnitPrice: {
        type: Number,
        min: 0,
        default: 0,
      },
      unitDiscountAmount: {
        type: Number,
        min: 0,
        default: 0,
      },
      itemDiscountAmount: {
        type: Number,
        min: 0,
        default: 0,
      },
      costPrice: {
        type: Number,
        min: 0,
      },
      totalPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      specialInstructions: {
        type: String,
        maxlength: 200,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  subtotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  serviceCharge: {
    type: Number,
    default: 0,
    min: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  itemDiscountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  couponDiscountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  appliedCoupon: {
    couponId: {
      type: mongoose.Schema.ObjectId,
      ref: "Coupon",
      default: null,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  itemCount: {
    type: Number,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000),
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

cartSchema.plugin(tenantScoped);

cartSchema.pre("save", function () {
  this.updatedAt = Date.now();
  this.lastUpdated = new Date();
});

cartSchema.pre("save", function () {
  if (this.isModified("items")) {
    this.itemCount = this.items.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    this.subtotal = this.items.reduce((total, item) => {
      const basePrice =
        Number(item.originalUnitPrice || item.unitPrice || 0) *
        Number(item.quantity || 0);
      return total + basePrice;
    }, 0);
    this.itemDiscountAmount = this.items.reduce(
      (total, item) => total + Number(item.itemDiscountAmount || 0),
      0
    );
    this.discountAmount =
      Number(this.itemDiscountAmount || 0) + Number(this.couponDiscountAmount || 0);
  }
});

cartSchema.pre("validate", function () {
  if (this.discountAmount > this.subtotal) {
    this.discountAmount = 0;
  }

  if (this.totalAmount < 0) {
    this.totalAmount = 0;
  }
});

cartSchema.virtual("totalAmount").get(function () {
  const subtotal = this.subtotal || 0;
  const discount = this.discountAmount || 0;
  const tax = this.taxAmount || 0;
  const service = this.serviceCharge || 0;

  const total = subtotal - discount + tax + service;
  return total < 0 ? 0 : total;
});

cartSchema.set("toJSON", { virtuals: true });
cartSchema.set("toObject", { virtuals: true });

cartSchema.index({ customer: 1 });
cartSchema.index({ table: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Cart", cartSchema);
