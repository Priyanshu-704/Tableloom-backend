const {
  logger
} = require("./../utils/logger.js");
const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");
const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    unique: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer"
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table"
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  finalizedAt: Date,
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0
  },
  taxInclusive: {
    type: Boolean,
    default: false
  },
  serviceCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  serviceChargeRate: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: "INR"
  },
  currencySymbol: {
    type: String,
    default: "₹"
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem"
    },
    name: {
      type: String,
      required: true
    },
    size: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  customerEmail: String,
  customerPhone: String,
  customerName: String,
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "refunded", "failed"],
    default: "pending"
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "online", "upi", "wallet", "pending"],
    default: "pending"
  },
  transactionId: String,
  paidAt: Date,
  paymentGateway: String,
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  emailError: String,
  emailRecipient: String,
  billViewed: {
    type: Boolean,
    default: false
  },
  lastViewedAt: Date,
  viewCount: {
    type: Number,
    default: 0
  },
  pdfMinioPath: {
    type: String
  },
  pdfBucket: {
    type: String
  },
  pdfPublicId: {
    type: String
  },
  pdfProvider: {
    type: String
  },
  pdfUrl: {
    type: String
  },
  pdfGenerated: {
    type: Boolean,
    default: false
  },
  pdfError: {
    type: String
  },
  billStatus: {
    type: String,
    enum: ["draft", "sent", "viewed", "paid", "finalized"],
    default: "draft"
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  version: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
billSchema.plugin(tenantScoped);
billSchema.pre("save", function () {
  this.updatedAt = Date.now();
});
billSchema.pre("save", function () {
  if (this.isNew && !this.billNumber) {
    const date = new Date();
    const dateStr = date.getFullYear().toString().slice(-2) + (date.getMonth() + 1).toString().padStart(2, "0") + date.getDate().toString().padStart(2, "0");
    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    this.billNumber = `BILL-${dateStr}-${timestampPart}${randomPart}`;
    logger.info(`Generated bill number: ${this.billNumber}`);
  }
});
billSchema.index({
  sessionId: 1,
  createdAt: -1
});
billSchema.index({
  customerEmail: 1
});
billSchema.index({
  paymentStatus: 1
});
billSchema.index({
  billStatus: 1
});
billSchema.index({
  createdAt: -1
});
module.exports = mongoose.model("Bill", billSchema);
