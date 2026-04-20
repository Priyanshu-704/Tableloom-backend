const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { protectCustomerSession } = require("../middleware/customerSessionAuth");
const {
  registerStaffToken,
  unregisterStaffToken,
  registerCustomerToken,
  unregisterCustomerToken,
} = require("../controllers/pushNotificationController");
router.post(
  "/token/customer",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  registerCustomerToken,
);
router.delete(
  "/token/customer",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  unregisterCustomerToken,
);
router.post("/token/staff", protect, registerStaffToken);
router.delete("/token/staff", protect, unregisterStaffToken);
module.exports = router;
