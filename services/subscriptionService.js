const {
  DEFAULT_PLAN_KEY,
  getPlan,
  normalizePlanKey,
} = require("../config/subscriptionPlans");

const ACTIVE_STATES = new Set(["trialing", "trial", "active", "past_due"]);
const BLOCKED_STATES = new Set(["expired", "cancelled"]);

const getTenantPlanKey = (tenant = {}) =>
  normalizePlanKey(
    tenant?.subscription?.planKey ||
      tenant?.subscription?.plan ||
      tenant?.planKey ||
      DEFAULT_PLAN_KEY,
  );

const getSubscriptionEndDate = (tenant = {}) =>
  tenant?.subscription?.expiresAt ||
  tenant?.subscription?.currentPeriodEnd ||
  tenant?.subscription?.endsAt ||
  tenant?.subscription?.trialEndsAt ||
  null;

const normalizeSubscriptionStatus = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "trial") return "trialing";
  return normalized || "trialing";
};

const getSubscriptionState = (tenant = {}, now = new Date()) => {
  const rawStatus = normalizeSubscriptionStatus(tenant?.subscription?.status);
  if (rawStatus === "cancelled") return "cancelled";

  const endDateValue = getSubscriptionEndDate(tenant);
  const endDate = endDateValue ? new Date(endDateValue) : null;
  if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) {
    return "expired";
  }

  if (["trialing", "active", "past_due"].includes(rawStatus)) {
    return rawStatus;
  }
  return rawStatus || "trialing";
};

const isSubscriptionActive = (tenant = {}, now = new Date()) => {
  const state = getSubscriptionState(tenant, now);
  if (BLOCKED_STATES.has(state)) return false;
  return ACTIVE_STATES.has(state);
};

const getBranchLimit = (tenant = {}) => {
  const plan = getPlan(getTenantPlanKey(tenant));
  return plan.branchLimit;
};

const isBranchLimitReached = (tenant = {}, currentBranchCount = 0) => {
  const limit = getBranchLimit(tenant);
  if (limit === null || limit === Infinity) return false;
  return Number(currentBranchCount || 0) >= Number(limit);
};

const canCreateBranch = (tenant = {}, currentBranchCount = 0) => {
  const plan = getPlan(getTenantPlanKey(tenant));
  if (!isSubscriptionActive(tenant)) {
    return {
      allowed: false,
      reason: "subscription_inactive",
      plan,
    };
  }
  if (!plan.allowSubBranches) {
    return {
      allowed: false,
      reason: "sub_branches_not_allowed",
      plan,
    };
  }
  if (isBranchLimitReached(tenant, currentBranchCount)) {
    return {
      allowed: false,
      reason: "branch_limit_reached",
      plan,
    };
  }
  return {
    allowed: true,
    reason: null,
    plan,
  };
};

module.exports = {
  ACTIVE_STATES,
  BLOCKED_STATES,
  getPlan,
  getTenantPlanKey,
  getSubscriptionEndDate,
  getSubscriptionState,
  isSubscriptionActive,
  getBranchLimit,
  isBranchLimitReached,
  canCreateBranch,
};
