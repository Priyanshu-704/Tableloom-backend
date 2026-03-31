const express = require("express");
const router = express.Router();
const {
  getMenuItemImage,
  getCategoryImage,
  getTableQRImage,
  downloadBillPDF,
} = require("../controllers/imageController");

router.get("/menu-item/:id", getMenuItemImage);
router.get("/category/:id", getCategoryImage);
router.get("/table-qr/:id", getTableQRImage);
router.get("/bills/:id/pdf", downloadBillPDF);
module.exports = router;
