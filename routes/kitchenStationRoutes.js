const express = require("express");
const router = express.Router();
const {
  getKitchenStations,
  getKitchenStation,
  createKitchenStation,
  updateKitchenStation,
  deleteKitchenStation,
  assignCategoryToStation,
  removeCategoryFromStation,
  getStationDashboard,
} = require("../controllers/kitchenStationController");
const { protect, hasPermission } = require("../middleware/auth");
router.use(protect);
router.get("/", hasPermission("KITCHEN_STATION_VIEW"), getKitchenStations);
router.get("/:id", hasPermission("KITCHEN_STATION_VIEW"), getKitchenStation);
router.get(
  "/:id/dashboard",
  hasPermission("KITCHEN_STATION_VIEW"),
  getStationDashboard,
);
router.post(
  "/",
  hasPermission("KITCHEN_STATION_CREATE"),
  createKitchenStation,
);
router.put(
  "/:id",
  hasPermission("KITCHEN_STATION_EDIT"),
  updateKitchenStation,
);
router.delete(
  "/:id",
  hasPermission("KITCHEN_STATION_DELETE"),
  deleteKitchenStation,
);
router.put(
  "/:id/assign-category/:categoryId",
  hasPermission("KITCHEN_STATION_ASSIGN_CATEGORY"),
  assignCategoryToStation,
);
router.delete(
  "/:id/remove-category/:categoryId",
  hasPermission("KITCHEN_STATION_REMOVE_CATEGORY"),
  removeCategoryFromStation,
);
module.exports = router;
