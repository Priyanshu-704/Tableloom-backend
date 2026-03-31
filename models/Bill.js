const { logger } = require("./../utils/logger.js");
const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const billSchema = new mongoose.Schema({
  // Bill identification
  billNumber: {
    type: String,
    unique: true,
    // required: true,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
  },

  // Bill dates
  billDate: {
    type: Date,
    default: Date.now,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  finalizedAt: Date,

  // Bill amounts
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
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },

  // Bill items
  items: [
    {
      menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      name: {
        type: String,
        required: true,
      },
      size: String,
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
    },
  ],

  // Customer info
  customerEmail: String,
  customerPhone: String,
  customerName: String,

  // Payment info
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "refunded", "failed"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "online", "upi", "wallet", "pending"],
    default: "pending",
  },
  transactionId: String,
  paidAt: Date,
  paymentGateway: String,

  // Email tracking
  emailSent: {
    type: Boolean,
    default: false,
  },
  emailSentAt: Date,
  emailError: String,
  emailRecipient: String,

  // Frontend display
  billViewed: {
    type: Boolean,
    default: false,
  },
  lastViewedAt: Date,
  viewCount: {
    type: Number,
    default: 0,
  },
  // PDF storage (MinIO)
  pdfMinioPath: {
    type: String,
  },
  pdfBucket: {
    type: String,
  },
  pdfPublicId: {
    type: String,
  },
  pdfProvider: {
    type: String,
  },
  pdfUrl: {
    type: String,
  },
  pdfGenerated: {
    type: Boolean,
    default: false,
  },
  pdfError: {
    type: String,
  },

  // Bill status
  billStatus: {
    type: String,
    enum: ["draft", "sent", "viewed", "paid", "finalized"],
    default: "draft",
  },

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },

  // Versioning for updates
  version: {
    type: Number,
    default: 1,
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

billSchema.plugin(tenantScoped);

// Update timestamps
billSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Generate bill number
billSchema.pre("save", function () {
  if (this.isNew && !this.billNumber) {
    const date = new Date();
    const dateStr =
      date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0");

    // Generate random number with timestamp
    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    this.billNumber = `BILL-${dateStr}-${timestampPart}${randomPart}`;

    logger.info(`Generated bill number: ${this.billNumber}`);
  }
});

// Indexes for better performance
billSchema.index({ sessionId: 1, createdAt: -1 });
billSchema.index({ customerEmail: 1 });
billSchema.index({ paymentStatus: 1 });
billSchema.index({ billStatus: 1 });
billSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Bill", billSchema);
