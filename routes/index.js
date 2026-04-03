const express = require("express");
const router = express.Router();
const {
  requireTenant,
  blockSuperAdminTenantAccess,
} = require("../middleware/tenant");

router.use("/tenants", require("./tenantRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/permissions", require("./permissionRoutes"));

router.use("/menu", requireTenant, blockSuperAdminTenantAccess, require("./menuRoutes"));
router.use(
  "/inventory",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./inventoryRoutes")
);
router.use("/tables", requireTenant, blockSuperAdminTenantAccess, require("./tableRoutes"));

router.use(
  "/customers",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./customerRoutes")
);

router.use("/cart", requireTenant, blockSuperAdminTenantAccess, require("./cartRoutes"));
router.use("/orders", requireTenant, blockSuperAdminTenantAccess, require("./orderRoutes"));
router.use(
  "/feedback",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./feedbackRoutes")
);

router.use(
  "/waiter-calls",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./waiterCallRoutes")
);
router.use("/kitchen", requireTenant, blockSuperAdminTenantAccess, require("./kitchenRoutes"));
router.use(
  "/kitchen-stations",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./kitchenStationRoutes")
);

router.use("/images", requireTenant, blockSuperAdminTenantAccess, require("./imageRoutes"));

router.use("/bills", requireTenant, blockSuperAdminTenantAccess, require("./billRoutes"));
router.use(
  "/notifications",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./notificationRoutes")
);
router.use(
  "/push-notifications",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./pushNotificationRoutes")
);
router.use("/settings", require("./settingsRoutes"));
router.use(
  "/dashboard",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./dashboardRoutes")
);
router.use(
  "/backups",
  requireTenant,
  blockSuperAdminTenantAccess,
  require("./backupRoutes")
);
module.exports = router;
