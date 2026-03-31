const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a category name"],
    trim: true,
    maxlength: [50, "Category name cannot exceed 50 characters"],
  },
  description: {
    type: String,
    maxlength: [200, "Description cannot exceed 200 characters"],
  },
  image: {
    type: String,
    default: null,
  },
  imagePublicId: {
    type: String,
    default: null,
  },
  imageProvider: {
    type: String,
    default: null,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  kitchenStation: {
    type: mongoose.Schema.ObjectId,
    ref: "KitchenStation",
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
});

// Create index for better performance
categorySchema.index({ displayOrder: 1, isActive: 1 });
categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
categorySchema.plugin(tenantScoped);

module.exports = mongoose.model("Category", categorySchema);
