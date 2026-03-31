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

router.get(
  "/",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getKitchenStations
);

router.get(
  "/:id",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getKitchenStation
);

router.get(
  "/:id/dashboard",
  hasPermission("KITCHEN_VIEW_DASHBOARD"),
  getStationDashboard
);

router.post(
  "/",
  hasPermission("KITCHEN_MANAGE_STATIONS"),
  createKitchenStation
);

router.put(
  "/:id",
  hasPermission("KITCHEN_MANAGE_STATIONS"),
  updateKitchenStation
);

router.delete(
  "/:id",
  hasPermission("KITCHEN_MANAGE_STATIONS"),
  deleteKitchenStation
);

router.put(
  "/:id/assign-category/:categoryId",
  hasPermission("KITCHEN_MANAGE_STATIONS"),
  assignCategoryToStation
);

router.delete(
  "/:id/remove-category/:categoryId",
  hasPermission("KITCHEN_MANAGE_STATIONS"),
  removeCategoryFromStation
);

module.exports = router;
