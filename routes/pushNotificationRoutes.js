const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  registerStaffToken,
  unregisterStaffToken,
  registerCustomerToken,
  unregisterCustomerToken,
} = require("../controllers/pushNotificationController");

router.post("/token/customer", registerCustomerToken);
router.delete("/token/customer", unregisterCustomerToken);

router.post("/token/staff", protect, registerStaffToken);
router.delete("/token/staff", protect, unregisterStaffToken);

module.exports = router;
