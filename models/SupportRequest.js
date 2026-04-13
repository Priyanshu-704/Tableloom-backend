const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");
const supportRequestSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["access", "tenant", "billing", "technical", "account", "other"],
      default: "other",
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2500,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: 2500,
      default: "",
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);
supportRequestSchema.plugin(tenantScoped);
supportRequestSchema.index({
  tenantId: 1,
  status: 1,
  createdAt: -1,
});
supportRequestSchema.index({
  tenantId: 1,
  createdBy: 1,
  createdAt: -1,
});
supportRequestSchema.index({
  tenantId: 1,
  respondedAt: -1,
});
module.exports = mongoose.model("SupportRequest", supportRequestSchema);
