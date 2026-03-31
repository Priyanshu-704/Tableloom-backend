const Tenant = require("../models/Tenant");
const User = require("../models/User");
const AppSetting = require("../models/AppSetting");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const Order = require("../models/Order");
const KitchenStation = require("../models/KitchenStation");
const InventoryItem = require("../models/InventoryItem");
const Feedback = require("../models/Feedback");
const Notification = require("../models/Notification");
const WaiterCall = require("../models/WaiterCall");
const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const generatePassword = require("../utils/passwordGenerator");
const { sendStaffCredentials } = require("../utils/emailService");
const { hydrateUserPermissions } = require("../utils/permissionSettings");
const { sendError, sendSuccess, pickFields } = require("../utils/httpResponse");

const normalizeSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const ensureTenantUniqueness = async ({ slug, key, email, excludeTenantId = null }) => {
  const tenantFilter = {
    $or: [{ slug }, { key }],
  };

  if (excludeTenantId) {
    tenantFilter._id = { $ne: excludeTenantId };
  }

  const [existingTenant, existingAdmin] = await Promise.all([
    Tenant.findOne(tenantFilter),
    User.findOne({
      email,
      tenantId: { $ne: null },
    }),
  ]);

  return {
    existingTenant,
    existingAdmin,
  };
};

const ensureAppSettings = async (tenantId, restaurantName, adminEmail, updatedBy = null) =>
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
    }
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
    "admin"
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
  requestedAdmin: pickFields(tenant?.requestedAdmin || {}, ["name", "email", "phone"]),
  adminUser: tenant?.adminUser
    ? pickFields(tenant.adminUser, ["_id", "name", "email", "role", "isActive"])
    : null,
  subscription: pickFields(tenant?.subscription || {}, ["plan", "status"]),
  onboarding: pickFields(tenant?.onboarding || {}, [
    "source",
    "verificationStatus",
    "submittedAt",
    "verifiedAt",
  ]),
});

const toTenantCredentials = (adminUser = {}, tempPassword = "", emailSent = false) => ({
  email: adminUser?.email || "",
  temporaryPassword: tempPassword,
  emailSent: Boolean(emailSent),
});

const toTenantOverviewPayload = ({ tenant, settings, summary, workspace }) => ({
  tenant: {
    _id: tenant?._id,
    name: tenant?.name,
    slug: tenant?.slug,
    key: tenant?.key,
    status: tenant?.status,
    contact: pickFields(tenant?.contact || {}, ["email", "phone"]),
    subscription: pickFields(tenant?.subscription || {}, ["plan", "status", "startsAt", "trialEndsAt"]),
    onboarding: pickFields(tenant?.onboarding || {}, [
      "source",
      "verificationStatus",
      "submittedAt",
      "verifiedAt",
    ]),
    adminUser: tenant?.adminUser
      ? pickFields(tenant.adminUser, ["_id", "name", "email", "role", "isActive", "lastLogin"])
      : null,
  },
  settings: {
    restaurant: pickFields(settings?.restaurant || {}, ["name", "email", "phone"]),
  },
  summary,
  workspace,
});

exports.getTenants = async (_req, res) => {
  const tenants = await Tenant.find({})
    .populate("adminUser", "name email role isActive")
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, 200, null, tenants.map(toTenantListItem));
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
    recentNotifications,
    recentWaiterCalls,
    summary,
  ] = await Promise.all([
    AppSetting.findOne({ tenantId, key: "app-settings" }).lean(),
    User.find({ tenantId, role: { $in: ["admin", "manager", "chef", "waiter"] } })
      .select("name email role isActive lastLogin forcePasswordChange createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Table.find({ tenantId })
      .select("tableNumber tableName status capacity location isActive createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Category.find({ tenantId })
      .select("name description isActive kitchenStation createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    MenuItem.find({ tenantId })
      .select("name category station isAvailable isActive createdAt")
      .populate("category", "name")
      .populate("station", "name")
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    KitchenStation.find({ tenantId })
      .select("name stationType status capacity currentLoad displayOrder createdAt")
      .sort({ displayOrder: 1, name: 1 })
      .lean(),
    InventoryItem.find({ tenantId })
      .select("ingredientName category currentStock unit minThreshold status updatedAt")
      .sort({ updatedAt: -1 })
      .limit(25)
      .lean(),
    Order.find({ tenantId })
      .select("orderNumber status totalAmount paymentStatus orderType createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    Feedback.find({ tenantId })
      .select("ratings.overall sentiment status priority comments createdAt")
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    Notification.find({ tenantId })
      .select("title type priority status createdAt")
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    WaiterCall.find({ tenantId })
      .select("table requestType status priority createdAt")
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    Promise.all([
      User.countDocuments({ tenantId, role: { $in: ["admin", "manager", "chef", "waiter"] } }),
      Customer.countDocuments({ tenantId }),
      Table.countDocuments({ tenantId }),
      MenuItem.countDocuments({ tenantId }),
      Category.countDocuments({ tenantId }),
      Order.countDocuments({ tenantId }),
      InventoryItem.countDocuments({ tenantId }),
      KitchenStation.countDocuments({ tenantId }),
      Feedback.countDocuments({ tenantId }),
      Notification.countDocuments({ tenantId }),
      WaiterCall.countDocuments({ tenantId }),
      Bill.countDocuments({ tenantId }),
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
    feedbackCount,
    notificationCount,
    waiterCallCount,
    billCount,
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
        feedbackCount,
        notificationCount,
        waiterCallCount,
        billCount,
      },
      workspace: {
        staff,
        tables,
        categories,
        menuItems,
        kitchenStations,
        inventoryItems,
        recentOrders,
        recentFeedback,
        recentNotifications,
        recentWaiterCalls,
      },
    })
  );
};

exports.createTenant = async (req, res) => {
  const {
    restaurantName,
    slug,
    key,
    adminName,
    adminEmail,
    subscriptionPlan = "starter",
  } = req.body || {};

  if (!restaurantName || !slug || !key || !adminName || !adminEmail) {
    return res.status(400).json({
      success: false,
      message:
        "restaurantName, slug, key, adminName, and adminEmail are required",
    });
  }

  const normalizedSlug = normalizeSlug(slug);
  const normalizedKey = normalizeKey(key);
  const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();

  const { existingTenant, existingAdmin } = await ensureTenantUniqueness({
    slug: normalizedSlug,
    key: normalizedKey,
    email: normalizedAdminEmail,
  });

  if (existingTenant) {
    return res.status(400).json({
      success: false,
      message: "Restaurant slug or key already exists",
    });
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
      },
      requestedAdmin: {
        name: adminName,
        email: normalizedAdminEmail,
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
      admin: pickFields(adminUser, ["_id", "name", "email", "role", "forcePasswordChange"]),
      credentials: toTenantCredentials(adminUser, tempPassword, emailSent),
    });
  } catch (error) {
    if (tenant?._id) {
      await Promise.all([
        Tenant.findByIdAndDelete(tenant._id),
        User.deleteMany({ tenantId: tenant._id }),
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
    phone = "",
    subscriptionPlan = "starter",
  } = req.body || {};

  if (!restaurantName || !slug || !key || !adminName || !adminEmail) {
    return res.status(400).json({
      success: false,
      message:
        "restaurantName, slug, key, adminName, and adminEmail are required",
    });
  }

  const normalizedSlug = normalizeSlug(slug);
  const normalizedKey = normalizeKey(key);
  const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();

  const { existingTenant, existingAdmin } = await ensureTenantUniqueness({
    slug: normalizedSlug,
    key: normalizedKey,
    email: normalizedAdminEmail,
  });

  if (existingTenant) {
    return res.status(400).json({
      success: false,
      message: "Restaurant slug or key already exists",
    });
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
      phone: String(phone || "").trim(),
    },
    requestedAdmin: {
      name: adminName,
      email: normalizedAdminEmail,
      phone: String(phone || "").trim(),
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
  });

  return sendSuccess(
    res,
    201,
    "Tenant registration submitted successfully. Platform verification is pending.",
    {
      tenantId: tenant._id,
      status: tenant.status,
      verificationStatus: tenant.onboarding?.verificationStatus,
    }
  );
};

exports.verifyTenant = async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);

  if (!tenant) {
    return sendError(res, 404, "Tenant not found");
  }

  if (tenant.onboarding?.verificationStatus === "verified" && tenant.adminUser) {
    return sendError(res, 400, "Tenant is already verified");
  }

  const adminName = tenant.requestedAdmin?.name || tenant.name;
  const adminEmail = tenant.requestedAdmin?.email || tenant.contact?.email;

  if (!adminEmail) {
    return sendError(res, 400, "Tenant does not have a pending admin email to verify");
  }

  const existingAdmin = await User.findOne({
    email: adminEmail,
    tenantId: { $ne: null },
  });

  if (existingAdmin && String(existingAdmin.tenantId) !== String(tenant._id)) {
    return sendError(res, 400, "A tenant admin already exists with this email");
  }

  const { adminUser, tempPassword, emailSent } = await provisionTenantAdmin({
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
    admin: pickFields(adminUser, ["_id", "name", "email", "role", "forcePasswordChange"]),
    credentials: toTenantCredentials(adminUser, tempPassword, emailSent),
  });
};
