const express = require("express");
const router = express.Router();
const {
  getAvailablePermissions,
  getUserPermissions,
  updateUserPermissions,
  resetUserPermissions,
  getMyPermissions,
} = require("../controllers/permissionController");
const { Permissions } = require("../config/permissions");
const { protect, hasPermission } = require("../middleware/auth");

router.use(protect);
router.get("/available", getAvailablePermissions);

router.get(
  "/user/:userId",
  hasPermission(Permissions.USER_MANAGE_PERMISSIONS),
  getUserPermissions
);

router.get("/me", getMyPermissions);

router.put(
  "/user/:userId",
  hasPermission(Permissions.USER_MANAGE_PERMISSIONS),
  updateUserPermissions
);

router.post(
  "/user/:userId/reset",
  hasPermission(Permissions.USER_MANAGE_PERMISSIONS),
  resetUserPermissions
);

module.exports = router;
