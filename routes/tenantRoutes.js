const express = require("express");
const router = express.Router();
const {
  registerTenant,
  getSubscriptionPlans,
  getMySubscriptionDetails,
  getSubscriptionReport,
  getSubscriptionRenewal,
  createMySubscriptionRenewalPaymentOrder,
  createSubscriptionRenewalPaymentOrder,
  verifyMySubscriptionRenewalPayment,
  verifySubscriptionRenewalPayment,
  updateMySubscription,
  createRegistrationPaymentOrder,
  verifyRegistrationPayment,
  createTenant,
  getTenants,
  getTenantOverview,
  sendExpiredSubscriptionEmailsToAdmins,
  updateTenantSubscription,
  updateTenantStatus,
  verifyTenant,
  rejectTenant,
} = require("../controllers/tenantController");
const { protect, requireRole } = require("../middleware/auth");
const { createRateLimit, getClientIp } = require("../middleware/security");

const tenantRegistrationRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many tenant registration attempts. Please try again later.",
  keyGenerator: (req) =>
    `${getClientIp(req)}:${String(req.body?.adminEmail || req.params?.id || "").trim().toLowerCase()}`,
});

router.post("/register", tenantRegistrationRateLimit, registerTenant);
router.get("/subscription-plans", getSubscriptionPlans);
router.post(
  "/:id/registration-payment-order",
  tenantRegistrationRateLimit,
  createRegistrationPaymentOrder,
);
router.post(
  "/:id/registration-payment-verify",
  tenantRegistrationRateLimit,
  verifyRegistrationPayment,
);
router.get("/subscription-renewal/:tenantSlug/:tenantKey", getSubscriptionRenewal);
router.get("/me/subscription", protect, requireRole("admin"), getMySubscriptionDetails);
router.patch("/me/subscription", protect, requireRole("admin"), updateMySubscription);
router.post(
  "/me/subscription-renewal-order",
  protect,
  requireRole("admin"),
  createMySubscriptionRenewalPaymentOrder,
);
router.post(
  "/me/subscription-renewal-verify",
  protect,
  requireRole("admin"),
  verifyMySubscriptionRenewalPayment,
);
router.post(
  "/:id/subscription-renewal-order",
  tenantRegistrationRateLimit,
  createSubscriptionRenewalPaymentOrder,
);
router.post(
  "/:id/subscription-renewal-verify",
  tenantRegistrationRateLimit,
  verifySubscriptionRenewalPayment,
);
router.use(protect, requireRole("super_admin"));
router.get("/", getTenants);
router.post("/", createTenant);
router.post("/expired-subscriptions/send-emails", sendExpiredSubscriptionEmailsToAdmins);
router.get("/subscriptions/report", getSubscriptionReport);
router.get("/:id/overview", getTenantOverview);
router.patch("/:id/subscription", updateTenantSubscription);
router.patch("/:id/verify", verifyTenant);
router.patch("/:id/reject", rejectTenant);
router.patch("/:id/status", updateTenantStatus);
module.exports = router;
