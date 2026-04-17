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
router.post("/register", registerTenant);
router.post("/:id/registration-payment-order", createRegistrationPaymentOrder);
router.post("/:id/registration-payment-verify", verifyRegistrationPayment);
router.use(protect, requireRole("super_admin"));
router.get("/", getTenants);
router.post("/", createTenant);
router.get("/:id/overview", getTenantOverview);
router.patch("/:id/verify", verifyTenant);
router.patch("/:id/reject", rejectTenant);
router.patch("/:id/status", updateTenantStatus);
module.exports = router;
