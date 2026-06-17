const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");
const branchScoped = require("../plugins/branchScoped");
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
  thumbnail: {
    type: String,
    default: null,
  },
  imagePublicId: {
    type: String,
    default: null,
  },
  thumbnailPublicId: {
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
categorySchema.index({
  displayOrder: 1,
  isActive: 1,
});
categorySchema.index(
  {
    tenantId: 1,
    branchId: 1,
    name: 1,
  },
  {
    unique: true,
  },
);
categorySchema.plugin(tenantScoped);
categorySchema.plugin(branchScoped);
module.exports = mongoose.model("Category", categorySchema);
