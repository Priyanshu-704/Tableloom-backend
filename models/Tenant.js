const mongoose = require("mongoose");
const {
  TENANT_KEY_PATTERN,
  TENANT_SLUG_PATTERN,
} = require("../utils/tenantWorkspace");
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
      match: [
        TENANT_SLUG_PATTERN,
        "Tenant slug can include lowercase letters, numbers, and hyphens only",
      ],
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        TENANT_KEY_PATTERN,
        "Tenant key can include lowercase letters, numbers, and hyphens only",
      ],
    },
    status: {
      type: String,
      enum: ["draft", "pending", "active", "suspended", "cancelled"],
      default: "active",
    },
    subscription: {
      planKey: {
        type: String,
        enum: ["starter", "growth", "enterprise"],
        default: "starter",
      },
      plan: {
        type: String,
        enum: ["starter", "growth", "enterprise"],
        default: "starter",
      },
      status: {
        type: String,
        enum: ["trial", "trialing", "active", "past_due", "expired", "cancelled"],
        default: "trialing",
      },
      startedAt: Date,
      currentPeriodStart: Date,
      currentPeriodEnd: Date,
      expiresAt: Date,
      cancelledAt: Date,
      razorpaySubscriptionId: String,
      razorpayOrderId: String,
      razorpayPaymentId: String,
      lastPaymentVerifiedAt: Date,
      billingPeriod: {
        type: String,
        enum: ["trial", "monthly", "half_yearly", "annually", ""],
        default: "",
      },
      renewalTokenHash: {
        type: String,
        trim: true,
        default: "",
      },
      renewalTokenExpiresAt: {
        type: Date,
        default: null,
      },
      gracePeriodEndsAt: Date,
      expiryNotifications: {
        sevenDaySentAt: Date,
        threeDaySentAt: Date,
        oneDaySentAt: Date,
        expiredSentAt: Date,
      },
      startsAt: {
        type: Date,
        default: Date.now,
      },
      endsAt: Date,
      trialEndsAt: Date,
    },
    subscriptionHistory: [
      {
        planKey: {
          type: String,
          enum: ["starter", "growth", "enterprise"],
          default: "starter",
        },
        planName: {
          type: String,
          trim: true,
          default: "",
        },
        billingPeriod: {
          type: String,
          enum: ["trial", "monthly", "half_yearly", "annually", ""],
          default: "",
        },
        status: {
          type: String,
          enum: ["trialing", "active", "paid", "approved", "expired", "cancelled"],
          default: "active",
        },
        amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        currency: {
          type: String,
          default: "INR",
        },
        periodStart: Date,
        periodEnd: Date,
        purchasedAt: {
          type: Date,
          default: Date.now,
        },
        paymentMethod: {
          type: String,
          trim: true,
          default: "",
        },
        gateway: {
          type: String,
          trim: true,
          default: "",
        },
        transactionId: {
          type: String,
          trim: true,
          default: "",
        },
        razorpayOrderId: {
          type: String,
          trim: true,
          default: "",
        },
        source: {
          type: String,
          enum: ["registration", "renewal", "manual", "trial", ""],
          default: "",
        },
      },
    ],
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
    organizationType: {
      type: String,
      enum: ["restaurant", "cafe", "cloud_kitchen", "food_court", "hotel", "other", ""],
      default: "",
      trim: true,
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
    mainBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
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
    payment: {
      amount: {
        type: Number,
        default: 10000,
        min: 0,
      },
      currency: {
        type: String,
        default: "INR",
      },
      method: {
        type: String,
        enum: ["online", "manual", ""],
        default: "",
      },
      status: {
        type: String,
        enum: [
          "not_required",
          "unpaid",
          "initiated",
          "approval_requested",
          "paid",
          "approved",
          "rejected",
        ],
        default: "not_required",
      },
      gateway: {
        type: String,
        default: "",
      },
      transactionId: {
        type: String,
        trim: true,
        default: "",
      },
      reference: {
        type: String,
        trim: true,
        default: "",
      },
      razorpayOrderId: {
        type: String,
        trim: true,
        default: "",
      },
      accessTokenHash: {
        type: String,
        trim: true,
        default: "",
      },
      accessTokenExpiresAt: {
        type: Date,
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      depositedAt: {
        type: Date,
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvalNotes: {
        type: String,
        trim: true,
        default: "",
      },
    },
    paymentGateway: {
      provider: {
        type: String,
        enum: ["razorpay", "none"],
        default: "none",
      },
      status: {
        type: String,
        enum: ["inactive", "active"],
        default: "inactive",
      },
      keyIdEncrypted: {
        type: String,
        trim: true,
        default: "",
      },
      keySecretEncrypted: {
        type: String,
        trim: true,
        default: "",
      },
      keyIdMask: {
        type: String,
        trim: true,
        default: "",
      },
      configuredAt: {
        type: Date,
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
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
  },
);
tenantSchema.index(
  {
    slug: 1,
    key: 1,
  },
  {
    unique: true,
  },
);
module.exports = mongoose.model("Tenant", tenantSchema);
