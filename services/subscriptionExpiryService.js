const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Notification = require("../models/Notification");
const crypto = require("crypto");
const { getPlan } = require("../config/subscriptionPlans");
const {
  getSubscriptionEndDate,
  getSubscriptionState,
  getTenantPlanKey,
} = require("./subscriptionService");
const {
  buildTenantSubscriptionRenewalUrl,
  buildTenantAdminSubscriptionUrl,
  sendSubscriptionExpiryEmail,
  sendBranchSubscriptionExpiredEmail,
} = require("../utils/emailService");
const { logger } = require("../utils/logger");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RENEWAL_TOKEN_TTL_MS = 14 * MS_PER_DAY;

const WINDOWS = Object.freeze([
  {
    key: "sevenDaySentAt",
    days: 7,
    subject: "Your Tableloom subscription expires in 7 days",
    severity: "info",
  },
  {
    key: "threeDaySentAt",
    days: 3,
    subject: "Your Tableloom subscription expires in 3 days",
    severity: "warning",
  },
  {
    key: "oneDaySentAt",
    days: 1,
    subject: "Your Tableloom subscription expires tomorrow",
    severity: "warning",
  },
  {
    key: "expiredSentAt",
    days: 0,
    subject: "Your Tableloom subscription has expired",
    severity: "critical",
  },
]);

const getWindowForTenant = (tenant = {}, now = new Date()) => {
  const expiry = getSubscriptionEndDate(tenant);
  if (!expiry) return null;
  const expiresAt = new Date(expiry);
  if (Number.isNaN(expiresAt.getTime())) return null;
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
  if (daysRemaining < 0) return WINDOWS.find((window) => window.days === 0);
  return WINDOWS.find((window) => window.days === daysRemaining) || null;
};

const getSubscriptionRecipients = async (tenant = {}) => {
  const admins = await User.find({
    tenantId: tenant._id,
    role: "admin",
    isActive: { $ne: false },
  }).select("_id name email role branchScope branchId homeBranchId branchIds");

  const tenantAdminId = tenant.adminUser ? String(tenant.adminUser) : "";
  const mainBranchId = tenant.mainBranchId ? String(tenant.mainBranchId) : "";
  const isMainTenantAdmin = (admin = {}) => {
    if (String(admin.role || "").toLowerCase() !== "admin") {
      return false;
    }
    const branchScope = String(admin.branchScope || "").toLowerCase();
    const homeBranchId = admin.homeBranchId ? String(admin.homeBranchId) : "";
    return (
      String(admin._id) === tenantAdminId ||
      branchScope === "all" ||
      branchScope === "global" ||
      (mainBranchId && homeBranchId === mainBranchId)
    );
  };

  const mainAdmins = admins.filter(isMainTenantAdmin);
  const mainAdminIds = new Set(mainAdmins.map((admin) => String(admin._id)));
  const branchAdmins = admins.filter((admin) => !mainAdminIds.has(String(admin._id)));

  return { mainAdmins, branchAdmins };
};

const issueSubscriptionRenewalToken = async (tenant = {}, now = new Date()) => {
  const renewalToken = crypto.randomBytes(32).toString("hex");
  const renewalTokenExpiresAt = new Date(now.getTime() + RENEWAL_TOKEN_TTL_MS);
  tenant.subscription = {
    ...(tenant.subscription?.toObject?.() || tenant.subscription || {}),
    renewalTokenHash: crypto
      .createHash("sha256")
      .update(renewalToken)
      .digest("hex"),
    renewalTokenExpiresAt,
  };
  await tenant.save();
  return renewalToken;
};

const createSubscriptionNotification = async ({
  tenant,
  admins,
  window,
  expiresAt,
  renewalUrl,
}) =>
  Notification.create({
    tenantId: tenant._id,
    branchId: null,
    title: window.subject,
    message: `${tenant.name} subscription ${window.days === 0 ? "has expired" : `expires in ${window.days} day${window.days === 1 ? "" : "s"}`}.`,
    type: "subscription",
    priority: window.severity === "critical" ? "urgent" : "high",
    severity: window.severity,
    recipientType: "user",
    recipients: admins.map((admin) => admin._id),
    roles: ["admin"],
    senderType: "system",
    metadata: {
      planKey: getTenantPlanKey(tenant),
      expiresAt,
      daysRemaining: window.days,
      renewalUrl,
      notificationGroup: "subscription",
    },
  });

const processTenantExpiryNotification = async (tenant, now = new Date()) => {
  const window = getWindowForTenant(tenant, now);
  if (!window || tenant.subscription?.expiryNotifications?.[window.key]) {
    return { sent: false, reason: "not_due" };
  }

  const expiresAt = getSubscriptionEndDate(tenant);
  const plan = getPlan(getTenantPlanKey(tenant));
  const { mainAdmins, branchAdmins } = await getSubscriptionRecipients(tenant);
  if (mainAdmins.length === 0 && branchAdmins.length === 0) {
    return { sent: false, reason: "no_admins" };
  }
  if (mainAdmins.length === 0 && window.days !== 0) {
    return { sent: false, reason: "no_main_admins" };
  }
  const renewalToken =
    mainAdmins.length > 0 ? await issueSubscriptionRenewalToken(tenant, now) : "";
  const renewalUrl = renewalToken
    ? buildTenantSubscriptionRenewalUrl(tenant, renewalToken)
    : null;
  const adminSubscriptionUrl =
    window.days === 0 ? renewalUrl : buildTenantAdminSubscriptionUrl(tenant);

  if (mainAdmins.length > 0) {
    await createSubscriptionNotification({
      tenant,
      admins: mainAdmins,
      window,
      expiresAt,
      renewalUrl: adminSubscriptionUrl,
    });
  }

  await Promise.all(
    mainAdmins
      .filter((admin) => admin.email)
      .map((admin) =>
        sendSubscriptionExpiryEmail({
          to: admin.email,
          name: admin.name,
          tenant,
          plan,
          subject: window.subject,
          expiresAt,
          daysRemaining: window.days,
          renewalUrl: adminSubscriptionUrl,
        }),
      ),
  );

  if (window.days === 0) {
    await Promise.all(
      branchAdmins
        .filter((admin) => admin.email)
        .map((admin) =>
          sendBranchSubscriptionExpiredEmail({
            to: admin.email,
            name: admin.name,
            tenant,
            plan,
            subject: window.subject,
            expiresAt,
          }),
        ),
    );
  }

  await Tenant.updateOne(
    { _id: tenant._id },
    {
      $set: {
        [`subscription.expiryNotifications.${window.key}`]: now,
        ...(window.days === 0 ? { "subscription.status": "expired" } : {}),
      },
    },
  );

  return { sent: true, window: window.key };
};

const sendExpiredSubscriptionEmailForTenant = async (tenant, now = new Date()) => {
  const expiresAt = getSubscriptionEndDate(tenant);
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  if (
    getSubscriptionState(tenant, now) !== "expired" &&
    (!expiresAtDate ||
      Number.isNaN(expiresAtDate.getTime()) ||
      expiresAtDate > now)
  ) {
    return { sent: false, reason: "not_expired" };
  }

  const plan = getPlan(getTenantPlanKey(tenant));
  const { mainAdmins, branchAdmins } = await getSubscriptionRecipients(tenant);
  if (mainAdmins.length === 0 && branchAdmins.length === 0) {
    return { sent: false, reason: "no_admins" };
  }

  const renewalToken =
    mainAdmins.length > 0 ? await issueSubscriptionRenewalToken(tenant, now) : "";
  const renewalUrl = renewalToken
    ? buildTenantSubscriptionRenewalUrl(tenant, renewalToken)
    : null;
  const subject = "Your Tableloom subscription has expired";

  const mainResults = await Promise.all(
    mainAdmins
      .filter((admin) => admin.email)
      .map(async (admin) => ({
        ok: await sendSubscriptionExpiryEmail({
          to: admin.email,
          name: admin.name,
          tenant,
          plan,
          subject,
          expiresAt,
          daysRemaining: 0,
          renewalUrl,
        }),
        role: "main_admin",
      })),
  );

  const branchResults = await Promise.all(
    branchAdmins
      .filter((admin) => admin.email)
      .map(async (admin) => ({
        ok: await sendBranchSubscriptionExpiredEmail({
          to: admin.email,
          name: admin.name,
          tenant,
          plan,
          subject,
          expiresAt,
        }),
        role: "branch_admin",
      })),
  );

  await Tenant.updateOne(
    { _id: tenant._id },
    {
      $set: {
        "subscription.status": "expired",
        "subscription.expiryNotifications.expiredSentAt": now,
      },
    },
  );

  const emailResults = [...mainResults, ...branchResults];
  const sentCount = emailResults.filter((result) => result.ok).length;
  return {
    sent: sentCount > 0,
    window: "expiredSentAt",
    mainAdminEmails: mainResults.length,
    branchAdminEmails: branchResults.length,
    emailCount: emailResults.length,
    sentEmailCount: sentCount,
    failedEmailCount: emailResults.length - sentCount,
  };
};

const sendExpiredSubscriptionEmails = async (now = new Date()) => {
  const tenants = await Tenant.find({
    status: { $in: ["active", "suspended"] },
    "subscription.status": { $nin: ["cancelled"] },
    $or: [
      { "subscription.status": "expired" },
      { "subscription.currentPeriodEnd": { $lte: now } },
      { "subscription.expiresAt": { $lte: now } },
      { "subscription.endsAt": { $lte: now } },
      { "subscription.trialEndsAt": { $lte: now } },
    ],
  });

  const results = [];
  for (const tenant of tenants) {
    try {
      results.push({
        tenantId: tenant._id,
        tenantName: tenant.name,
        ...(await sendExpiredSubscriptionEmailForTenant(tenant, now)),
      });
    } catch (error) {
      logger.error("Manual expired subscription email failed:", {
        tenantId: tenant._id,
        error: error.message,
      });
      results.push({
        tenantId: tenant._id,
        tenantName: tenant.name,
        sent: false,
        reason: error.message,
      });
    }
  }

  return {
    tenantsChecked: tenants.length,
    tenantsEmailed: results.filter((result) => result.sent).length,
    emailsAttempted: results.reduce(
      (sum, result) => sum + Number(result.emailCount || 0),
      0,
    ),
    emailsSent: results.reduce(
      (sum, result) => sum + Number(result.sentEmailCount || 0),
      0,
    ),
    emailsFailed: results.reduce(
      (sum, result) => sum + Number(result.failedEmailCount || 0),
      0,
    ),
    results,
  };
};

const runSubscriptionExpiryNotifications = async (now = new Date()) => {
  const tenants = await Tenant.find({
    status: { $in: ["active", "suspended"] },
    "subscription.status": { $nin: ["cancelled"] },
    $or: [
      { "subscription.currentPeriodEnd": { $ne: null } },
      { "subscription.expiresAt": { $ne: null } },
      { "subscription.endsAt": { $ne: null } },
      { "subscription.trialEndsAt": { $ne: null } },
    ],
  });

  const results = [];
  for (const tenant of tenants) {
    try {
      results.push({
        tenantId: tenant._id,
        ...(await processTenantExpiryNotification(tenant, now)),
      });
    } catch (error) {
      logger.error("Subscription expiry notification failed:", {
        tenantId: tenant._id,
        error: error.message,
      });
      results.push({ tenantId: tenant._id, sent: false, reason: error.message });
    }
  }
  return results;
};

module.exports = {
  WINDOWS,
  getWindowForTenant,
  processTenantExpiryNotification,
  runSubscriptionExpiryNotifications,
  sendExpiredSubscriptionEmails,
};
