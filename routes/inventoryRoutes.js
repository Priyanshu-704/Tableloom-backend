const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  adjustInventoryStock,
  deleteInventoryItem,
  bulkUploadInventory
} = require("../controllers/inventoryController");
const {
  protect,
  hasPermission
} = require("../middleware/auth");
const upload = multer({
  storage: multer.memoryStorage()
});
router.use(protect);
router.get("/", hasPermission("INVENTORY_VIEW_ALL"), getInventoryItems);
router.post("/bulk-upload", hasPermission("INVENTORY_CREATE"), upload.single("file"), bulkUploadInventory);
router.post("/", hasPermission("INVENTORY_CREATE"), createInventoryItem);
router.put("/:id", hasPermission("INVENTORY_EDIT"), updateInventoryItem);
router.patch("/:id/adjust", hasPermission("INVENTORY_ADJUST"), adjustInventoryStock);
router.delete("/:id", hasPermission("INVENTORY_DELETE"), deleteInventoryItem);
module.exports = router;
