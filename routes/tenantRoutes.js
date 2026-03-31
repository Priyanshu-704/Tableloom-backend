const express = require("express");
const router = express.Router();
const {
  registerTenant,
  createTenant,
  getTenants,
  getTenantOverview,
  verifyTenant,
} = require("../controllers/tenantController");
const { protect, authorize } = require("../middleware/auth");

router.post("/register", registerTenant);

router.use(protect, authorize("super_admin"));

router.get("/", getTenants);
router.post("/", createTenant);
router.get("/:id/overview", getTenantOverview);
router.patch("/:id/verify", verifyTenant);

module.exports = router;
