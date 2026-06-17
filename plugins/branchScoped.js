const mongoose = require("mongoose");
const { getCurrentBranchId } = require("../utils/branchContext");

const queryMiddleware = [
  "countDocuments",
  "deleteMany",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndUpdate",
  "updateMany",
  "updateOne",
];

module.exports = function branchScopedPlugin(schema, options = {}) {
  const { required = false, index = true, fieldName = "branchId" } = options;
  if (!schema.path(fieldName)) {
    schema.add({
      [fieldName]: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required,
        default: null,
        index,
      },
    });
  }

  const applyBranchFilter = function applyBranchFilter() {
    const branchId = getCurrentBranchId();
    if (!branchId) return;
    const currentQuery = this.getQuery();
    if (Object.prototype.hasOwnProperty.call(currentQuery, fieldName)) return;
    this.where({ [fieldName]: branchId });
  };

  queryMiddleware.forEach((middlewareName) => {
    schema.pre(middlewareName, applyBranchFilter);
  });

  schema.pre("aggregate", function applyBranchAggregateFilter() {
    const branchId = getCurrentBranchId();
    if (!branchId) return;
    const pipeline = this.pipeline();
    const firstStage = pipeline[0] || null;
    if (firstStage?.$match?.[fieldName]) return;
    pipeline.unshift({
      $match: {
        [fieldName]: new mongoose.Types.ObjectId(String(branchId)),
      },
    });
  });

  const attachBranchIdToDocument = function attachBranchIdToDocument() {
    const branchId = getCurrentBranchId();
    if (branchId) this[fieldName] = branchId;
  };

  schema.pre("validate", attachBranchIdToDocument);
  schema.pre("save", attachBranchIdToDocument);
  schema.pre("insertMany", function attachBranchIds(docs) {
    const branchId = getCurrentBranchId();
    if (!branchId || !Array.isArray(docs)) return;
    docs.forEach((doc) => {
      doc[fieldName] = branchId;
    });
  });
};
