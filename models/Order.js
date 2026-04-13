const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");
const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: "Customer",
    required: true,
  },
  sessionId: {
    type: String,
    index: true,
  },
  table: {
    type: mongoose.Schema.ObjectId,
    ref: "Table",
    required: true,
  },
  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "served",
      "completed",
      "cancelled",
    ],
    default: "pending",
  },
  orderType: {
    type: String,
    enum: ["dine-in", "takeaway", "delivery"],
    default: "dine-in",
  },
  items: [
    {
      menuItem: {
        type: mongoose.Schema.ObjectId,
        ref: "MenuItem",
        required: true,
      },
      sizeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Size",
        required: false,
      },
      sizeName: {
        type: String,
        required: false,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      unitPrice: {
        type: Number,
        required: true,
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
      itemStatus: {
        type: String,
        enum: ["pending", "preparing", "ready", "served", "cancelled"],
        default: "pending",
      },
    },
  ],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxInclusive: {
    type: Boolean,
    default: false,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  serviceCharge: {
    type: Number,
    default: 0,
    min: 0,
  },
  serviceChargeRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: "INR",
  },
  currencySymbol: {
    type: String,
    default: "₹",
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "online"],
    default: "cash",
  },
  paymentDetails: {
    transactionId: String,
    paymentGateway: String,
    paidAmount: Number,
    paidAt: Date,
  },
  specialInstructions: {
    type: String,
    maxlength: 500,
  },
  preparationTime: {
    type: Number,
    default: 0,
  },
  estimatedReadyTime: {
    type: Date,
  },
  orderPlacedAt: {
    type: Date,
    default: Date.now,
  },
  orderConfirmedAt: {
    type: Date,
  },
  orderCompletedAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  cancelledBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  cancellationReason: {
    type: String,
    maxlength: 200,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  lastUpdatedAt: {
    type: Date,
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  preparedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  readyBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  servedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  hasFeedback: {
    type: Boolean,
    default: false,
  },
});
orderSchema.plugin(tenantScoped);
orderSchema.pre("save", function () {
  this.updatedAt = Date.now();
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    this.orderNumber = `ORD-${timestamp}${random}`;
  }
});
orderSchema.pre("save", function () {
  if (
    this.isModified("items") ||
    this.isModified("subtotal") ||
    this.isModified("taxAmount") ||
    this.isModified("discountAmount") ||
    this.isModified("serviceCharge")
  ) {
    if (this.isModified("items") && this.items.length > 0) {
      this.subtotal = this.items.reduce(
        (total, item) => total + item.totalPrice,
        0,
      );
    }
    this.totalAmount = this.taxInclusive
      ? this.subtotal + this.serviceCharge - this.discountAmount
      : this.subtotal +
        this.taxAmount +
        this.serviceCharge -
        this.discountAmount;
  }
});
orderSchema.index({
  customer: 1,
});
orderSchema.index({
  table: 1,
});
orderSchema.index({
  status: 1,
});
orderSchema.index({
  paymentStatus: 1,
});
orderSchema.index({
  sessionId: 1,
  orderPlacedAt: -1,
});
orderSchema.index({
  orderPlacedAt: -1,
});
orderSchema.index({
  createdAt: -1,
});
module.exports = mongoose.model("Order", orderSchema);
