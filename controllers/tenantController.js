const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const { ensureMainBranch } = require("../services/branchService");
const {
  sendExpiredSubscriptionEmails,
} = require("../services/subscriptionExpiryService");
const {
  BILLING_PERIODS,
  getBillingPeriod,
  getPlan,
  getPlanPrice,
  PLANS,
  normalizeBillingPeriod,
  normalizePlanKey,
} = require("../config/subscriptionPlans");
const AppSetting = require("../models/AppSetting");
const Category = require("../models/Category");
const InventoryItem = require("../models/InventoryItem");
const KitchenOrder = require("../models/KitchenOrder");
const KitchenStation = require("../models/KitchenStation");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Feedback = require("../models/Feedback");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const generatePassword = require("../utils/passwordGenerator");
const { logger } = require("../utils/logger.js");
const notificationManager = require("../utils/notificationManager");
const {
  sendStaffOnboardingEmail,
  sendTenantRejectionEmail,
} = require("../utils/emailService");
const {
  convertAmountToSubunits,
  getRazorpayClient,
  getRazorpayPublicConfig,
  verifyRazorpaySignature,
} = require("../utils/razorpay");
const { hydrateUserPermissions } = require("../utils/permissionSettings");
const {
  sendError,
  sendSuccess,
  sendPaginated,
  pickFields,
} = require("../utils/httpResponse");
const {
  isTenantKeyValid,
  isTenantSlugValid,
  normalizeTenantKey,
  normalizeTenantSlug,
} = require("../utils/tenantWorkspace");
const TENANT_REGISTRATION_CURRENCY = "INR";
const TENANT_PAYMENT_ACCESS_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TENANT_TRIAL_DAYS = 7;

const hashTenantPaymentAccessToken = (token = "") =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

const buildTenantPaymentAccessToken = () => crypto.randomBytes(32).toString("hex");

const getTenantPaymentAccessToken = (req = {}) =>
  String(
    req.body?.paymentAccessToken || req.header("x-payment-access-token") || "",
  ).trim();

const isTenantPaymentAccessTokenValid = (tenant = {}, token = "") => {
  const normalizedToken = String(token || "").trim();
  const storedHash = String(tenant?.payment?.accessTokenHash || "").trim();
  const expiresAt = tenant?.payment?.accessTokenExpiresAt
    ? new Date(tenant.payment.accessTokenExpiresAt)
    : null;

  if (
    !normalizedToken ||
    !storedHash ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return false;
  }

  const providedHash = hashTenantPaymentAccessToken(normalizedToken);
  const storedBuffer = Buffer.from(storedHash, "hex");
  const providedBuffer = Buffer.from(providedHash, "hex");

  if (storedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, providedBuffer);
};

const issueTenantPaymentAccessToken = (tenant = {}) => {
  const paymentAccessToken = buildTenantPaymentAccessToken();
  const accessTokenExpiresAt = new Date(
    Date.now() + TENANT_PAYMENT_ACCESS_TOKEN_TTL_MS,
  );

  tenant.payment = {
    ...toTenantPaymentObject(tenant),
    accessTokenHash: hashTenantPaymentAccessToken(paymentAccessToken),
    accessTokenExpiresAt,
  };

  return {
    paymentAccessToken,
    accessTokenExpiresAt,
  };
};

const clearTenantPaymentAccessToken = (tenant = {}) => {
  tenant.payment = {
    ...toTenantPaymentObject(tenant),
    accessTokenHash: "",
    accessTokenExpiresAt: null,
  };
};

const ensureTenantPaymentAccess = (req, res, tenant = {}) => {
  if (isTenantPaymentAccessTokenValid(tenant, getTenantPaymentAccessToken(req))) {
    return true;
  }

  sendError(
    res,
    403,
    "Payment access has expired or is invalid. Start the registration flow again to continue securely.",
  );
  return false;
};

const normalizeTenantRegistrationPaymentMethod = (value = "") => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();
  return normalizedValue === "manual" ? "manual" : "online";
};
const normalizeTenantOrganizationType = (value = "") => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return [
    "restaurant",
    "cafe",
    "cloud_kitchen",
    "food_court",
    "hotel",
    "other",
  ].includes(normalizedValue)
    ? normalizedValue
    : "restaurant";
};
const normalizeRegistrationBillingPeriod = (value = "") => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();
  return normalizedValue === "trial"
    ? "trial"
    : normalizeBillingPeriod(normalizedValue || "monthly");
};
const isTrialBillingPeriod = (billingPeriod = "") =>
  String(billingPeriod || "").toLowerCase() === "trial";
const normalizeAdminSubscriptionPlanKey = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "grower") {
    return "growth";
  }
  return PLANS[normalized] ? normalized : "";
};
const getRegistrationPricing = (payload = {}) => {
  const planKey = normalizePlanKey(payload.subscriptionPlan || payload.planKey);
  const billingPeriod = normalizeRegistrationBillingPeriod(payload.billingPeriod);
  const isTrial = isTrialBillingPeriod(billingPeriod);
  const period = isTrial
    ? {
        key: "trial",
        name: "7 day trial",
        months: 0,
        multiplier: 0,
      }
    : getBillingPeriod(billingPeriod);
  return {
    plan: getPlan(planKey),
    planKey,
    billingPeriod,
    period,
    amount: isTrial ? 0 : getPlanPrice(planKey, billingPeriod),
    currency: TENANT_REGISTRATION_CURRENCY,
    isTrial,
  };
};
const hasAdminEmailUsedTrial = async (email = "", excludeTenantId = null) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return false;
  const query = {
    ...(excludeTenantId
      ? {
          _id: {
            $ne: excludeTenantId,
          },
        }
      : {}),
    status: {
      $ne: "cancelled",
    },
    $and: [
      {
        $or: [
          {
            "subscription.billingPeriod": "trial",
          },
          {
            "subscription.trialEndsAt": {
              $ne: null,
            },
          },
        ],
      },
    ],
    $or: [
      {
        "requestedAdmin.email": normalizedEmail,
      },
      {
        "contact.email": normalizedEmail,
      },
    ],
  };
  return Boolean(await Tenant.exists(query));
};
const getSubscriptionPeriodRange = (pricing = {}, now = new Date()) => {
  const periodStart = now;
  if (pricing.isTrial) {
    const trialEnd = new Date(
      now.getTime() + TENANT_TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );
    return {
      periodStart,
      periodEnd: trialEnd,
      trialEndsAt: trialEnd,
      status: "trialing",
    };
  }
  const periodEnd = addMonths(periodStart, pricing.period?.months || 1);
  return {
    periodStart,
    periodEnd,
    trialEndsAt: null,
    status: "active",
  };
};
const buildTenantRegistrationReceipt = (tenant = {}) => {
  const baseReceipt =
    String(tenant?.slug || tenant?._id || "tenant")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 24) || "tenant";
  const suffix = Date.now().toString().slice(-8);
  return `${baseReceipt}-${suffix}`.slice(0, 40);
};
const getTenantPaymentSummary = (tenant = {}) =>
  pickFields(tenant?.payment || {}, [
    "amount",
    "currency",
    "method",
    "status",
    "gateway",
    "transactionId",
    "reference",
    "razorpayOrderId",
    "requestedAt",
    "depositedAt",
    "approvedAt",
    "approvalNotes",
  ]);
const toTenantPaymentObject = (tenant = {}) =>
  tenant?.payment?.toObject?.() || tenant?.payment || {};
const toTenantSubscriptionObject = (tenant = {}) =>
  tenant?.subscription?.toObject?.() || tenant?.subscription || {};
const getSubscriptionHistoryEntries = (tenant = {}) => {
  const explicitHistory = Array.isArray(tenant?.subscriptionHistory)
    ? tenant.subscriptionHistory.map((entry) => entry?.toObject?.() || entry)
    : [];
  if (explicitHistory.length > 0) {
    return explicitHistory;
  }
  const subscription = toTenantSubscriptionObject(tenant);
  const payment = toTenantPaymentObject(tenant);
  const plan = getPlan(subscription.planKey || subscription.plan);
  return [
    {
      planKey: plan.key,
      planName: plan.name,
      billingPeriod: subscription.billingPeriod || "",
      status: subscription.status || payment.status || "",
      amount: Number(payment.amount || 0),
      currency: payment.currency || TENANT_REGISTRATION_CURRENCY,
      periodStart: subscription.currentPeriodStart || subscription.startsAt || null,
      periodEnd:
        subscription.currentPeriodEnd ||
        subscription.expiresAt ||
        subscription.endsAt ||
        subscription.trialEndsAt ||
        null,
      purchasedAt:
        payment.approvedAt ||
        payment.depositedAt ||
        payment.requestedAt ||
        subscription.startedAt ||
        subscription.startsAt ||
        null,
      paymentMethod: payment.method || "",
      gateway: payment.gateway || "",
      transactionId: payment.transactionId || "",
      razorpayOrderId: payment.razorpayOrderId || "",
      source:
        subscription.billingPeriod === "trial"
          ? "trial"
          : payment.approvalNotes?.toLowerCase?.().includes("renewal")
            ? "renewal"
            : "registration",
    },
  ].filter((entry) => entry.planKey || entry.amount || entry.periodEnd);
};
const formatSubscriptionHistoryEntry = (entry = {}) => ({
  _id: entry._id,
  planKey: entry.planKey || "starter",
  planName: entry.planName || getPlan(entry.planKey).name,
  billingPeriod: entry.billingPeriod || "",
  status: entry.status || "",
  amount: Number(entry.amount || 0),
  currency: entry.currency || TENANT_REGISTRATION_CURRENCY,
  periodStart: entry.periodStart || null,
  periodEnd: entry.periodEnd || null,
  purchasedAt: entry.purchasedAt || null,
  paymentMethod: entry.paymentMethod || "",
  gateway: entry.gateway || "",
  transactionId: entry.transactionId || "",
  razorpayOrderId: entry.razorpayOrderId || "",
  source: entry.source || "",
});
const appendSubscriptionHistoryEntry = (tenant = {}, entry = {}) => {
  const history = Array.isArray(tenant.subscriptionHistory)
    ? tenant.subscriptionHistory
    : [];
  const transactionId = String(entry.transactionId || "").trim();
  const razorpayOrderId = String(entry.razorpayOrderId || "").trim();
  const alreadyRecorded = history.some((historyEntry) => {
    const existing = historyEntry?.toObject?.() || historyEntry || {};
    return (
      (transactionId && existing.transactionId === transactionId) ||
      (razorpayOrderId && existing.razorpayOrderId === razorpayOrderId)
    );
  });
  if (alreadyRecorded) return;
  history.push({
    planKey: entry.planKey || "starter",
    planName: entry.planName || getPlan(entry.planKey).name,
    billingPeriod: entry.billingPeriod || "",
    status: entry.status || "active",
    amount: Number(entry.amount || 0),
    currency: entry.currency || TENANT_REGISTRATION_CURRENCY,
    periodStart: entry.periodStart || null,
    periodEnd: entry.periodEnd || null,
    purchasedAt: entry.purchasedAt || new Date(),
    paymentMethod: entry.paymentMethod || "",
    gateway: entry.gateway || "",
    transactionId,
    razorpayOrderId,
    source: entry.source || "",
  });
  tenant.subscriptionHistory = history;
};
const hashSubscriptionRenewalToken = (token = "") =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");
const getSubscriptionRenewalToken = (req = {}) =>
  String(
    req.body?.token ||
      req.query?.token ||
      req.header("x-subscription-renewal-token") ||
      "",
  ).trim();
const isSubscriptionRenewalTokenValid = (tenant = {}, token = "") => {
  const normalizedToken = String(token || "").trim();
  const storedHash = String(tenant?.subscription?.renewalTokenHash || "").trim();
  const expiresAt = tenant?.subscription?.renewalTokenExpiresAt
    ? new Date(tenant.subscription.renewalTokenExpiresAt)
    : null;
  if (
    !normalizedToken ||
    !storedHash ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return false;
  }
  const providedHash = hashSubscriptionRenewalToken(normalizedToken);
  const storedBuffer = Buffer.from(storedHash, "hex");
  const providedBuffer = Buffer.from(providedHash, "hex");
  if (storedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedBuffer, providedBuffer);
};
const findTenantForRenewal = async (req = {}) => {
  const query = {};
  const tenantId = req.params?.id || req.body?.tenantId || req.query?.tenantId || "";
  const tenantSlug = req.params?.tenantSlug || req.body?.tenantSlug || req.query?.tenantSlug || "";
  const tenantKey = req.params?.tenantKey || req.body?.tenantKey || req.query?.tenantKey || "";
  if (tenantId) {
    query._id = tenantId;
  } else if (tenantSlug && tenantKey) {
    query.slug = String(tenantSlug).trim().toLowerCase();
    query.key = String(tenantKey).trim().toLowerCase();
  }
  if (!Object.keys(query).length) {
    return null;
  }
  return Tenant.findOne(query);
};
const ensureSubscriptionRenewalAccess = (req, res, tenant = {}) => {
  if (isSubscriptionRenewalTokenValid(tenant, getSubscriptionRenewalToken(req))) {
    return true;
  }
  if (
    req.user &&
    String(req.user.role || "").toLowerCase() === "admin" &&
    String(req.user.tenantId || "") === String(tenant._id || "")
  ) {
    return true;
  }
  if (req.user && String(req.user.role || "").toLowerCase() === "super_admin") {
    return true;
  }
  sendError(
    res,
    403,
    "Subscription renewal link has expired or is invalid. Ask the main tenant admin to request a fresh renewal link.",
  );
  return false;
};
const buildSubscriptionRenewalReceipt = (tenant = {}) => {
  const baseReceipt =
    String(tenant?.slug || tenant?._id || "renewal")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 22) || "renewal";
  const suffix = Date.now().toString().slice(-8);
  return `${baseReceipt}-rn-${suffix}`.slice(0, 40);
};
const addMonths = (date, months = 1) => {
  const nextDate = new Date(date);
  const originalDate = nextDate.getDate();
  nextDate.setMonth(nextDate.getMonth() + Number(months || 1));
  if (nextDate.getDate() < originalDate) {
    nextDate.setDate(0);
  }
  return nextDate;
};
const getRenewalPricing = (tenant = {}, payload = {}) => {
  const planKey = normalizePlanKey(
    payload.planKey || tenant?.subscription?.planKey || tenant?.subscription?.plan,
  );
  const billingPeriod = normalizeBillingPeriod(
    payload.billingPeriod || tenant?.subscription?.billingPeriod || "monthly",
  );
  const amount = getPlanPrice(planKey, billingPeriod);
  const period = getBillingPeriod(billingPeriod);
  return {
    plan: getPlan(planKey),
    planKey,
    billingPeriod,
    period,
    amount,
    currency: TENANT_REGISTRATION_CURRENCY,
  };
};
exports.getSubscriptionPlans = async (req, res) =>
  sendSuccess(res, 200, "Subscription plans loaded", {
    plans: Object.values(PLANS).map((plan) => ({
      key: plan.key,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      branchLimit: plan.branchLimit,
      allowSubBranches: plan.allowSubBranches,
    })),
    billingPeriods: [
      {
        key: "trial",
        name: "7 day trial",
        months: 0,
        multiplier: 0,
      },
      ...Object.values(BILLING_PERIODS).map((period) => ({
        key: period.key,
        name: period.name,
        months: period.months,
        multiplier: period.multiplier,
      })),
    ],
    trialDays: TENANT_TRIAL_DAYS,
    currency: TENANT_REGISTRATION_CURRENCY,
  });
const ensureTenantUniqueness = async ({
  slug,
  key,
  email,
  excludeTenantId = null,
}) => {
  const buildTenantQuery = (query = {}) =>
    excludeTenantId
      ? {
          ...query,
          _id: {
            $ne: excludeTenantId,
          },
        }
      : query;
  const [existingSlugTenant, existingKeyTenant, existingAdmin] =
    await Promise.all([
      Tenant.findOne(
        buildTenantQuery({
          slug,
        }),
      ),
      Tenant.findOne(
        buildTenantQuery({
          slug,
          key,
        }),
      ),
      User.findOne({
        email,
        tenantId: {
          $ne: null,
        },
      }),
    ]);
  return {
    existingSlugTenant,
    existingKeyTenant,
    existingAdmin,
  };
};
const getTenantApprovalNote = (tenant = {}) => {
  const paymentStatus = String(tenant?.payment?.status || "").toLowerCase();
  if (paymentStatus === "approval_requested") {
    return "Manual/testing payment approved by super admin";
  }
  if (paymentStatus === "paid") {
    return "Registration payment approved by super admin";
  }
  if (paymentStatus === "initiated") {
    return "Tenant approved by super admin before online payment was confirmed";
  }
  if (paymentStatus === "unpaid") {
    return "Tenant approved by super admin without a recorded payment";
  }
  return "Tenant approved by super admin";
};
const buildTenantSectionFilter = (section = "all") => {
  const normalizedSection = String(section || "all")
    .trim()
    .toLowerCase();
  if (normalizedSection === "pending") {
    return {
      adminUser: null,
      status: {
        $nin: ["cancelled"],
      },
      $or: [
        {
          "onboarding.verificationStatus": "pending",
        },
        {
          status: "pending",
        },
      ],
    };
  }
  if (normalizedSection === "registered") {
    return {
      status: {
        $nin: ["pending", "cancelled"],
      },
      $or: [
        {
          "onboarding.verificationStatus": "verified",
        },
        {
          adminUser: {
            $ne: null,
          },
        },
      ],
    };
  }
  return {};
};
const parsePagination = (page, limit, defaultLimit = 10) => {
  const pageNum = Math.max(parseInt(page || 1, 10), 1);
  const limitNum = Math.min(
    Math.max(parseInt(limit || defaultLimit, 10), 1),
    100,
  );
  return {
    pageNum,
    limitNum,
    skip: (pageNum - 1) * limitNum,
  };
};
const ensureAppSettings = async (
  tenantId,
  restaurantName,
  adminEmail,
  updatedBy = null,
) =>
  AppSetting.findOneAndUpdate(
    {
      tenantId,
      key: "app-settings",
    },
    {
      $setOnInsert: {
        tenantId,
        key: "app-settings",
        restaurant: {
          name: restaurantName,
          email: adminEmail,
        },
        updatedBy,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
const createTenantAdminUser = async ({
  tenant,
  mainBranch = null,
  adminName,
  adminEmail,
  createdBy = null,
  updatedBy = null,
  isActive = true,
}) => {
  const tempPassword = generatePassword();
  const adminUser = await User.create({
    name: adminName,
    email: adminEmail,
    password: tempPassword,
    role: "admin",
    tenantId: tenant._id,
    branchScope: "all",
    homeBranchId: mainBranch?._id || tenant.mainBranchId || null,
    branchIds: mainBranch?._id ? [mainBranch._id] : [],
    forcePasswordChange: true,
    isActive,
    createdBy,
    updatedBy,
  });
  await hydrateUserPermissions(adminUser);
  return {
    adminUser,
    tempPassword,
  };
};
const provisionTenantAdmin = async ({
  tenant,
  adminName,
  adminEmail,
  createdBy = null,
  updatedBy = null,
}) => {
  const mainBranch = await ensureMainBranch(tenant, createdBy || updatedBy || null);
  const { adminUser, tempPassword } = await createTenantAdminUser({
    tenant,
    mainBranch,
    adminName,
    adminEmail,
    createdBy,
    updatedBy,
    isActive: true,
  });
  tenant.adminUser = adminUser._id;
  tenant.requestedAdmin = {
    name: adminName,
    email: adminEmail,
    phone: tenant.requestedAdmin?.phone || "",
  };
  await tenant.save();
  await ensureAppSettings(tenant._id, tenant.name, adminEmail, updatedBy);
  const onboardingResetToken = adminUser.getResetPasswordToken();
  await adminUser.save({
    validateBeforeSave: false,
  });
  const emailSent = await sendStaffOnboardingEmail({
    email: adminUser.email,
    name: adminUser.name,
    role: "admin",
    resetToken: onboardingResetToken,
    tenant,
    subject: `Set Up Your Admin Account - ${tenant.name}`,
    heading: `${tenant.name} admin access is ready`,
    intro: `Your admin account for ${tenant.name} has been created. Set your password securely using the link below:`,
  });
  return {
    adminUser,
    tempPassword,
    emailSent,
  };
};
const toTenantListItem = (tenant = {}) => ({
  _id: tenant?._id,
  name: tenant?.name,
  slug: tenant?.slug,
  key: tenant?.key,
  status: tenant?.status,
  contact: pickFields(tenant?.contact || {}, ["email", "phone"]),
  requestedAdmin: pickFields(tenant?.requestedAdmin || {}, [
    "name",
    "email",
    "phone",
  ]),
  adminUser: tenant?.adminUser
    ? pickFields(tenant.adminUser, ["_id", "name", "email", "role", "isActive"])
    : null,
  subscription: pickFields(tenant?.subscription || {}, ["plan", "status"]),
  payment: getTenantPaymentSummary(tenant),
  onboarding: pickFields(tenant?.onboarding || {}, [
    "source",
    "verificationStatus",
    "submittedAt",
    "verifiedAt",
  ]),
});
const toTenantCredentials = (
  adminUser = {},
  emailSent = false,
) => ({
  email: adminUser?.email || "",
  emailSent: Boolean(emailSent),
});
const getInventoryStatus = (item = {}) => {
  if (!item?.isActive) {
    return "inactive";
  }
  if (Number(item.currentStock || 0) <= 0) {
    return "out_of_stock";
  }
  if (Number(item.currentStock || 0) <= Number(item.minimumStock || 0)) {
    return "low_stock";
  }
  return "in_stock";
};
const toWorkspaceStaff = (staff = {}) =>
  pickFields(staff, ["_id", "name", "email", "role", "isActive"]);
const toWorkspaceTable = (table = {}) =>
  pickFields(table, ["_id", "tableNumber", "tableName", "status", "capacity"]);
const toWorkspaceCategory = (category = {}) =>
  pickFields(category, ["_id", "name", "description", "isActive"]);
const toWorkspaceMenuItem = (item = {}) => ({
  _id: item?._id,
  name: item?.name || "",
  isAvailable: Boolean(item?.isAvailable),
  category: item?.category ? pickFields(item.category, ["name"]) : null,
  station: item?.station ? pickFields(item.station, ["name"]) : null,
});
const toWorkspaceKitchenStation = (station = {}) =>
  pickFields(station, ["_id", "name", "stationType", "status", "capacity"]);
const toWorkspaceInventoryItem = (item = {}) => ({
  _id: item?._id,
  ingredientName: item?.ingredientName || "",
  currentStock: Number(item?.currentStock || 0),
  unit: item?.unit || "",
  status: getInventoryStatus(item),
});
const toWorkspaceRecentOrder = (order = {}) =>
  pickFields(order, [
    "_id",
    "orderNumber",
    "status",
    "paymentStatus",
    "totalAmount",
  ]);
const toWorkspaceRecentFeedback = (feedback = {}) => ({
  _id: feedback?._id,
  ratings: {
    overall: feedback?.ratings?.overall || 0,
  },
  sentiment: feedback?.sentiment || "neutral",
  status: feedback?.status || "new",
  comments: feedback?.comments || "",
});
const toTenantOverviewPayload = ({ tenant, settings, summary, workspace }) => ({
  tenant: {
    _id: tenant?._id,
    name: tenant?.name,
    slug: tenant?.slug,
    key: tenant?.key,
    status: tenant?.status,
    contact: pickFields(tenant?.contact || {}, ["email", "phone"]),
    subscription: pickFields(tenant?.subscription || {}, [
      "plan",
      "status",
      "startsAt",
      "trialEndsAt",
    ]),
    payment: getTenantPaymentSummary(tenant),
    onboarding: pickFields(tenant?.onboarding || {}, [
      "source",
      "verificationStatus",
      "submittedAt",
      "verifiedAt",
    ]),
    adminUser: tenant?.adminUser
      ? pickFields(tenant.adminUser, [
          "_id",
          "name",
          "email",
          "role",
          "isActive",
          "lastLogin",
        ])
      : null,
  },
  settings: {
    restaurant: pickFields(settings?.restaurant || {}, [
      "name",
      "email",
      "phone",
    ]),
  },
  summary,
  workspace,
});
const getNormalizedTenantPayload = (payload = {}, tenant = null) => {
  const restaurantName = String(
    payload.restaurantName ?? tenant?.name ?? "",
  ).trim();
  const slug = normalizeTenantSlug(payload.slug ?? tenant?.slug ?? "");
  const key = normalizeTenantKey(payload.key ?? tenant?.key ?? "");
  const adminName = String(
    payload.adminName ?? tenant?.requestedAdmin?.name ?? tenant?.name ?? "",
  ).trim();
  const adminEmail = String(
    payload.adminEmail ??
      tenant?.requestedAdmin?.email ??
      tenant?.contact?.email ??
      "",
  )
    .trim()
    .toLowerCase();
  const phone = String(
    payload.phone ??
      tenant?.requestedAdmin?.phone ??
      tenant?.contact?.phone ??
      "",
  ).trim();
  const organizationType = normalizeTenantOrganizationType(
    payload.organizationType ?? tenant?.organizationType ?? "restaurant",
  );
  const subscriptionPlan = String(
    payload.subscriptionPlan ?? tenant?.subscription?.plan ?? "starter",
  ).trim();
  const billingPeriod = normalizeRegistrationBillingPeriod(
    payload.billingPeriod ?? tenant?.subscription?.billingPeriod ?? "monthly",
  );
  const paymentMethod = normalizeTenantRegistrationPaymentMethod(
    payload.paymentMethod ?? tenant?.payment?.method ?? "online",
  );
  const paymentReference = String(
    payload.paymentReference ?? tenant?.payment?.reference ?? "",
  ).trim();
  return {
    restaurantName,
    slug,
    key,
    adminName,
    adminEmail,
    phone,
    organizationType,
    subscriptionPlan,
    billingPeriod,
    paymentMethod,
    paymentReference,
  };
};
const createSuperAdminTenantRegistrationNotification = (tenant) =>
  notificationManager.createNotification({
    tenantId: null,
    title: "New Tenant Registration",
    message: `${tenant?.name || "A restaurant"} registered and is waiting for approval.`,
    type: "system_alert",
    priority: "high",
    recipientType: "role",
    roles: ["super_admin"],
    senderType: "system",
    actionRequired: true,
    actions: [
      {
        label: "Review Tenant",
        type: "link",
        action: "/admin/tenant-management",
      },
    ],
    metadata: {
      tenantId: String(tenant?._id || ""),
      tenantName: tenant?.name || "",
      tenantSlug: tenant?.slug || "",
      tenantKey: tenant?.key || "",
      verificationStatus: tenant?.onboarding?.verificationStatus || "pending",
      paymentMethod: tenant?.payment?.method || "",
      paymentStatus: tenant?.payment?.status || "",
      paymentAmount: Number(tenant?.payment?.amount || 0),
      contactEmail: tenant?.contact?.email || "",
      adminEmail: tenant?.requestedAdmin?.email || "",
      adminName: tenant?.requestedAdmin?.name || "",
    },
  });
const createPlatformAdminTenantPaymentNotification = async (tenant) => {
  const platformAdmins = await User.find({
    role: {
      $in: ["super_admin", "admin"],
    },
    tenantId: null,
    isActive: true,
  }).select("_id");
  const recipientIds = platformAdmins.map((admin) => admin._id);
  if (recipientIds.length === 0) {
    return null;
  }
  return notificationManager.createNotification({
    tenantId: null,
    title: "Tenant Registration Payment Update",
    message: `${tenant?.name || "A restaurant"} completed the online registration payment and is waiting for approval.`,
    type: "system_alert",
    priority: "high",
    recipientType: "user",
    recipients: recipientIds,
    senderType: "system",
    actionRequired: true,
    actions: [
      {
        label: "Review Tenant",
        type: "link",
        action: "/admin/tenant-management?tab=pending",
      },
    ],
    metadata: {
      tenantId: String(tenant?._id || ""),
      tenantName: tenant?.name || "",
      tenantSlug: tenant?.slug || "",
      tenantKey: tenant?.key || "",
      paymentMethod: tenant?.payment?.method || "",
      paymentStatus: tenant?.payment?.status || "",
      paymentAmount: Number(tenant?.payment?.amount || 0),
      adminEmail: tenant?.requestedAdmin?.email || "",
      adminName: tenant?.requestedAdmin?.name || "",
    },
  });
};
exports.getTenants = async (req, res) => {
  const { section = "all", page = 1, limit = 10 } = req.query || {};
  const filter = buildTenantSectionFilter(section);
  const { pageNum, limitNum, skip } = parsePagination(page, limit);
  const [tenants, total] = await Promise.all([
    Tenant.find(filter)
      .populate("adminUser", "name email role isActive")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Tenant.countDocuments(filter),
  ]);
  return sendPaginated(
    res,
    200,
    tenants.map(toTenantListItem),
    {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
    null,
    {
      section: String(section || "all").trim().toLowerCase(),
    },
  );
};
exports.getTenantOverview = async (req, res) => {
  const tenant = await Tenant.findById(req.params.id)
    .populate("adminUser", "name email role isActive lastLogin")
    .lean();
  if (!tenant) {
    return sendError(res, 404, "Tenant not found");
  }
  const tenantId = tenant._id;
  const [
    settings,
    staff,
    tables,
    categories,
    menuItems,
    kitchenStations,
    inventoryItems,
    recentOrders,
    recentFeedback,
    summary,
  ] = await Promise.all([
    AppSetting.findOne({
      tenantId,
      key: "app-settings",
    }).lean(),
    User.find({
      tenantId,
      role: {
        $in: ["admin", "manager", "chef", "waiter"],
      },
    })
      .select("name email role isActive")
      .sort({
        createdAt: -1,
      })
      .lean(),
    Table.find({
      tenantId,
    })
      .select("tableNumber tableName status capacity")
      .sort({
        createdAt: -1,
      })
      .lean(),
    Category.find({
      tenantId,
    })
      .select("name description isActive")
      .sort({
        createdAt: -1,
      })
      .lean(),
    MenuItem.find({
      tenantId,
    })
      .select("name category station isAvailable")
      .populate("category", "name")
      .populate("station", "name")
      .sort({
        createdAt: -1,
      })
      .limit(25)
      .lean(),
    KitchenStation.find({
      tenantId,
    })
      .select("name stationType status capacity")
      .sort({
        displayOrder: 1,
        name: 1,
      })
      .lean(),
    InventoryItem.find({
      tenantId,
    })
      .select("ingredientName currentStock unit minimumStock isActive")
      .sort({
        updatedAt: -1,
      })
      .limit(25)
      .lean(),
    Order.find({
      tenantId,
    })
      .select("orderNumber status totalAmount paymentStatus")
      .sort({
        createdAt: -1,
      })
      .limit(25)
      .lean(),
    Feedback.find({
      tenantId,
    })
      .select("ratings.overall sentiment status priority comments createdAt")
      .sort({
        createdAt: -1,
      })
      .limit(25)
      .lean(),
    Promise.all([
      User.countDocuments({
        tenantId,
        role: {
          $in: ["admin", "manager", "chef", "waiter"],
        },
      }),
      Customer.countDocuments({
        tenantId,
      }),
      Table.countDocuments({
        tenantId,
      }),
      MenuItem.countDocuments({
        tenantId,
      }),
      Category.countDocuments({
        tenantId,
      }),
      Order.countDocuments({
        tenantId,
      }),
      InventoryItem.countDocuments({
        tenantId,
      }),
      KitchenStation.countDocuments({
        tenantId,
      }),
    ]),
  ]);
  const [
    staffCount,
    customerCount,
    tableCount,
    menuItemCount,
    categoryCount,
    orderCount,
    inventoryCount,
    kitchenStationCount,
  ] = summary;
  return sendSuccess(
    res,
    200,
    null,
    toTenantOverviewPayload({
      tenant,
      settings,
      summary: {
        staffCount,
        customerCount,
        tableCount,
        menuItemCount,
        categoryCount,
        orderCount,
        inventoryCount,
        kitchenStationCount,
      },
      workspace: {
        staff: staff.map((entry) => toWorkspaceStaff(entry)),
        tables: tables.map((entry) => toWorkspaceTable(entry)),
        categories: categories.map((entry) => toWorkspaceCategory(entry)),
        menuItems: menuItems.map((entry) => toWorkspaceMenuItem(entry)),
        kitchenStations: kitchenStations.map((entry) =>
          toWorkspaceKitchenStation(entry),
        ),
        inventoryItems: inventoryItems.map((entry) =>
          toWorkspaceInventoryItem(entry),
        ),
        recentOrders: recentOrders.map((entry) =>
          toWorkspaceRecentOrder(entry),
        ),
        recentFeedback: recentFeedback.map((entry) =>
          toWorkspaceRecentFeedback(entry),
        ),
      },
    }),
  );
};
const getTenantSubscriptionDetailsPayload = (tenant = {}) => {
  const subscription = toTenantSubscriptionObject(tenant);
  const plan = getPlan(subscription.planKey || subscription.plan);
  const periodKey = subscription.billingPeriod || "monthly";
  const period =
    periodKey === "trial"
      ? { key: "trial", name: "7 day trial" }
      : getBillingPeriod(periodKey);
  const history = getSubscriptionHistoryEntries(tenant)
    .map(formatSubscriptionHistoryEntry)
    .sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0));
  const currentPeriodEnd =
    subscription.currentPeriodEnd ||
    subscription.expiresAt ||
    subscription.endsAt ||
    subscription.trialEndsAt ||
    null;
  const now = new Date();
  const endDate = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const daysRemaining =
    endDate && !Number.isNaN(endDate.getTime())
      ? Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;
  return {
    tenant: {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      key: tenant.key,
      status: tenant.status,
      adminName: tenant.requestedAdmin?.name || tenant.name,
      adminEmail: tenant.requestedAdmin?.email || tenant.contact?.email || "",
      phone: tenant.requestedAdmin?.phone || tenant.contact?.phone || "",
    },
    subscription: {
      planKey: plan.key,
      planName: plan.name,
      billingPeriod: periodKey,
      periodName: period.name,
      status: subscription.status || "trialing",
      currentPeriodStart: subscription.currentPeriodStart || subscription.startsAt || null,
      currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt || null,
      daysRemaining,
    },
    payment: getTenantPaymentSummary(tenant),
    history,
    totals: {
      paidAmount: history.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      purchaseCount: history.length,
      currency:
        history.find((entry) => entry.currency)?.currency ||
        tenant?.payment?.currency ||
        TENANT_REGISTRATION_CURRENCY,
    },
  };
};
exports.getMySubscriptionDetails = async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return sendError(res, 404, "Tenant subscription not found");
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return sendError(res, 404, "Tenant subscription not found");
  }
  return sendSuccess(
    res,
    200,
    "Subscription details loaded",
    getTenantSubscriptionDetailsPayload(tenant),
  );
};
exports.getSubscriptionReport = async (_req, res) => {
  const tenants = await Tenant.find({
    status: { $nin: ["cancelled"] },
  }).select("name slug key status contact requestedAdmin subscription subscriptionHistory payment");
  const rows = tenants.map((tenant) => {
    const payload = getTenantSubscriptionDetailsPayload(tenant);
    return {
      tenant: payload.tenant,
      subscription: payload.subscription,
      payment: payload.payment,
      totals: payload.totals,
      history: payload.history,
    };
  });
  const turnover = rows.reduce(
    (summary, row) => {
      summary.amount += Number(row.totals?.paidAmount || 0);
      summary.purchaseCount += Number(row.totals?.purchaseCount || 0);
      return summary;
    },
    { amount: 0, purchaseCount: 0, currency: TENANT_REGISTRATION_CURRENCY },
  );
  return sendSuccess(res, 200, "Subscription report loaded", {
    summary: {
      tenants: rows.length,
      activeSubscriptions: rows.filter(
        (row) =>
          ["active", "trialing", "trial", "past_due"].includes(
            String(row.subscription?.status || "").toLowerCase(),
          ) &&
          (row.subscription?.daysRemaining === null ||
            row.subscription?.daysRemaining === undefined ||
            Number(row.subscription?.daysRemaining) >= 0),
      ).length,
      expiredSubscriptions: rows.filter(
        (row) =>
          String(row.subscription?.status || "").toLowerCase() === "expired" ||
          Number(row.subscription?.daysRemaining) < 0,
      ).length,
      expiringSoonSubscriptions: rows.filter(
        (row) =>
          Number(row.subscription?.daysRemaining) >= 0 &&
          Number(row.subscription?.daysRemaining) <= 7,
      ).length,
      turnover,
    },
    tenants: rows,
  });
};
exports.updateTenantSubscription = async (_req, res) => {
  return sendError(
    res,
    400,
    "Subscription plan and billing period can only be changed while renewing the subscription.",
  );
};
exports.updateMySubscription = async (_req, res) => {
  return sendError(
    res,
    400,
    "Subscription plan and billing period can only be changed while renewing the subscription.",
  );
};
exports.createTenant = async (req, res) => {
  const {
    restaurantName,
    slug,
    key,
    adminName,
    adminEmail,
    phone,
    organizationType,
    subscriptionPlan,
    billingPeriod,
  } = getNormalizedTenantPayload(req.body);
  if (!restaurantName || !slug || !key || !adminName || !adminEmail) {
    return res.status(400).json({
      success: false,
      message:
        "restaurantName, slug, key, adminName, and adminEmail are required",
    });
  }
  const normalizedSlug = normalizeTenantSlug(slug);
  const normalizedKey = normalizeTenantKey(key);
  const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();
  if (!normalizedSlug || !isTenantSlugValid(normalizedSlug)) {
    return sendError(
      res,
      400,
      "Tenant slug must contain lowercase letters, numbers, and optional hyphens",
    );
  }
  if (!normalizedKey || !isTenantKeyValid(normalizedKey)) {
    return sendError(
      res,
      400,
      "Tenant key must contain lowercase letters, numbers, and optional hyphens",
    );
  }
  const { existingSlugTenant, existingKeyTenant, existingAdmin } =
    await ensureTenantUniqueness({
      slug: normalizedSlug,
      key: normalizedKey,
      email: normalizedAdminEmail,
    });
  if (existingSlugTenant) {
    return sendError(
      res,
      400,
      "Restaurant slug already exists. Choose a different slug for this restaurant.",
    );
  }
  if (existingKeyTenant) {
    return sendError(
      res,
      400,
      "This workspace key already exists for the selected restaurant slug.",
    );
  }
  if (existingAdmin) {
    return res.status(400).json({
      success: false,
      message: "A tenant admin already exists with this email",
    });
  }
  const pricing = getRegistrationPricing({ subscriptionPlan, billingPeriod });
  if (pricing.isTrial && (await hasAdminEmailUsedTrial(normalizedAdminEmail))) {
    return sendError(
      res,
      400,
      "This admin email has already used the 7 day trial.",
    );
  }
  const now = new Date();
  const subscriptionRange = getSubscriptionPeriodRange(pricing, now);
  let tenant;
  try {
    tenant = await Tenant.create({
      name: restaurantName,
      slug: normalizedSlug,
      key: normalizedKey,
      status: "active",
      organizationType,
      contact: {
        email: normalizedAdminEmail,
        phone,
      },
      requestedAdmin: {
        name: adminName,
        email: normalizedAdminEmail,
        phone,
      },
      subscription: {
        planKey: pricing.planKey,
        plan: pricing.planKey,
        status: subscriptionRange.status,
        billingPeriod: pricing.billingPeriod,
        startedAt: now,
        currentPeriodStart: subscriptionRange.periodStart,
        currentPeriodEnd: subscriptionRange.periodEnd,
        expiresAt: subscriptionRange.periodEnd,
        startsAt: now,
        endsAt: subscriptionRange.periodEnd,
        trialEndsAt: subscriptionRange.trialEndsAt,
      },
      onboarding: {
        source: "platform_admin",
        verificationStatus: "verified",
        submittedAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: req.user?._id || null,
      },
      payment: {
        amount: pricing.amount,
        currency: pricing.currency,
        method: "manual",
        status: "approved",
        requestedAt: new Date(),
        depositedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: req.user?._id || null,
        approvalNotes: "Provisioned directly by platform admin",
      },
      subscriptionHistory: [
        {
          planKey: pricing.planKey,
          planName: pricing.plan.name,
          billingPeriod: pricing.billingPeriod,
          status: subscriptionRange.status,
          amount: pricing.amount,
          currency: pricing.currency,
          periodStart: subscriptionRange.periodStart,
          periodEnd: subscriptionRange.periodEnd,
          purchasedAt: now,
          paymentMethod: "manual",
          source: pricing.isTrial ? "trial" : "manual",
        },
      ],
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });
    const { adminUser, tempPassword, emailSent } = await provisionTenantAdmin({
      tenant,
      adminName,
      adminEmail: normalizedAdminEmail,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });
    return sendSuccess(res, 201, "Tenant created successfully", {
      tenant: toTenantListItem(tenant.toObject ? tenant.toObject() : tenant),
      admin: pickFields(adminUser, [
        "_id",
        "name",
        "email",
        "role",
        "forcePasswordChange",
      ]),
      credentials: toTenantCredentials(adminUser, tempPassword, emailSent),
    });
  } catch (error) {
    if (tenant?._id) {
      await Promise.all([
        Tenant.findByIdAndDelete(tenant._id),
        User.deleteMany({
          tenantId: tenant._id,
        }),
      ]);
    }
    throw error;
  }
};
exports.registerTenant = async (req, res) => {
  const {
    restaurantName,
    slug,
    key,
    adminName,
    adminEmail,
    phone,
    organizationType,
    subscriptionPlan,
    billingPeriod,
    paymentMethod,
    paymentReference,
  } = getNormalizedTenantPayload(req.body);
  if (!restaurantName || !slug || !key || !adminName || !adminEmail) {
    return res.status(400).json({
      success: false,
      message:
        "restaurantName, slug, key, adminName, and adminEmail are required",
    });
  }
  const normalizedSlug = normalizeTenantSlug(slug);
  const normalizedKey = normalizeTenantKey(key);
  const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();
  if (!normalizedSlug || !isTenantSlugValid(normalizedSlug)) {
    return sendError(
      res,
      400,
      "Tenant slug must contain lowercase letters, numbers, and optional hyphens",
    );
  }
  if (!normalizedKey || !isTenantKeyValid(normalizedKey)) {
    return sendError(
      res,
      400,
      "Tenant key must contain lowercase letters, numbers, and optional hyphens",
    );
  }
  const { existingSlugTenant, existingKeyTenant, existingAdmin } =
    await ensureTenantUniqueness({
      slug: normalizedSlug,
      key: normalizedKey,
      email: normalizedAdminEmail,
    });
  if (existingSlugTenant) {
    return sendError(
      res,
      400,
      "Restaurant slug already exists. Choose a different slug for this restaurant.",
    );
  }
  if (existingKeyTenant) {
    return sendError(
      res,
      400,
      "This workspace key already exists for the selected restaurant slug.",
    );
  }
  if (existingAdmin) {
    return res.status(400).json({
      success: false,
      message: "A tenant admin already exists with this email",
    });
  }
  const pricing = getRegistrationPricing({ subscriptionPlan, billingPeriod });
  if (pricing.isTrial && (await hasAdminEmailUsedTrial(normalizedAdminEmail))) {
    return sendError(
      res,
      400,
      "This admin email has already used the 7 day trial.",
    );
  }
  const effectivePaymentMethod = pricing.isTrial ? "" : paymentMethod;
  const tenant = new Tenant({
    name: restaurantName,
    slug: normalizedSlug,
    key: normalizedKey,
    status: "pending",
    organizationType,
    contact: {
      email: normalizedAdminEmail,
      phone,
    },
    requestedAdmin: {
      name: adminName,
      email: normalizedAdminEmail,
      phone,
    },
    subscription: {
      planKey: pricing.planKey,
      plan: pricing.planKey,
      status: "trialing",
      billingPeriod: pricing.billingPeriod,
      startedAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      expiresAt: null,
      startsAt: null,
      trialEndsAt: null,
    },
    onboarding: {
      source: "self_service",
      verificationStatus: "pending",
      submittedAt: new Date(),
    },
    payment: {
      amount: pricing.amount,
      currency: pricing.currency,
      method: effectivePaymentMethod,
      status:
        pricing.isTrial
          ? "not_required"
          : effectivePaymentMethod === "manual"
            ? "approval_requested"
            : "unpaid",
      requestedAt: new Date(),
      reference: paymentReference,
      approvalNotes:
        pricing.isTrial
          ? "7 day trial requested. Super admin approval is pending."
          : effectivePaymentMethod === "manual"
          ? "Manual/testing payment approval requested"
          : "",
    },
  });
  const { paymentAccessToken, accessTokenExpiresAt } =
    issueTenantPaymentAccessToken(tenant);
  await tenant.save();
  await ensureMainBranch(tenant);
  createSuperAdminTenantRegistrationNotification(tenant).catch((error) => {
    logger.error(
      "Failed to create super admin tenant-registration notification:",
      error,
    );
  });
  return sendSuccess(
    res,
    201,
    pricing.isTrial
      ? "Tenant registration submitted successfully. Your 7 day trial will start after platform approval."
      : effectivePaymentMethod === "manual"
      ? "Tenant registration submitted successfully. Payment approval and platform verification are pending."
      : `Tenant registration submitted successfully. Complete the ${pricing.currency} ${pricing.amount} payment to continue with platform approval.`,
    {
      tenantId: tenant._id,
      status: tenant.status,
      verificationStatus: tenant.onboarding?.verificationStatus,
      paymentAccessToken,
      paymentAccessTokenExpiresAt: accessTokenExpiresAt,
      subscription: {
        planKey: pricing.planKey,
        planName: pricing.plan.name,
        billingPeriod: pricing.billingPeriod,
        periodName: pricing.period.name,
        trialDays: pricing.isTrial ? TENANT_TRIAL_DAYS : 0,
      },
      payment: getTenantPaymentSummary(tenant),
    },
  );
};
exports.createRegistrationPaymentOrder = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return sendError(res, 404, "Tenant registration not found");
    }
    if (!ensureTenantPaymentAccess(req, res, tenant)) {
      return null;
    }
    if (tenant.onboarding?.source !== "self_service") {
      return sendError(
        res,
        400,
        "Payment orders are only available for self-service registrations",
      );
    }
    if (
      tenant.adminUser ||
      tenant.onboarding?.verificationStatus === "verified"
    ) {
      return sendError(res, 400, "Tenant has already been approved");
    }
    if (["paid", "approved"].includes(String(tenant?.payment?.status || ""))) {
      return sendError(
        res,
        400,
        "Registration payment has already been completed for this tenant",
      );
    }
    if (
      isTrialBillingPeriod(tenant?.subscription?.billingPeriod) ||
      Number(tenant?.payment?.amount || 0) <= 0 ||
      String(tenant?.payment?.status || "") === "not_required"
    ) {
      return sendError(
        res,
        400,
        "Payment is not required for this trial registration",
      );
    }
    const pricing = getRegistrationPricing({
      subscriptionPlan: tenant.subscription?.planKey || tenant.subscription?.plan,
      billingPeriod: tenant.subscription?.billingPeriod || "monthly",
    });
    const razorpayClient = getRazorpayClient();
    const amount = Number(tenant?.payment?.amount ?? pricing.amount);
    const razorpayOrder = await razorpayClient.orders.create({
      amount: convertAmountToSubunits(amount),
      currency: tenant?.payment?.currency || TENANT_REGISTRATION_CURRENCY,
      receipt: buildTenantRegistrationReceipt(tenant),
      notes: {
        tenantId: String(tenant._id),
        tenantName: tenant.name || "",
        adminEmail:
          tenant.requestedAdmin?.email || tenant.contact?.email || "",
      },
    });
    tenant.payment = {
      ...toTenantPaymentObject(tenant),
      amount,
      currency: tenant?.payment?.currency || TENANT_REGISTRATION_CURRENCY,
      method: "online",
      status: "initiated",
      gateway: "razorpay",
      razorpayOrderId: razorpayOrder.id,
      requestedAt: new Date(),
      approvalNotes: "Online payment initiated. Awaiting payment confirmation.",
    };
    await tenant.save();
    return sendSuccess(
      res,
      200,
      "Registration payment order created successfully",
      {
        tenantId: tenant._id,
        keyId: getRazorpayPublicConfig().keyId,
        order: {
          id: razorpayOrder.id,
          amount: Number(razorpayOrder.amount || 0),
          currency: razorpayOrder.currency || TENANT_REGISTRATION_CURRENCY,
          receipt: razorpayOrder.receipt || "",
          status: razorpayOrder.status || "created",
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          adminName: tenant.requestedAdmin?.name || tenant.name,
          adminEmail:
            tenant.requestedAdmin?.email || tenant.contact?.email || "",
          phone: tenant.requestedAdmin?.phone || tenant.contact?.phone || "",
        },
        payment: getTenantPaymentSummary(tenant),
      },
    );
  } catch (error) {
    return sendError(
      res,
      400,
      error?.message || "Failed to create tenant payment order",
    );
  }
};
exports.verifyRegistrationPayment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return sendError(
        res,
        400,
        "Razorpay order, payment, and signature are required",
      );
    }
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return sendError(res, 404, "Tenant registration not found");
    }
    if (!ensureTenantPaymentAccess(req, res, tenant)) {
      return null;
    }
    if (tenant.onboarding?.source !== "self_service") {
      return sendError(
        res,
        400,
        "Payment verification is only available for self-service registrations",
      );
    }
    if (
      ["paid", "approved"].includes(String(tenant?.payment?.status || "")) &&
      String(tenant?.payment?.razorpayOrderId || "") === String(razorpayOrderId) &&
      String(tenant?.payment?.transactionId || "") === String(razorpayPaymentId)
    ) {
      return sendSuccess(
        res,
        200,
        "Registration payment was already received. Super admin approval is pending.",
        {
          tenantId: tenant._id,
          status: tenant.status,
          verificationStatus: tenant.onboarding?.verificationStatus,
          payment: getTenantPaymentSummary(tenant),
        },
      );
    }
    if (
      tenant?.payment?.razorpayOrderId &&
      String(tenant.payment.razorpayOrderId) !== String(razorpayOrderId)
    ) {
      return sendError(
        res,
        400,
        "Payment verification must use the latest order created for this registration",
      );
    }
    const isSignatureValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!isSignatureValid) {
      return sendError(
        res,
        400,
        "Razorpay payment signature verification failed",
      );
    }
    const razorpayClient = getRazorpayClient();
    const [razorpayOrder, razorpayPayment] = await Promise.all([
      razorpayClient.orders.fetch(razorpayOrderId),
      razorpayClient.payments.fetch(razorpayPaymentId),
    ]);
    if (String(razorpayOrder.notes?.tenantId || "") !== String(tenant._id)) {
      return sendError(
        res,
        400,
        "Payment does not belong to this tenant registration",
      );
    }
    if (String(razorpayPayment.order_id || "") !== String(razorpayOrderId)) {
      return sendError(res, 400, "Payment does not match the created order");
    }
    if (
      !["authorized", "captured"].includes(
        String(razorpayPayment.status || "").toLowerCase(),
      )
    ) {
      return sendError(res, 400, "Payment is not authorized yet");
    }
    const pricing = getRegistrationPricing({
      subscriptionPlan: tenant.subscription?.planKey || tenant.subscription?.plan,
      billingPeriod: tenant.subscription?.billingPeriod || "monthly",
    });
    const expectedAmount = convertAmountToSubunits(
      Number(tenant?.payment?.amount ?? pricing.amount),
    );
    if (Number(razorpayOrder.amount || 0) !== expectedAmount) {
      return sendError(
        res,
        400,
        "Order amount does not match the registration fee",
      );
    }
    if (Number(razorpayPayment.amount || 0) !== expectedAmount) {
      return sendError(
        res,
        400,
        "Payment amount does not match the registration fee",
      );
    }
    tenant.payment = {
      ...toTenantPaymentObject(tenant),
      amount: Number(tenant?.payment?.amount ?? pricing.amount),
      currency: tenant?.payment?.currency || pricing.currency,
      method: "online",
      status: "paid",
      gateway: "razorpay",
      transactionId: razorpayPaymentId,
      razorpayOrderId,
      depositedAt: new Date(),
      approvalNotes:
        "Online payment received. Awaiting super admin approval before credentials are sent.",
    };
    await tenant.save();
    createPlatformAdminTenantPaymentNotification(tenant).catch((error) => {
      logger.error(
        "Failed to create platform admin tenant payment notification:",
        error,
      );
    });
    return sendSuccess(
      res,
      200,
      "Registration payment received successfully. Super admin approval is pending.",
      {
        tenantId: tenant._id,
        status: tenant.status,
        verificationStatus: tenant.onboarding?.verificationStatus,
        payment: getTenantPaymentSummary(tenant),
      },
    );
  } catch (error) {
    return sendError(
      res,
      400,
      error?.message || "Failed to verify tenant payment",
    );
  }
};
exports.getSubscriptionRenewal = async (req, res) => {
  try {
    const tenant = await findTenantForRenewal(req);
    if (!tenant) return sendError(res, 404, "Tenant subscription not found");
    if (!ensureSubscriptionRenewalAccess(req, res, tenant)) return null;
    const pricing = getRenewalPricing(tenant, req.query || {});
    return sendSuccess(res, 200, "Subscription renewal details loaded", {
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        key: tenant.key,
        adminName: tenant.requestedAdmin?.name || tenant.name,
        adminEmail: tenant.requestedAdmin?.email || tenant.contact?.email || "",
        phone: tenant.requestedAdmin?.phone || tenant.contact?.phone || "",
      },
      subscription: {
        planKey: pricing.planKey,
        planName: pricing.plan.name,
        billingPeriod: pricing.billingPeriod,
        periodName: pricing.period.name,
        currentPeriodEnd:
          tenant.subscription?.currentPeriodEnd ||
          tenant.subscription?.expiresAt ||
          tenant.subscription?.endsAt ||
          tenant.subscription?.trialEndsAt ||
          null,
        status: tenant.subscription?.status || "expired",
      },
      payment: {
        amount: pricing.amount,
        currency: pricing.currency,
      },
    });
  } catch (error) {
    return sendError(
      res,
      400,
      error?.message || "Failed to load subscription renewal details",
    );
  }
};
exports.createSubscriptionRenewalPaymentOrder = async (req, res) => {
  try {
    const tenant = await findTenantForRenewal(req);
    if (!tenant) return sendError(res, 404, "Tenant subscription not found");
    if (!ensureSubscriptionRenewalAccess(req, res, tenant)) return null;
    const pricing = getRenewalPricing(tenant, req.body || {});
    const razorpayClient = getRazorpayClient();
    const razorpayOrder = await razorpayClient.orders.create({
      amount: convertAmountToSubunits(pricing.amount),
      currency: pricing.currency,
      receipt: buildSubscriptionRenewalReceipt(tenant),
      notes: {
        purpose: "subscription_renewal",
        tenantId: String(tenant._id),
        tenantName: tenant.name || "",
        planKey: pricing.planKey,
        billingPeriod: pricing.billingPeriod,
      },
    });
    tenant.payment = {
      ...toTenantPaymentObject(tenant),
      amount: pricing.amount,
      currency: pricing.currency,
      method: "online",
      status: "initiated",
      gateway: "razorpay",
      razorpayOrderId: razorpayOrder.id,
      requestedAt: new Date(),
      approvalNotes: "Subscription renewal payment initiated.",
    };
    await tenant.save();
    return sendSuccess(res, 200, "Subscription renewal order created", {
      tenantId: tenant._id,
      keyId: getRazorpayPublicConfig().keyId,
      order: {
        id: razorpayOrder.id,
        amount: Number(razorpayOrder.amount || 0),
        currency: razorpayOrder.currency || pricing.currency,
        receipt: razorpayOrder.receipt || "",
        status: razorpayOrder.status || "created",
      },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        adminName: tenant.requestedAdmin?.name || tenant.name,
        adminEmail: tenant.requestedAdmin?.email || tenant.contact?.email || "",
        phone: tenant.requestedAdmin?.phone || tenant.contact?.phone || "",
      },
      subscription: {
        planKey: pricing.planKey,
        planName: pricing.plan.name,
        billingPeriod: pricing.billingPeriod,
        periodName: pricing.period.name,
      },
      payment: getTenantPaymentSummary(tenant),
    });
  } catch (error) {
    return sendError(
      res,
      400,
      error?.message || "Failed to create subscription renewal order",
    );
  }
};
exports.verifySubscriptionRenewalPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return sendError(
        res,
        400,
        "Razorpay order, payment, and signature are required",
      );
    }
    const tenant = await findTenantForRenewal(req);
    if (!tenant) return sendError(res, 404, "Tenant subscription not found");
    if (!ensureSubscriptionRenewalAccess(req, res, tenant)) return null;
    if (
      tenant?.payment?.razorpayOrderId &&
      String(tenant.payment.razorpayOrderId) !== String(razorpayOrderId)
    ) {
      return sendError(
        res,
        400,
        "Payment verification must use the latest renewal order for this tenant",
      );
    }
    const isSignatureValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!isSignatureValid) {
      return sendError(res, 400, "Razorpay payment signature verification failed");
    }
    const razorpayClient = getRazorpayClient();
    const [razorpayOrder, razorpayPayment] = await Promise.all([
      razorpayClient.orders.fetch(razorpayOrderId),
      razorpayClient.payments.fetch(razorpayPaymentId),
    ]);
    if (String(razorpayOrder.notes?.purpose || "") !== "subscription_renewal") {
      return sendError(res, 400, "Payment is not a subscription renewal order");
    }
    if (String(razorpayOrder.notes?.tenantId || "") !== String(tenant._id)) {
      return sendError(res, 400, "Payment does not belong to this tenant");
    }
    if (String(razorpayPayment.order_id || "") !== String(razorpayOrderId)) {
      return sendError(res, 400, "Payment does not match the created order");
    }
    if (
      !["authorized", "captured"].includes(
        String(razorpayPayment.status || "").toLowerCase(),
      )
    ) {
      return sendError(res, 400, "Payment is not authorized yet");
    }
    const pricing = getRenewalPricing(tenant, {
      planKey: razorpayOrder.notes?.planKey,
      billingPeriod: razorpayOrder.notes?.billingPeriod,
    });
    const expectedAmount = convertAmountToSubunits(pricing.amount);
    if (Number(razorpayOrder.amount || 0) !== expectedAmount) {
      return sendError(res, 400, "Order amount does not match the subscription plan");
    }
    if (Number(razorpayPayment.amount || 0) !== expectedAmount) {
      return sendError(res, 400, "Payment amount does not match the subscription plan");
    }
    const now = new Date();
    const existingEndDate =
      tenant.subscription?.currentPeriodEnd ||
      tenant.subscription?.expiresAt ||
      tenant.subscription?.endsAt ||
      tenant.subscription?.trialEndsAt ||
      null;
    const periodStart =
      existingEndDate && new Date(existingEndDate) > now
        ? new Date(existingEndDate)
        : now;
    const periodEnd = addMonths(periodStart, pricing.period.months);
    tenant.subscription = {
      ...(tenant.subscription?.toObject?.() || tenant.subscription || {}),
      planKey: pricing.planKey,
      plan: pricing.planKey,
      status: "active",
      billingPeriod: pricing.billingPeriod,
      startedAt: tenant.subscription?.startedAt || now,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      expiresAt: periodEnd,
      endsAt: periodEnd,
      gracePeriodEndsAt: null,
      renewalTokenHash: "",
      renewalTokenExpiresAt: null,
      expiryNotifications: {
        sevenDaySentAt: null,
        threeDaySentAt: null,
        oneDaySentAt: null,
        expiredSentAt: null,
      },
    };
    tenant.status = "active";
    tenant.payment = {
      ...toTenantPaymentObject(tenant),
      amount: pricing.amount,
      currency: pricing.currency,
      method: "online",
      status: "paid",
      gateway: "razorpay",
      transactionId: razorpayPaymentId,
      razorpayOrderId,
      depositedAt: now,
      approvedAt: now,
      approvalNotes: "Subscription renewal payment verified.",
    };
    appendSubscriptionHistoryEntry(tenant, {
      planKey: pricing.planKey,
      planName: pricing.plan.name,
      billingPeriod: pricing.billingPeriod,
      status: "active",
      amount: pricing.amount,
      currency: pricing.currency,
      periodStart,
      periodEnd,
      purchasedAt: now,
      paymentMethod: "online",
      gateway: "razorpay",
      transactionId: razorpayPaymentId,
      razorpayOrderId,
      source: "renewal",
    });
    await tenant.save();
    return sendSuccess(res, 200, "Subscription renewed successfully", {
      tenantId: tenant._id,
      subscription: {
        planKey: pricing.planKey,
        billingPeriod: pricing.billingPeriod,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: tenant.subscription.status,
      },
      payment: getTenantPaymentSummary(tenant),
    });
  } catch (error) {
    return sendError(
      res,
      400,
      error?.message || "Failed to verify subscription renewal payment",
    );
  }
};
exports.createMySubscriptionRenewalPaymentOrder = async (req, res) => {
  req.params = {
    ...(req.params || {}),
    id: req.user?.tenantId,
  };
  return exports.createSubscriptionRenewalPaymentOrder(req, res);
};
exports.verifyMySubscriptionRenewalPayment = async (req, res) => {
  req.params = {
    ...(req.params || {}),
    id: req.user?.tenantId,
  };
  return exports.verifySubscriptionRenewalPayment(req, res);
};
exports.sendExpiredSubscriptionEmailsToAdmins = async (_req, res) => {
  try {
    const result = await sendExpiredSubscriptionEmails(new Date());
    return sendSuccess(
      res,
      200,
      `Expired subscription emails sent to ${result.emailsSent} recipient${result.emailsSent === 1 ? "" : "s"}`,
      result,
    );
  } catch (error) {
    logger.error("Send expired subscription emails failed:", error);
    return sendError(
      res,
      500,
      error?.message || "Failed to send expired subscription emails",
    );
  }
};
exports.verifyTenant = async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) {
    return sendError(res, 404, "Tenant not found");
  }
  if (
    tenant.onboarding?.verificationStatus === "verified" &&
    tenant.adminUser
  ) {
    return sendError(res, 400, "Tenant is already verified");
  }
  const adminName = tenant.requestedAdmin?.name || tenant.name;
  const adminEmail = tenant.requestedAdmin?.email || tenant.contact?.email;
  if (!adminEmail) {
    return sendError(
      res,
      400,
      "Tenant does not have a pending admin email to verify",
    );
  }
  const existingAdmin = await User.findOne({
    email: adminEmail,
    tenantId: {
      $ne: null,
    },
  });
  if (existingAdmin && String(existingAdmin.tenantId) !== String(tenant._id)) {
    return sendError(res, 400, "A tenant admin already exists with this email");
  }
  const {
    adminUser,
    tempPassword,
    emailSent: credentialsEmailSent,
  } = await provisionTenantAdmin({
    tenant,
    adminName,
    adminEmail,
    createdBy: req.user?._id || null,
    updatedBy: req.user?._id || null,
  });
  tenant.status = "active";
  const pricing = getRegistrationPricing({
    subscriptionPlan: tenant.subscription?.planKey || tenant.subscription?.plan,
    billingPeriod: tenant.subscription?.billingPeriod || "monthly",
  });
  if (
    pricing.isTrial &&
    !tenant.subscription?.trialEndsAt &&
    (await hasAdminEmailUsedTrial(adminEmail, tenant._id))
  ) {
    return sendError(
      res,
      400,
      "This admin email has already used the 7 day trial.",
    );
  }
  const now = new Date();
  const subscriptionRange = getSubscriptionPeriodRange(pricing, now);
  tenant.subscription = {
    ...tenant.subscription,
    planKey: pricing.planKey,
    plan: pricing.planKey,
    status: subscriptionRange.status,
    billingPeriod: pricing.billingPeriod,
    startedAt: tenant.subscription?.startedAt || tenant.subscription?.startsAt || now,
    currentPeriodStart: subscriptionRange.periodStart,
    currentPeriodEnd: subscriptionRange.periodEnd,
    expiresAt: subscriptionRange.periodEnd,
    startsAt: tenant.subscription?.startsAt || now,
    endsAt: subscriptionRange.periodEnd,
    trialEndsAt: subscriptionRange.trialEndsAt,
  };
  tenant.payment = {
    ...toTenantPaymentObject(tenant),
    amount: Number(tenant?.payment?.amount ?? pricing.amount),
    currency: tenant?.payment?.currency || pricing.currency,
    status: "approved",
    depositedAt: tenant?.payment?.depositedAt || null,
    approvedAt: new Date(),
    approvedBy: req.user?._id || null,
    approvalNotes: getTenantApprovalNote(tenant),
  };
  appendSubscriptionHistoryEntry(tenant, {
    planKey: pricing.planKey,
    planName: pricing.plan.name,
    billingPeriod: pricing.billingPeriod,
    status: subscriptionRange.status,
    amount: Number(tenant?.payment?.amount ?? pricing.amount),
    currency: tenant?.payment?.currency || pricing.currency,
    periodStart: subscriptionRange.periodStart,
    periodEnd: subscriptionRange.periodEnd,
    purchasedAt: now,
    paymentMethod: tenant?.payment?.method || "",
    gateway: tenant?.payment?.gateway || "",
    transactionId: tenant?.payment?.transactionId || "",
    razorpayOrderId: tenant?.payment?.razorpayOrderId || "",
    source: pricing.isTrial ? "trial" : "registration",
  });
  clearTenantPaymentAccessToken(tenant);
  tenant.onboarding = {
    ...tenant.onboarding,
    verificationStatus: "verified",
    verifiedAt: new Date(),
    verifiedBy: req.user?._id || null,
  };
  tenant.updatedBy = req.user?._id || null;
  await tenant.save();
  return sendSuccess(res, 200, "Tenant verified successfully", {
    tenant: toTenantListItem(tenant.toObject ? tenant.toObject() : tenant),
    admin: pickFields(adminUser, [
      "_id",
      "name",
      "email",
      "role",
      "forcePasswordChange",
    ]),
    credentials: toTenantCredentials(
      adminUser,
      tempPassword,
      credentialsEmailSent,
    ),
  });
};
exports.rejectTenant = async (req, res) => {
  const { reason = "" } = req.body || {};
  const tenant = await Tenant.findById(req.params.id).populate(
    "adminUser",
    "name email role isActive",
  );
  if (!tenant) {
    return sendError(res, 404, "Tenant not found");
  }
  const isPending =
    tenant.onboarding?.verificationStatus === "pending" ||
    tenant.status === "pending";
  if (!isPending) {
    return sendError(res, 400, "Only pending tenants can be rejected");
  }
  if (tenant.adminUser) {
    return sendError(res, 400, "Verified tenants cannot be rejected");
  }
  const adminEmail = tenant.requestedAdmin?.email || tenant.contact?.email;
  tenant.status = "cancelled";
  tenant.payment = {
    ...toTenantPaymentObject(tenant),
    status:
      tenant?.payment?.status === "not_required"
        ? "not_required"
        : "rejected",
    approvedAt: null,
    approvedBy: req.user?._id || null,
    approvalNotes: String(reason || "").trim(),
  };
  clearTenantPaymentAccessToken(tenant);
  tenant.onboarding = {
    ...tenant.onboarding,
    verificationStatus: "rejected",
    verificationNotes: String(reason || "").trim(),
    verifiedAt: null,
    verifiedBy: req.user?._id || null,
  };
  tenant.updatedBy = req.user?._id || null;
  await tenant.save();
  const emailSent = adminEmail
    ? await sendTenantRejectionEmail({
        tenant,
        adminName: tenant.requestedAdmin?.name || tenant.name,
        adminEmail,
        reason,
      })
    : false;
  return sendSuccess(res, 200, "Tenant rejected successfully", {
    tenant: toTenantListItem(tenant.toObject ? tenant.toObject() : tenant),
    emailSent,
  });
};
exports.updateTenantStatus = async (req, res) => {
  const { status } = req.body || {};
  if (!["active", "suspended"].includes(String(status || ""))) {
    return sendError(res, 400, "Tenant status must be active or suspended");
  }
  const tenant = await Tenant.findById(req.params.id).populate(
    "adminUser",
    "name email role isActive",
  );
  if (!tenant) {
    return sendError(res, 404, "Tenant not found");
  }
  if (
    status === "active" &&
    tenant.onboarding?.verificationStatus !== "verified"
  ) {
    return sendError(
      res,
      400,
      "Verify the tenant before activating the workspace",
    );
  }
  tenant.status = status;
  tenant.updatedBy = req.user?._id || null;
  await tenant.save();
  return sendSuccess(
    res,
    200,
    `Tenant ${status === "active" ? "activated" : "deactivated"} successfully`,
    {
      tenant: toTenantListItem(tenant.toObject ? tenant.toObject() : tenant),
    },
  );
};
