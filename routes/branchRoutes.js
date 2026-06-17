const express = require("express");
const router = express.Router();
const {
  createBranch,
  getBranch,
  getBranchSummary,
  listBranches,
  updateBranch,
  updateBranchStatus,
} = require("../controllers/branchController");
const { protect } = require("../middleware/auth");
const { resolveBranch } = require("../middleware/branch");

router.use(protect);
router.use(resolveBranch);

router.get("/summary", getBranchSummary);
router.get("/", listBranches);
router.get("/:id", getBranch);
router.post("/", createBranch);
router.patch("/:id", updateBranch);
router.patch("/:id/status", updateBranchStatus);

module.exports = router;
