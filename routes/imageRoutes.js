const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const { optionalCustomerSession } = require("../middleware/customerSessionAuth");
const {
  getMenuItemImage,
  getCategoryImage,
  getTableQRImage,
  getRestaurantLogo,
  downloadBillPDF,
} = require("../controllers/imageController");
router.get("/menu-item/:id", getMenuItemImage);
router.get("/category/:id", getCategoryImage);
router.get("/table-qr/:id", getTableQRImage);
router.get("/restaurant-logo", getRestaurantLogo);
router.get(
  "/bills/:id/pdf",
  optionalAuth,
  optionalCustomerSession(),
  downloadBillPDF,
);
module.exports = router;
