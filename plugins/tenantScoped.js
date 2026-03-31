const mongoose = require("mongoose");
const { getCurrentTenantId } = require("../utils/tenantContext");

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

module.exports = function tenantScopedPlugin(schema, options = {}) {
  const {
    required = true,
    index = true,
    fieldName = "tenantId",
  } = options;

  if (!schema.path(fieldName)) {
    schema.add({
      [fieldName]: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        required,
        index,
      },
    });
  }

  const applyTenantFilter = function applyTenantFilter() {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;

    const currentQuery = this.getQuery();
    if (currentQuery[fieldName]) return;

    this.where({ [fieldName]: tenantId });
  };

  queryMiddleware.forEach((middlewareName) => {
    schema.pre(middlewareName, applyTenantFilter);
  });

  schema.pre("aggregate", function applyTenantAggregateFilter() {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;

    const pipeline = this.pipeline();
    const tenantMatch = {
      $match: {
        [fieldName]: new mongoose.Types.ObjectId(String(tenantId)),
      },
    };

    const firstStage = pipeline[0] || null;
    if (firstStage?.$match?.[fieldName]) return;

    pipeline.unshift(tenantMatch);
  });

  const attachTenantIdToDocument = function attachTenantIdToDocument() {
    const tenantId = getCurrentTenantId();
    if (!this[fieldName] && tenantId) {
      this[fieldName] = tenantId;
    }
  };

  schema.pre("validate", attachTenantIdToDocument);
  schema.pre("save", attachTenantIdToDocument);

  schema.pre("insertMany", function attachTenantIds(docs) {
    const tenantId = getCurrentTenantId();
    if (!tenantId || !Array.isArray(docs)) return;

    docs.forEach((doc) => {
      if (!doc[fieldName]) {
        doc[fieldName] = tenantId;
      }
    });
  });
};
