const express = require("express");
const router = express.Router();
const {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
} = require("../controllers/supportController");
const { protect, requireRole } = require("../middleware/auth");
router.use(protect);
router.get("/", requireRole("admin", "super_admin"), getSupportRequests);
router.post("/", requireRole("admin"), createSupportRequest);
router.patch(
  "/:id/status",
  requireRole("super_admin"),
  updateSupportRequestStatus,
);
module.exports = router;
