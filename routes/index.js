const express = require("express");
const router = express.Router();
const {
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
} = require("../middleware/tenant");
router.use("/tenants", require("./tenantRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/permissions", require("./permissionRoutes"));
router.use("/support", require("./supportRoutes"));
router.use("/admin-requests", require("./supportRoutes"));
router.use(
  "/menu",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./menuRoutes"),
);
router.use(
  "/inventory",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./inventoryRoutes"),
);
router.use(
  "/tables",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./tableRoutes"),
);
router.use(
  "/customers",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./customerRoutes"),
);
router.use(
  "/cart",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./cartRoutes"),
);
router.use(
  "/orders",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./orderRoutes"),
);
router.use(
  "/feedback",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./feedbackRoutes"),
);
router.use(
  "/waiter-calls",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./waiterCallRoutes"),
);
router.use(
  "/kitchen",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./kitchenRoutes"),
);
router.use(
  "/kitchen-stations",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./kitchenStationRoutes"),
);
router.use(
  "/images",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./imageRoutes"),
);
router.use(
  "/bills",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./billRoutes"),
);
router.use(
  "/notifications",
  enforceSuperAdminTenantReadOnly,
  require("./notificationRoutes"),
);
router.use(
  "/push-notifications",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./pushNotificationRoutes"),
);
router.use("/settings", require("./settingsRoutes"));
router.use(
  "/dashboard",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./dashboardRoutes"),
);
router.use(
  "/reports",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./reportRoutes"),
);
router.use(
  "/backups",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  require("./backupRoutes"),
);
module.exports = router;
