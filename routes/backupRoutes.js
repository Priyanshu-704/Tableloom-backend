const express = require("express");
const { cloneBackupToTarget, exportBackup } = require("../controllers/backupController");
const { protect, hasPermission } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/export", hasPermission("BACKUP_RESTORE"), exportBackup);
router.post("/clone", hasPermission("BACKUP_RESTORE"), cloneBackupToTarget);

module.exports = router;
