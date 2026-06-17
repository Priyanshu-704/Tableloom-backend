const PLANS = Object.freeze({
  starter: Object.freeze({
    key: "starter",
    name: "Starter",
    monthlyPrice: Number(process.env.STARTER_PLAN_MONTHLY_PRICE || 10000),
    branchLimit: 1,
    allowSubBranches: false,
  }),
  growth: Object.freeze({
    key: "growth",
    name: "Growth",
    monthlyPrice: Number(process.env.GROWTH_PLAN_MONTHLY_PRICE || 30000),
    branchLimit: Number(process.env.GROWTH_PLAN_BRANCH_LIMIT || 5),
    allowSubBranches: true,
  }),
  enterprise: Object.freeze({
    key: "enterprise",
    name: "Enterprise",
    monthlyPrice: Number(process.env.ENTERPRISE_PLAN_MONTHLY_PRICE || 50000),
    branchLimit: null,
    allowSubBranches: true,
  }),
});

const BILLING_PERIODS = Object.freeze({
  monthly: Object.freeze({
    key: "monthly",
    name: "Monthly",
    months: 1,
    multiplier: 1,
  }),
  half_yearly: Object.freeze({
    key: "half_yearly",
    name: "Half yearly",
    months: 6,
    multiplier: Number(process.env.SUBSCRIPTION_HALF_YEARLY_MULTIPLIER || 5.5),
  }),
  annually: Object.freeze({
    key: "annually",
    name: "Annually",
    months: 12,
    multiplier: Number(process.env.SUBSCRIPTION_ANNUAL_MULTIPLIER || 10),
  }),
});

const DEFAULT_PLAN_KEY = "starter";

const normalizePlanKey = (planKey = "") =>
  String(planKey || DEFAULT_PLAN_KEY).trim().toLowerCase();

const getPlan = (planKey = DEFAULT_PLAN_KEY) =>
  PLANS[normalizePlanKey(planKey)] || PLANS[DEFAULT_PLAN_KEY];

const normalizeBillingPeriod = (billingPeriod = "") => {
  const normalized = String(billingPeriod || "monthly").trim().toLowerCase();
  if (normalized === "half-yearly" || normalized === "halfyearly") {
    return "half_yearly";
  }
  if (normalized === "annual" || normalized === "yearly") {
    return "annually";
  }
  return BILLING_PERIODS[normalized] ? normalized : "monthly";
};

const getBillingPeriod = (billingPeriod = "monthly") =>
  BILLING_PERIODS[normalizeBillingPeriod(billingPeriod)];

const getPlanPrice = (planKey = DEFAULT_PLAN_KEY, billingPeriod = "monthly") => {
  const plan = getPlan(planKey);
  const period = getBillingPeriod(billingPeriod);
  return Math.round(Number(plan.monthlyPrice || 0) * Number(period.multiplier || 1));
};

module.exports = {
  PLANS,
  BILLING_PERIODS,
  DEFAULT_PLAN_KEY,
  getBillingPeriod,
  getPlan,
  getPlanPrice,
  normalizeBillingPeriod,
  normalizePlanKey,
};
