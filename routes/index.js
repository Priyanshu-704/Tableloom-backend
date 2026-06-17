const express = require("express");
const router = express.Router();
const {
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
} = require("../middleware/tenant");
const { resolveBranch } = require("../middleware/branch");
const {
  mutationCacheInvalidationMiddleware,
  responseCacheMiddleware,
} = require("../middleware/responseCache");

router.use(mutationCacheInvalidationMiddleware);
router.use(responseCacheMiddleware);

router.use("/tenants", require("./tenantRoutes"));
router.use("/branches", requireTenantScope, require("./branchRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/permissions", require("./permissionRoutes"));
router.use("/support", require("./supportRoutes"));
router.use("/admin-requests", require("./supportRoutes"));
router.use(
  "/menu",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./menuRoutes"),
);
router.use(
  "/inventory",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./inventoryRoutes"),
);
router.use(
  "/tables",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./tableRoutes"),
);
router.use(
  "/customers",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./customerRoutes"),
);
router.use(
  "/cart",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./cartRoutes"),
);
router.use(
  "/orders",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./orderRoutes"),
);
router.use(
  "/feedback",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./feedbackRoutes"),
);
router.use(
  "/waiter-calls",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./waiterCallRoutes"),
);
router.use(
  "/kitchen",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./kitchenRoutes"),
);
router.use(
  "/kitchen-stations",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./kitchenStationRoutes"),
);
router.use(
  "/images",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./imageRoutes"),
);
router.use(
  "/bills",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./billRoutes"),
);
router.use(
  "/notifications",
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./notificationRoutes"),
);
router.use(
  "/push-notifications",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./pushNotificationRoutes"),
);
router.use("/settings", require("./settingsRoutes"));
router.use(
  "/dashboard",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./dashboardRoutes"),
);
router.use(
  "/reports",
  requireTenantScope,
  enforceSuperAdminTenantReadOnly,
  resolveBranch,
  require("./reportRoutes"),
);
router.use(
  "/backups",
  require("./backupRoutes"),
);
module.exports = router;
