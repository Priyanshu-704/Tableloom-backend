const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "active", "suspended", "cancelled"],
      default: "active",
    },
    subscription: {
      plan: {
        type: String,
        enum: ["starter", "growth", "enterprise"],
        default: "starter",
      },
      status: {
        type: String,
        enum: ["trial", "active", "past_due", "cancelled"],
        default: "trial",
      },
      startsAt: {
        type: Date,
        default: Date.now,
      },
      endsAt: Date,
      trialEndsAt: Date,
    },
    contact: {
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },
    branding: {
      logo: {
        type: String,
        default: "/tableloom-mark.svg",
      },
      theme: {
        type: String,
        default: "light",
      },
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    requestedAdmin: {
      name: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
      phone: {
        type: String,
        trim: true,
        default: "",
      },
    },
    onboarding: {
      source: {
        type: String,
        enum: ["platform_admin", "self_service"],
        default: "platform_admin",
      },
      verificationStatus: {
        type: String,
        enum: ["not_required", "pending", "verified", "rejected"],
        default: "not_required",
      },
      submittedAt: {
        type: Date,
        default: null,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      verificationNotes: {
        type: String,
        trim: true,
        default: "",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

tenantSchema.index({ slug: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Tenant", tenantSchema);
