const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const pushNotificationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
    },
    audience: {
      type: String,
      enum: ["staff", "customer"],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "manager", "chef", "waiter", "customer", null],
      default: null,
    },
    customerSessionId: {
      type: String,
      trim: true,
      default: null,
    },
    permission: {
      type: String,
      trim: true,
      default: "default",
    },
    device: {
      platform: {
        type: String,
        trim: true,
        default: "web",
      },
      userAgent: {
        type: String,
        trim: true,
        default: "",
      },
      language: {
        type: String,
        trim: true,
        default: "",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

pushNotificationTokenSchema.plugin(tenantScoped);
pushNotificationTokenSchema.index({ tenantId: 1, token: 1 }, { unique: true });
pushNotificationTokenSchema.index({ tenantId: 1, audience: 1, role: 1, isActive: 1 });
pushNotificationTokenSchema.index({ tenantId: 1, audience: 1, user: 1, isActive: 1 });
pushNotificationTokenSchema.index(
  { tenantId: 1, audience: 1, customerSessionId: 1, isActive: 1 },
  { partialFilterExpression: { customerSessionId: { $type: "string" } } }
);

module.exports = mongoose.model("PushNotificationToken", pushNotificationTokenSchema);
