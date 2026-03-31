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
  handleImageUpload,
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
router.get("/sizes", hasPermission("MENU_VIEW_ALL"), getSizes);
router.post("/sizes", hasPermission("MENU_EDIT"), createSize);
router.put("/sizes/:id", hasPermission("MENU_EDIT"), updateSize);
router.patch("/sizes/:id/toggle-status", hasPermission("MENU_EDIT"), toggleSizeStatus);

router.post(
  "/coupons",
  hasPermission("MENU_EDIT"),
  createCoupon
);

router.put(
  "/coupons/:id",
  hasPermission("MENU_EDIT"),
  updateCoupon
);

router.patch(
  "/coupons/:id/toggle-status",
  hasPermission("MENU_EDIT"),
  toggleCouponStatus
);

router.post(
  "/categories",
  hasPermission("MENU_CREATE"),
  handleImageUpload,
  handleUploadErrors,
  createCategory
);

router.put(
  "/categories/:id",
  hasPermission("MENU_EDIT"),
  handleImageUpload,
  handleUploadErrors,
  updateCategory
);

router.put(
  "/categories/:id/status",
  hasPermission("CATEGORY_TOGGLE_STATUS"),
  toggleCategoryStatus
);

router.delete("/categories/:id", hasPermission("MENU_DELETE"), deleteCategory);

router.post(
  "/items",
  hasPermission("MENU_CREATE"),
  handleImageUpload,
  handleUploadErrors,
  createMenuItem
);

router.put(
  "/items/:id",
  hasPermission("MENU_EDIT"),
  handleImageUpload,
  handleUploadErrors,
  updateMenuItem
);

router.put(
  "/items/:id/availability",
  hasPermission("MENU_TOGGLE_AVAILABILITY"),
  toggleMenuItemAvailability
);

router.delete("/items/:id", hasPermission("MENU_DELETE"), deleteMenuItem);

router.get("/statistics", hasPermission("MENU_STATS"), getMenuStatistics);

router.put(
  "/items/bulk/update",
  hasPermission("MENU_BULK_OPERATIONS"),
  bulkUpdateMenuItems
);

router.post(
  "/items/bulk/import",
  hasPermission("MENU_IMPORT_EXPORT"),
  handleCSVUpload,
  handleUploadErrors,
  bulkImportMenuItems
);

router.get(
  "/items/:id/price-history",
  hasPermission("PRICE_STATS"),
  getPriceHistory
);
router.get("/price-changes", hasPermission("PRICE_STATS"), getAllPriceChanges);

router.get("/export", hasPermission("MENU_IMPORT_EXPORT"), exportMenuItems);
router.get(
  "/import/template",
  hasPermission("MENU_IMPORT_EXPORT"),
  downloadImportTemplate
);

module.exports = router;
