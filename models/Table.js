const crypto = require("crypto");
const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: String,
    required: [true, "Please add a table number"],
    trim: true,
    uppercase: true,
  },
  tableName: {
    type: String,
    trim: true,
    maxlength: [50, "Table name cannot exceed 50 characters"],
  },
  capacity: {
    type: Number,
    required: [true, "Please add table capacity"],
    min: [1, "Capacity must be at least 1"],
    max: [50, "Capacity cannot exceed 50"],
  },
  location: {
    type: String,
    enum: ["indoor", "outdoor", "terrace", "private-room", "bar", "main hall"],
    default: "indoor",
  },
  status: {
    type: String,
    enum: [
      "available",
      "occupied",
      "billing",
      "reserved",
      "maintenance",
      "cleaning",
      "inactive",
    ],
    default: "available",
  },
  qrImageBucket: {
    type: String,
    default: null,
  },
  qrPublicId: {
    type: String,
    default: null,
  },
  qrProvider: {
    type: String,
    default: null,
  },
  qrCode: {
    type: String,
    default: null,
  },
  qrToken: {
    type: String,
    unique: true,
    sparse: true,
  },
  qrTokenExpiry: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
  currentOrder: {
    type: mongoose.Schema.ObjectId,
    ref: "Order",
    default: null,
  },
  currentCustomer: {
    type: mongoose.Schema.ObjectId,
    ref: "Customer",
    default: null,
  },
  lastOccupied: {
    type: Date,
  },
  lastCleaned: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    maxlength: [200, "Notes cannot exceed 200 characters"],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
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

tableSchema.index({ tenantId: 1, tableNumber: 1 }, { unique: true });
tableSchema.plugin(tenantScoped);

tableSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: Date.now() });
});

tableSchema.methods.generateQRToken = function () {
  this.qrToken = crypto.randomBytes(32).toString("hex");
  this.qrTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return this.qrToken;
};

tableSchema.methods.verifyQRToken = function (token) {
  if (!this.qrToken || !this.qrTokenExpiry) {
    return { isValid: false, reason: "No token generated" };
  }

  if (this.qrToken !== token) {
    return { isValid: false, reason: "Invalid token" };
  }

  if (new Date() > this.qrTokenExpiry) {
    return { isValid: false, reason: "Token expired" };
  }

  if (!this.isActive) {
    return { isValid: false, reason: "Table is inactive" };
  }

  return { isValid: true };
};

tableSchema.index({ status: 1 });
tableSchema.index({ location: 1 });
tableSchema.index({ isActive: 1 });

module.exports = mongoose.model("Table", tableSchema);
