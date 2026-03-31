const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a size name"],
      trim: true,
      maxlength: 50,
    },
    code: { type: String, required: true },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

sizeSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

sizeSchema.index({ tenantId: 1, name: 1 }, { unique: true });
sizeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
sizeSchema.plugin(tenantScoped);

module.exports = mongoose.model("Size", sizeSchema);
