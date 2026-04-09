const express = require("express");
const router = express.Router();
const {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
} = require("../controllers/supportController");
const { authorize, protect } = require("../middleware/auth");

router.use(protect);

router.get("/", authorize("admin", "super_admin"), getSupportRequests);
router.post("/", authorize("admin"), createSupportRequest);
router.patch("/:id/status", authorize("super_admin"), updateSupportRequestStatus);

module.exports = router;
