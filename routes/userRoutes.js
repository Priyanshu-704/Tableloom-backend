const express = require("express");
const router = express.Router();
const {
  registerStaff,
  loginStaff,
  logout,
  refreshToken,
  getAllStaff,
  getProfile,
  updateProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
  validateResetToken,
  toggleStaffStatus,
  deleteStaff,
  updateUserRole,
} = require("../controllers/userController");
const { protect, hasPermission } = require("../middleware/auth");

router.post("/login", loginStaff);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:resetToken", resetPassword);
router.post("/validate-reset-token/:resetToken", validateResetToken);
router.post("/refresh-token", refreshToken);

router.use(protect);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/update-password", updatePassword);
router.post("/logout", logout);

router.post("/register", hasPermission("USER_CREATE"), registerStaff);
router.get("/staff", hasPermission("USER_VIEW_ALL"), getAllStaff);

router.put(
  "/:id/status",
  hasPermission("USER_CHANGE_STATUS"),
  toggleStaffStatus
);

router.put("/:id/role", hasPermission("USER_CHANGE_ROLE"), updateUserRole);
router.delete("/:id", hasPermission("USER_DELETE"), deleteStaff);

module.exports = router;
