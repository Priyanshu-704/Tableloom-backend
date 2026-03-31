const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const inventoryItemSchema = new mongoose.Schema({
  ingredientName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  relatedMenuItems: [
    {
      menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
      },
      quantityRequired: {
        type: Number,
        min: 0,
        default: 1,
      },
    },
  ],
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
  },
  unit: {
    type: String,
    trim: true,
    default: "pcs",
    maxlength: 20,
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  minimumStock: {
    type: Number,
    min: 0,
    default: 5,
  },
  reorderQuantity: {
    type: Number,
    min: 0,
    default: 10,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  lastRestockedAt: {
    type: Date,
    default: null,
  },
  lastAdjustedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, {
  timestamps: true,
});

inventoryItemSchema.index({ tenantId: 1, ingredientName: 1 }, { unique: true });
inventoryItemSchema.index(
  { tenantId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string" } } }
);
inventoryItemSchema.plugin(tenantScoped);

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
