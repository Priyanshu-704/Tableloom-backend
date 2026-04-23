const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  createMenuItem,
  getMenuItems,
  getMenuItem,
  updateMenuItem,
  toggleMenuItemAvailability,
  deleteMenuItem,
  getMenuStatistics,
  getSeasonalItems,
  getPriceHistory,
  getAllPriceChanges,
  exportMenuItems,
  downloadImportTemplate,
  bulkImportMenuItems,
  bulkUpdateMenuItems,
  getSizes,
  createSize,
  updateSize,
  toggleSizeStatus,
  getMenuFilterOptions,
  getCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
} = require("../controllers/menuController");
const { protect, hasPermission, optionalAuth } = require("../middleware/auth");
const {
  createImageUploadHandler,
  handleCSVUpload,
  handleUploadErrors,
} = require("../utils/uploadMiddleware");
router.get("/categories", getCategories);
router.get("/filters", getMenuFilterOptions);
router.get("/coupons", optionalAuth, getCoupons);
router.get("/categories/:id", getCategoryById);
router.get("/items/seasonal", getSeasonalItems);
router.get("/items/:id", getMenuItem);
router.get("/items", optionalAuth, getMenuItems);
router.use(protect);
router.get("/sizes", hasPermission("MENU_SIZE_VIEW"), getSizes);
router.post("/sizes", hasPermission("MENU_SIZE_CREATE"), createSize);
router.put("/sizes/:id", hasPermission("MENU_SIZE_EDIT"), updateSize);
router.patch(
  "/sizes/:id/toggle-status",
  hasPermission("MENU_SIZE_TOGGLE_STATUS"),
  toggleSizeStatus,
);
router.post("/coupons", hasPermission("MENU_DISCOUNT_CREATE"), createCoupon);
router.put("/coupons/:id", hasPermission("MENU_DISCOUNT_EDIT"), updateCoupon);
router.patch(
  "/coupons/:id/toggle-status",
  hasPermission("MENU_DISCOUNT_TOGGLE_STATUS"),
  toggleCouponStatus,
);
router.post(
  "/categories",
  hasPermission("MENU_CATEGORY_CREATE"),
  createImageUploadHandler({
    folder: "images/categories",
  }),
  handleUploadErrors,
  createCategory,
);
router.put(
  "/categories/:id",
  hasPermission("MENU_CATEGORY_EDIT"),
  createImageUploadHandler({
    folder: "images/categories",
  }),
  handleUploadErrors,
  updateCategory,
);
router.put(
  "/categories/:id/status",
  hasPermission("CATEGORY_TOGGLE_STATUS"),
  toggleCategoryStatus,
);
router.delete(
  "/categories/:id",
  hasPermission("MENU_CATEGORY_DELETE"),
  deleteCategory,
);
router.post(
  "/items",
  hasPermission("MENU_CREATE"),
  createImageUploadHandler({
    folder: "images/menu-items",
  }),
  handleUploadErrors,
  createMenuItem,
);
router.put(
  "/items/:id",
  hasPermission("MENU_EDIT"),
  createImageUploadHandler({
    folder: "images/menu-items",
  }),
  handleUploadErrors,
  updateMenuItem,
);
router.put(
  "/items/:id/availability",
  hasPermission("MENU_TOGGLE_AVAILABILITY"),
  toggleMenuItemAvailability,
);
router.delete("/items/:id", hasPermission("MENU_DELETE"), deleteMenuItem);
router.get("/statistics", hasPermission("MENU_STATS"), getMenuStatistics);
router.put(
  "/items/bulk/update",
  hasPermission("MENU_BULK_OPERATIONS"),
  bulkUpdateMenuItems,
);
router.post(
  "/items/bulk/import",
  hasPermission("MENU_IMPORT_EXPORT"),
  handleCSVUpload,
  handleUploadErrors,
  bulkImportMenuItems,
);
router.get(
  "/items/:id/price-history",
  hasPermission("PRICE_STATS"),
  getPriceHistory,
);
router.get("/price-changes", hasPermission("PRICE_STATS"), getAllPriceChanges);
router.get("/export", hasPermission("MENU_IMPORT_EXPORT"), exportMenuItems);
router.get(
  "/import/template",
  hasPermission("MENU_IMPORT_EXPORT"),
  downloadImportTemplate,
);
module.exports = router;
