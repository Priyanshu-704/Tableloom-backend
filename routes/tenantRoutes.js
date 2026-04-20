const express = require("express");
const router = express.Router();
const {
  registerTenant,
  createRegistrationPaymentOrder,
  verifyRegistrationPayment,
  createTenant,
  getTenants,
  getTenantOverview,
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
router.use(protect, requireRole("super_admin"));
router.get("/", getTenants);
router.post("/", createTenant);
router.get("/:id/overview", getTenantOverview);
router.patch("/:id/verify", verifyTenant);
router.patch("/:id/reject", rejectTenant);
router.patch("/:id/status", updateTenantStatus);
module.exports = router;
