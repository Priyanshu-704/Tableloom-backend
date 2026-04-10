const express = require("express");
const router = express.Router();
const {
  getPublicSettings,
  getAdminSettings,
  updateSettings
} = require("../controllers/settingsController");
const {
  protect,
  hasPermission
} = require("../middleware/auth");
const {
  requireTenant,
  blockSuperAdminTenantAccess
} = require("../middleware/tenant");
const {
  createImageUploadHandler,
  handleUploadErrors
} = require("../utils/uploadMiddleware");
router.get("/public", requireTenant, getPublicSettings);
router.use(protect);
router.use(requireTenant);
router.use(blockSuperAdminTenantAccess);
router.get("/", hasPermission("SYSTEM_SETTINGS"), getAdminSettings);
router.put("/", hasPermission("SYSTEM_SETTINGS"), createImageUploadHandler({
  folder: "images/restaurant-logo"
}), handleUploadErrors, updateSettings);
module.exports = router;
