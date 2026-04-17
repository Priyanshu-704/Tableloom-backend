const Tenant = require("../models/Tenant");
const User = require("../models/User");
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
  sendStaffCredentials,
  sendTenantRejectionEmail,
  buildTenantAdminLoginUrl,
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
const TENANT_REGISTRATION_AMOUNT = 10000;
const TENANT_REGISTRATION_CURRENCY = "INR";
const normalizeTenantRegistrationPaymentMethod = (value = "") => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();
  return normalizedValue === "manual" ? "manual" : "online";
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
  const { adminUser, tempPassword } = await createTenantAdminUser({
    tenant,
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
  const emailSent = await sendStaffCredentials(
    adminUser.email,
    adminUser.name,
    tempPassword,
    "admin",
    {
      loginUrl: buildTenantAdminLoginUrl(tenant),
      subject: `Your Admin Account Credentials - ${tenant.name}`,
      heading: `${tenant.name} admin access is ready`,
      intro: `Your admin account for ${tenant.name} has been created with the following details:`,
    },
  );
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
  tempPassword = "",
  emailSent = false,
) => ({
  email: adminUser?.email || "",
  temporaryPassword: tempPassword,
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
  const subscriptionPlan = String(
    payload.subscriptionPlan ?? tenant?.subscription?.plan ?? "starter",
  ).trim();
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
    subscriptionPlan,
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
exports.createTenant = async (req, res) => {
  const {
    restaurantName,
    slug,
    key,
    adminName,
    adminEmail,
    phone,
    subscriptionPlan,
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
  let tenant;
  try {
    tenant = await Tenant.create({
      name: restaurantName,
      slug: normalizedSlug,
      key: normalizedKey,
      status: "active",
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
        plan: subscriptionPlan,
        status: "trial",
        startsAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      onboarding: {
        source: "platform_admin",
        verificationStatus: "verified",
        submittedAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: req.user?._id || null,
      },
      payment: {
        amount: TENANT_REGISTRATION_AMOUNT,
        currency: TENANT_REGISTRATION_CURRENCY,
        method: "manual",
        status: "approved",
        requestedAt: new Date(),
        depositedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: req.user?._id || null,
        approvalNotes: "Provisioned directly by platform admin",
      },
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
    subscriptionPlan,
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
  const tenant = await Tenant.create({
    name: restaurantName,
    slug: normalizedSlug,
    key: normalizedKey,
    status: "pending",
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
      plan: subscriptionPlan,
      status: "trial",
      startsAt: null,
      trialEndsAt: null,
    },
    onboarding: {
      source: "self_service",
      verificationStatus: "pending",
      submittedAt: new Date(),
    },
    payment: {
      amount: TENANT_REGISTRATION_AMOUNT,
      currency: TENANT_REGISTRATION_CURRENCY,
      method: paymentMethod,
      status:
        paymentMethod === "manual" ? "approval_requested" : "unpaid",
      requestedAt: new Date(),
      reference: paymentReference,
      approvalNotes:
        paymentMethod === "manual"
          ? "Manual/testing payment approval requested"
          : "",
    },
  });
  createSuperAdminTenantRegistrationNotification(tenant).catch((error) => {
    logger.error(
      "Failed to create super admin tenant-registration notification:",
      error,
    );
  });
  return sendSuccess(
    res,
    201,
    paymentMethod === "manual"
      ? "Tenant registration submitted successfully. Payment approval and platform verification are pending."
      : "Tenant registration submitted successfully. Complete the ₹10,000 payment to continue with platform approval.",
    {
      tenantId: tenant._id,
      status: tenant.status,
      verificationStatus: tenant.onboarding?.verificationStatus,
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
    const razorpayClient = getRazorpayClient();
    const amount = Number(
      tenant?.payment?.amount || TENANT_REGISTRATION_AMOUNT,
    );
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
    if (tenant.onboarding?.source !== "self_service") {
      return sendError(
        res,
        400,
        "Payment verification is only available for self-service registrations",
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
    const expectedAmount = convertAmountToSubunits(
      Number(tenant?.payment?.amount || TENANT_REGISTRATION_AMOUNT),
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
      amount: Number(tenant?.payment?.amount || TENANT_REGISTRATION_AMOUNT),
      currency: tenant?.payment?.currency || TENANT_REGISTRATION_CURRENCY,
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
  tenant.subscription = {
    ...tenant.subscription,
    status: "trial",
    startsAt: tenant.subscription?.startsAt || new Date(),
    trialEndsAt:
      tenant.subscription?.trialEndsAt ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  };
  tenant.payment = {
    ...toTenantPaymentObject(tenant),
    amount: Number(tenant?.payment?.amount || TENANT_REGISTRATION_AMOUNT),
    currency: tenant?.payment?.currency || TENANT_REGISTRATION_CURRENCY,
    status: "approved",
    depositedAt: tenant?.payment?.depositedAt || null,
    approvedAt: new Date(),
    approvedBy: req.user?._id || null,
    approvalNotes: getTenantApprovalNote(tenant),
  };
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
