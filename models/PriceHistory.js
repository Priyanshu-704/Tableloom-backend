const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const priceHistorySchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  sizeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Size",
  },
  oldPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  newPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  changeType: {
    type: String,
    enum: ["increase", "decrease", "initial"],
    required: true,
  },
  changePercentage: {
    type: Number,
  },
  changedBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    maxlength: 200,
  },
});

// Create indexes for better performance
priceHistorySchema.index({ menuItem: 1, changedAt: -1 });
priceHistorySchema.index({ changedAt: -1 });
priceHistorySchema.plugin(tenantScoped);

module.exports = mongoose.model("PriceHistory", priceHistorySchema);
