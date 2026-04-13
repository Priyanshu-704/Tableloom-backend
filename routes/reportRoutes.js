const express = require("express");
const router = express.Router();
const { protect, hasPermission } = require("../middleware/auth");
const {
  generateAnalyticsReportFile,
  getReportDataset,
  downloadGeneratedReport,
} = require("../controllers/reportController");
router.use(protect);
router.post(
  "/analytics/generate",
  hasPermission("VIEW_STATISTICS"),
  generateAnalyticsReportFile,
);
router.get("/dataset", hasPermission("VIEW_STATISTICS"), getReportDataset);
router.get(
  "/download/:reportId",
  hasPermission("VIEW_STATISTICS"),
  downloadGeneratedReport,
);
module.exports = router;
