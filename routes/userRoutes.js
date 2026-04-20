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
const { createRateLimit, getClientIp } = require("../middleware/security");

const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many authentication attempts. Please try again later.",
  keyGenerator: (req) =>
    `${getClientIp(req)}:${String(req.body?.email || "").trim().toLowerCase()}`,
});

const passwordResetRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset attempts. Please try again later.",
  keyGenerator: (req) =>
    `${getClientIp(req)}:${String(req.body?.email || req.params?.resetToken || "").trim().toLowerCase()}`,
});

const refreshRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: "Too many token refresh attempts. Please try again later.",
});

router.post("/login", authRateLimit, loginStaff);
router.post("/forgot-password", passwordResetRateLimit, forgotPassword);
router.put(
  "/reset-password/:resetToken",
  passwordResetRateLimit,
  resetPassword,
);
router.post(
  "/validate-reset-token/:resetToken",
  passwordResetRateLimit,
  validateResetToken,
);
router.post("/refresh-token", refreshRateLimit, refreshToken);
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
  toggleStaffStatus,
);
router.put("/:id/role", hasPermission("USER_CHANGE_ROLE"), updateUserRole);
router.delete("/:id", hasPermission("USER_DELETE"), deleteStaff);
module.exports = router;
