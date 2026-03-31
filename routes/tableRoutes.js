const express = require("express");
const router = express.Router();
const {
  createTable,
  getTables,
  getTable,
  updateTable,
  updateTableStatus,
  regenerateQRCode,
  toggleTableActive,
  deleteTable,
  getTableStatistics,
  downloadQRCode,
  getQRTokenStatus,
  refreshQRToken,
} = require("../controllers/tableController");
const { protect, hasPermission } = require("../middleware/auth");

router.use(protect);

router.post("/", hasPermission("TABLE_CREATE"), createTable);
router.get("/", hasPermission("TABLE_VIEW_ALL"), getTables);
router.get("/:id", hasPermission("TABLE_VIEW_ALL"), getTable);
router.put("/:id", hasPermission("TABLE_EDIT"), updateTable);
router.delete("/:id", hasPermission("TABLE_DELETE"), deleteTable);

router.put(
  "/:id/status",
  hasPermission("TABLE_UPDATE_STATUS"),
  updateTableStatus
);

router.put(
  "/:id/toggle-active",
  hasPermission("TABLE_EDIT"),
  toggleTableActive
);

router.get(
  "/:id/qr-download",
  hasPermission("TABLE_VIEW_ALL"),
  downloadQRCode
);

router.put(
  "/:id/regenerate-qr",
  hasPermission("TABLE_EDIT"),
  regenerateQRCode
);

router.get(
  "/:id/qr-token-status",
  hasPermission("TABLE_VIEW_ALL"),
  getQRTokenStatus
);

router.post(
  "/:id/table-refresh-token",
  hasPermission("TABLE_EDIT"),
  refreshQRToken
);

router.get(
  "/dashboard/stats",
  hasPermission("TABLE_VIEW_ALL"),
  getTableStatistics
);

module.exports = router;
