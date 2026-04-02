const { logger } = require("./../utils/logger.js");
const Category = require("../models/Category");
const Coupon = require("../models/Coupon");
const MenuItem = require("../models/MenuItem");
const Size = require("../models/Size");
const PriceHistory = require("../models/PriceHistory");
const {
  parseCSV,
  generateCSVTemplate,
  generateExportData,
} = require("../utils/csvProcessor");
const { getOrSetCache, clearCache } = require("../utils/responseCache");
require("dotenv").config({ quiet: true });

const { deleteAsset } = require("../utils/cloudinaryStorage");
const { buildTenantAssetUrl, getApiBaseUrl } = require("../utils/assetUrl");

const MENU_CACHE_PREFIX = "menu:";
const MENU_ITEMS_CACHE_TTL_MS = 15 * 1000;
const MENU_FILTERS_CACHE_TTL_MS = 30 * 1000;
const MENU_CATEGORIES_CACHE_TTL_MS = 20 * 1000;

const invalidateMenuReadCaches = () => clearCache(MENU_CACHE_PREFIX);

const isAdminMenuRequest = (req) =>
  Boolean(
    req.user &&
      ["admin", "staff", "super-admin", "manager"].includes(req.user.role),
  );

const getMenuResponseView = (req) => {
  const requestedView = String(req.query.view || "").toLowerCase();
  if (requestedView === "customer") {
    return "customer";
  }

  if (requestedView === "admin") {
    return "admin";
  }

  return isAdminMenuRequest(req) ? "admin" : "customer";
};

const buildImageUrl = (req, type, id, hasImage) =>
  hasImage
    ? buildTenantAssetUrl(req, `/images/${type}/${id}`)
    : null;

const shapeMenuPrice = (price = {}, includeCostPrice = false) => ({
  price: price.price,
  size: price.sizeId || null,
  ...(includeCostPrice ? { costPrice: price.costPrice || null } : {}),
});

const shapeMenuItemForResponse = (req, item = {}, view = "customer") => {
  const isAdminView = view === "admin";

  return {
    _id: item._id,
    name: item.name,
    description: item.description || "",
    image: buildImageUrl(req, "menu-item", item._id, item.image),
    category: item.category
      ? {
          _id: item.category._id,
          name: item.category.name,
        }
      : null,
    prices: Array.isArray(item.prices)
      ? item.prices.map((price) => shapeMenuPrice(price, isAdminView))
      : [],
    activeDiscount: getActiveDiscount(item.discount),
    isAvailable: Boolean(item.isAvailable),
    isActive: Boolean(item.isActive),
    isVegetarian: Boolean(item.isVegetarian),
    isNonVegetarian: Boolean(item.isNonVegetarian),
    isVegan: Boolean(item.isVegan),
    isGlutenFree: Boolean(item.isGlutenFree),
    spiceLevel: Number(item.spiceLevel || 0),
    orderCount: Number(item.orderCount || 0),
    preparationTime: Number(item.preparationTime || 0),
    tags: Array.isArray(item.tags) ? item.tags : [],
    ...(isAdminView
      ? {
          station: item.station || null,
          ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
          allergens: Array.isArray(item.allergens) ? item.allergens : [],
          nutritionalInfo: item.nutritionalInfo || {},
          seasonal: item.seasonal || { isSeasonal: false },
          discount: item.discount || {
            isActive: false,
            type: "percentage",
            value: 0,
          },
        }
      : {}),
  };
};

const shapeCategoryForResponse = (req, category = {}, includeStation = false) => ({
  _id: category._id,
  name: category.name,
  description: category.description || "",
  image: buildImageUrl(req, "category", category._id, category.image),
  displayOrder: Number(category.displayOrder || 0),
  isActive: Boolean(category.isActive),
  ...(includeStation
    ? {
        kitchenStation: category.kitchenStation
          ? {
              _id: category.kitchenStation._id,
              name: category.kitchenStation.name,
              stationType: category.kitchenStation.stationType,
              status: category.kitchenStation.status,
            }
          : null,
      }
    : {}),
});

const normalizeSeasonalData = (value) => {
  if (value === undefined || value === null || value === "") {
    return { isSeasonal: false };
  }

  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error("Invalid JSON format for seasonal");
    }
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Seasonal data must be an object");
  }

  const normalized = {
    isSeasonal:
      parsed.isSeasonal === true ||
      parsed.isSeasonal === "true" ||
      parsed.isSeasonal === 1 ||
      parsed.isSeasonal === "1",
    seasonName: parsed.seasonName?.trim?.() || "",
  };

  if (parsed.startDate) {
    const startDate = new Date(parsed.startDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error("Invalid start date for seasonal");
    }
    normalized.startDate = startDate;
  }

  if (parsed.endDate) {
    const endDate = new Date(parsed.endDate);
    if (Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid end date for seasonal");
    }
    normalized.endDate = endDate;
  }

  if (
    normalized.startDate &&
    normalized.endDate &&
    normalized.startDate > normalized.endDate
  ) {
    throw new Error("Seasonal start date cannot be after end date");
  }

  if (!normalized.isSeasonal) {
    return {
      isSeasonal: false,
      seasonName: "",
    };
  }

  return normalized;
};

const normalizeDiscountData = (value) => {
  if (value === undefined || value === null || value === "") {
    return {
      isActive: false,
      type: "percentage",
      value: 0,
      code: "",
      description: "",
      startDate: null,
      endDate: null,
    };
  }

  let parsed = value;

  if (typeof value === "string") {
    parsed = JSON.parse(value);
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Discount data must be an object");
  }

  const normalized = {
    isActive:
      parsed.isActive === true ||
      parsed.isActive === "true" ||
      parsed.isActive === 1 ||
      parsed.isActive === "1",
    type: parsed.type === "fixed" ? "fixed" : "percentage",
    value: Number(parsed.value || 0),
    code: String(parsed.code || "")
      .trim()
      .toUpperCase(),
    description: String(parsed.description || "").trim(),
    startDate: parsed.startDate ? new Date(parsed.startDate) : null,
    endDate: parsed.endDate ? new Date(parsed.endDate) : null,
  };

  if (Number.isNaN(normalized.value) || normalized.value < 0) {
    throw new Error("Discount value must be a non-negative number");
  }

  if (normalized.startDate && Number.isNaN(normalized.startDate.getTime())) {
    throw new Error("Invalid discount start date");
  }

  if (normalized.endDate && Number.isNaN(normalized.endDate.getTime())) {
    throw new Error("Invalid discount end date");
  }

  if (
    normalized.startDate &&
    normalized.endDate &&
    normalized.startDate > normalized.endDate
  ) {
    throw new Error("Discount start date cannot be after end date");
  }

  if (!normalized.isActive || !normalized.value) {
    return {
      isActive: false,
      type: normalized.type,
      value: 0,
      code: normalized.code,
      description: normalized.description,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
    };
  }

  return normalized;
};

const getActiveDiscount = (discount = {}) => {
  if (!discount?.isActive || !Number(discount?.value || 0)) {
    return null;
  }

  const now = new Date();
  const startDate = discount.startDate ? new Date(discount.startDate) : null;
  const endDate = discount.endDate ? new Date(discount.endDate) : null;

  if (startDate && startDate > now) {
    return null;
  }

  if (endDate && endDate < now) {
    return null;
  }

  return discount;
};

exports.getSizes = async (req, res) => {
  try {
    const { activeOnly } = req.query;

    let query = {};

    const isActiveOnly =
      activeOnly === "true" ? true : activeOnly === "false" ? false : undefined;

    if (isActiveOnly !== undefined) {
      query.isActive = isActiveOnly;
    }

    const sizes = await Size.find(query)
      .select("_id name code isActive")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: sizes.length,
      data: sizes,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createSize = async (req, res) => {
  try {
    const { name, code, isActive } = req.body;

    const size = await Size.create({
      name,
      code,
      isActive: isActive ?? true,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Size created successfully",
    });
    invalidateMenuReadCaches();
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A size with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateSize = async (req, res) => {
  try {
    const size = await Size.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true },
    );

    if (!size)
      return res.status(404).json({ success: false, error: "Size not found" });

    res.status(200).json({
      success: true,
      message: "Updated Successfully",
    });
    invalidateMenuReadCaches();
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.toggleSizeStatus = async (req, res) => {
  try {
    const size = await Size.findById(req.params.id);

    if (!size)
      return res.status(404).json({ success: false, error: "Size not found" });

    size.isActive = !size.isActive;
    size.updatedBy = req.user._id;

    await size.save();

    res.status(200).json({
      success: true,
      message: `Size is now ${size.isActive ? "Active" : "Inactive"}`,
    });
    invalidateMenuReadCaches();
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ------categories -------
exports.createCategory = async (req, res) => {
  try {
    const { name, description, displayOrder, kitchenStation } = req.body;

    if (!String(name || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    if (!kitchenStation) {
      return res.status(400).json({
        success: false,
        message: "Kitchen station is required.",
      });
    }
    const categoryData = {
      name: String(name).trim(),
      description: String(description || "").trim(),
      displayOrder: Number.isFinite(Number(displayOrder))
        ? Number(displayOrder)
        : 0,
      isActive:
        req.body?.isActive === undefined
          ? true
          : req.body.isActive === true || req.body.isActive === "true",
      createdBy: req.user._id,
    };

    if (kitchenStation) {
      const KitchenStation = require("../models/KitchenStation");
      const stationExists = await KitchenStation.findById(kitchenStation);
      if (!stationExists) {
        return res.status(400).json({
          success: false,
          message: "Kitchen station not found",
        });
      }
      categoryData.kitchenStation = kitchenStation;
    }

    if (req.file) {
      if (!req.file.url) {
        return res.status(400).json({
          success: false,
          message: "Image upload failed - no Cloudinary URL received",
        });
      }

      categoryData.image = req.file.url;
      categoryData.imagePublicId = req.file.publicId;
      categoryData.imageProvider = req.file.storageProvider || "cloudinary";
    }

    const category = await Category.create(categoryData);

    const response = {
      success: true,
      message: "Category created successfully",
      data: shapeCategoryForResponse(req, category, false),
    };

    invalidateMenuReadCaches();
    return res.status(201).json(response);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { activeOnly, withStation } = req.query;

    let query = {};

    const hasActiveOnlyFilter =
      Object.prototype.hasOwnProperty.call(req.query, "activeOnly") &&
      ["true", "false"].includes(String(activeOnly));
    const hasWithStationFilter =
      Object.prototype.hasOwnProperty.call(req.query, "withStation") &&
      ["true", "false"].includes(String(withStation));

    const isActiveOnly = hasActiveOnlyFilter ? activeOnly === "true" : undefined;

    if (isActiveOnly !== undefined) {
      query.isActive = isActiveOnly;
    }

    const withStationFlag = hasWithStationFilter
      ? withStation === "true"
      : undefined;

    if (withStationFlag === true) {
      query.kitchenStation = { $exists: true, $ne: null };
    }

    if (withStationFlag === false) {
      query.kitchenStation = { $in: [null, undefined] };
    }

    const includeStation = withStationFlag !== false;
    const responseView = getMenuResponseView(req);
    const cacheKey = `${MENU_CACHE_PREFIX}categories:${req.tenantId || "public"}:${responseView}:${JSON.stringify({ query, includeStation })}`;

    const categories = await getOrSetCache(
      cacheKey,
      MENU_CATEGORIES_CACHE_TTL_MS,
      async () => {
        const categoryRows = await Category.find(query)
          .select("name description image displayOrder isActive kitchenStation")
          .populate("kitchenStation", "name stationType status")
          .sort({ displayOrder: 1, name: 1 })
          .lean();

        return categoryRows.map((category) =>
          shapeCategoryForResponse(req, category, includeStation),
        );
      },
    );

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("kitchenStation", "name stationType")
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.image = buildImageUrl(req, "category", category._id, category.image);

    category.storageType = category.image ? "cloudinary" : "none";

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { kitchenStation, ...otherData } = req.body;

    const updateData = {
      ...otherData,
      updatedBy: req.user.id,
    };

    const oldCategory = await Category.findById(req.params.id);
    if (!oldCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (kitchenStation !== undefined) {
      if (kitchenStation) {
        const stationExists =
          await require("../models/KitchenStation").findById(kitchenStation);
        if (!stationExists) {
          return res.status(400).json({
            success: false,
            message: "Kitchen station not found",
          });
        }
        updateData.kitchenStation = kitchenStation;
      } else {
        updateData.kitchenStation = null;
      }
    }

    if (req.file) {
      if (!req.file.url) {
        return res.status(400).json({
          success: false,
          message: "Image upload failed - no Cloudinary URL received",
        });
      }

      if (oldCategory.imagePublicId) {
        try {
          await deleteAsset(oldCategory.imagePublicId, "image");
          logger.info("Deleted old category image:", oldCategory.image);
        } catch (err) {
          logger.error("Cloudinary delete failed:", err);
        }
      }

      updateData.image = req.file.url;
      updateData.imagePublicId = req.file.publicId;
      updateData.imageProvider = req.file.storageProvider || "cloudinary";
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    ).populate("kitchenStation", "name stationType");

    const response = {
      success: true,
      message: "Category updated successfully",
      data: {
        _id: updatedCategory._id,
        name: updatedCategory.name,
        kitchenStation: updatedCategory.kitchenStation,
      },
    };

    invalidateMenuReadCaches();
    return res.status(200).json(response);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${
        category.isActive ? "activated" : "deactivated"
      } successfully`,
    });
    invalidateMenuReadCaches();
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const itemCount = await MenuItem.countDocuments({ category: category._id });

    if (itemCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category because menu items are linked to it. Remove or update those menu items first.",
      });
    }

    if (category.imagePublicId) {
      await deleteAsset(category.imagePublicId, "image");
    }
    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
    invalidateMenuReadCaches();
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const menuData = {
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    };

    const safeParseArray = (value, fieldName) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        value = value.trim();

        if (value === "") {
          return [];
        }

        if (value.startsWith("[")) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              return parsed;
            }
            return [parsed];
          } catch (error) {
            logger.error(`JSON parse error for ${fieldName}:`, error);
          }
        }

        if (value.includes(",")) {
          return value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== "");
        }

        return [value];
      }

      return [value];
    };

    const parseJsonObject = (value, fieldName) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        return value;
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        value = value.trim();

        if (value === "") {
          return null;
        }

        try {
          return JSON.parse(value);
        } catch (error) {
          logger.error(`JSON parse error for ${fieldName}:`, error);
          throw new Error(`Invalid JSON format for ${fieldName}`);
        }
      }

      return value;
    };

    try {
      menuData.ingredients = safeParseArray(
        menuData.ingredients,
        "ingredients",
      );
      menuData.allergens = safeParseArray(menuData.allergens, "allergens");
      menuData.tags = safeParseArray(menuData.tags, "tags");

      menuData.prices = parseJsonObject(menuData.prices, "prices");

      menuData.nutritionalInfo = parseJsonObject(
        menuData.nutritionalInfo,
        "nutritionalInfo",
      );
      menuData.seasonal = normalizeSeasonalData(menuData.seasonal);
      menuData.discount = normalizeDiscountData(menuData.discount);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.message.includes("ingredients")
          ? "ingredients"
          : error.message.includes("allergens")
            ? "allergens"
            : error.message.includes("tags")
              ? "tags"
              : error.message.includes("prices")
                ? "prices"
                : error.message.includes("nutritionalInfo")
                  ? "nutritionalInfo"
                  : error.message.includes("seasonal")
                    ? "seasonal"
                    : error.message.includes("Discount")
                      ? "discount"
                    : "unknown",
      });
    }

    if (!menuData.name || !menuData.name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Menu item name is required",
      });
    }

    if (!menuData.category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (
      !menuData.prices ||
      !Array.isArray(menuData.prices) ||
      menuData.prices.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one price is required",
      });
    }

    if (menuData.isVegetarian !== undefined) {
      menuData.isVegetarian =
        menuData.isVegetarian === "true" ||
        menuData.isVegetarian === true ||
        menuData.isVegetarian === "1";
    }

    if (menuData.spiceLevel !== undefined) {
      const spiceLevel = parseInt(menuData.spiceLevel);
      if (isNaN(spiceLevel) || spiceLevel < 0 || spiceLevel > 5) {
        return res.status(400).json({
          success: false,
          message: "Spice level must be a number between 0 and 5",
        });
      }
      menuData.spiceLevel = spiceLevel;
    }

    if (menuData.preparationTime !== undefined) {
      const prepTime = parseInt(menuData.preparationTime);
      if (isNaN(prepTime) || prepTime < 0) {
        return res.status(400).json({
          success: false,
          message: "Preparation time must be a positive number",
        });
      }
      menuData.preparationTime = prepTime;
    }

    for (const price of menuData.prices) {
      if (!price.sizeId || !price.price) {
        return res.status(400).json({
          success: false,
          message: "Each price must have size and price fields",
        });
      }

      try {
        const sizeExists = await Size.findById(price.sizeId);
        if (!sizeExists) {
          return res.status(400).json({
            success: false,
            message: `Invalid size ID: ${price.sizeId}`,
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Invalid size ID format: ${price.sizeId}`,
        });
      }

      const priceValue = parseFloat(price.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for size ${price.sizeId}: must be a positive number`,
        });
      }
      price.price = priceValue;

      if (price.costPrice !== undefined) {
        const costPriceValue = parseFloat(price.costPrice);
        if (isNaN(costPriceValue) || costPriceValue < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid cost price for size ${price.sizeId}: must be a non-negative number`,
          });
        }
        price.costPrice = costPriceValue;
      }
    }

    if (req.file) {
      if (req.file.url) {
        menuData.image = req.file.url;
        menuData.imagePublicId = req.file.publicId;
        menuData.imageProvider = req.file.storageProvider || "cloudinary";
        logger.info("Image uploaded successfully. Cloudinary URL:", menuData.image);
      } else {
        return res.status(400).json({
          success: false,
          message: "Image upload failed - no file path received",
        });
      }
    }

    menuData.isAvailable =
      menuData.isAvailable !== undefined
        ? menuData.isAvailable === "true" || menuData.isAvailable === true
        : true;

    menuData.isActive =
      menuData.isActive !== undefined
        ? menuData.isActive === "true" || menuData.isActive === true
        : true;

    const menuItem = await MenuItem.create(menuData);

    await MenuItem.findById(menuItem._id)
      .populate("category", "name")
      .populate("prices.sizeId", "name description")
      .lean();

    invalidateMenuReadCaches();

    return res.status(201).json({
      success: true,
      message: "Menu item created successfully",
    });
  } catch (error) {
    logger.error("Create menu item error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `Menu item with this ${field} already exists`,
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    // Handle CastError (invalid ObjectId)
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    // Default error response
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating menu item",
      error:
        process.env.NODE_ENV === "development"
          ? {
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
};

exports.getMenuItems = async (req, res) => {
  try {
    const {
      query,
      category,
      minPrice,
      maxPrice,
      dietary,
      tags,
      sizeIds,
      spiceLevels,
      isAvailable,
      availableOnly = "true",
      activeOnly = "true",
      page = 1,
      limit = 20,
      sortBy = "",
    } = req.query;

    const responseView = getMenuResponseView(req);
    const isAdmin = responseView === "admin";

    let mongoQuery = {};

    if (activeOnly === "true") mongoQuery.isActive = true;
    if (isAvailable === "true") {
      mongoQuery.isAvailable = true;
    } else if (isAvailable === "false") {
      mongoQuery.isAvailable = false;
    } else if (availableOnly === "true") {
      mongoQuery.isAvailable = true;
    }
    if (category) mongoQuery.category = category;

    if (query) {
      mongoQuery.$or = [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { ingredients: { $in: [new RegExp(query, "i")] } },
        { tags: { $in: [new RegExp(query, "i")] } },
      ];
    }

    if (dietary) {
      const dietaryArr = dietary.split(",");
      if (dietaryArr.includes("vegetarian")) mongoQuery.isVegetarian = true;
      if (dietaryArr.includes("nonVegetarian"))
        mongoQuery.isNonVegetarian = true;
      if (dietaryArr.includes("vegan")) mongoQuery.isVegan = true;
      if (dietaryArr.includes("glutenFree")) mongoQuery.isGlutenFree = true;
    }

    if (tags) {
      const tagArray = tags.split(",");
      mongoQuery.tags = { $in: tagArray };
    }

    if (sizeIds) {
      const sizeIdArray = sizeIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (sizeIdArray.length > 0) {
        mongoQuery["prices.sizeId"] = { $in: sizeIdArray };
      }
    }

    if (spiceLevels) {
      const spiceLevelArray = spiceLevels
        .split(",")
        .map((value) => parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 5);

      if (spiceLevelArray.length > 0) {
        mongoQuery.spiceLevel = { $in: spiceLevelArray };
      }
    }

    if (minPrice || maxPrice) {
      const priceCond = {};
      if (minPrice) priceCond.$gte = parseFloat(minPrice);
      if (maxPrice) priceCond.$lte = parseFloat(maxPrice);

      mongoQuery.prices = {
        $elemMatch: { price: priceCond },
      };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortConfig =
      sortBy === "price_low"
        ? { "prices.0.price": 1, name: 1 }
        : sortBy === "price_high"
          ? { "prices.0.price": -1, name: 1 }
          : sortBy === "popular"
            ? { orderCount: -1, name: 1 }
            : { displayOrder: 1, name: 1 };

    const menuItemSelect = isAdmin
      ? "name description image category station ingredients allergens spiceLevel preparationTime isVegetarian isNonVegetarian isVegan isGlutenFree isAvailable isActive displayOrder tags nutritionalInfo orderCount seasonal discount prices"
      : "name description image category spiceLevel preparationTime isVegetarian isNonVegetarian isVegan isGlutenFree isAvailable isActive displayOrder tags orderCount discount prices";

    const cacheKey = `${MENU_CACHE_PREFIX}items:${req.tenantId || "public"}:${responseView}:${getApiBaseUrl(req)}:${req.originalUrl}`;
    const payload = await getOrSetCache(
      cacheKey,
      MENU_ITEMS_CACHE_TTL_MS,
      async () => {
        let menuItemsQuery = MenuItem.find(mongoQuery)
          .select(menuItemSelect)
          .populate("category", "name")
          .populate("prices.sizeId", "name code")
          .sort(query ? { name: 1 } : sortConfig)
          .skip(skip)
          .limit(limitNum)
          .lean();

        if (isAdmin) {
          menuItemsQuery = menuItemsQuery.populate("station", "name stationType status");
        }

        const [menuItems, total] = await Promise.all([
          menuItemsQuery,
          MenuItem.countDocuments(mongoQuery),
        ]);

        return {
          success: true,
          count: menuItems.length,
          total,
          pagination: {
            page: pageNum,
            pages: Math.ceil(total / limitNum),
          },
          data: menuItems.map((item) =>
            shapeMenuItemForResponse(req, item, responseView),
          ),
        };
      },
    );

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Get menu items error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching menu items",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getMenuFilterOptions = async (req, res) => {
  try {
    const baseQuery = {
      isActive: true,
      isAvailable: true,
    };

    const cacheKey = `${MENU_CACHE_PREFIX}filters:${req.tenantId || "public"}`;
    const data = await getOrSetCache(
      cacheKey,
      MENU_FILTERS_CACHE_TTL_MS,
      async () => {
        const [sizes, tagStats, priceRange, spiceStats, dietaryCounts] =
          await Promise.all([
            Size.find({ isActive: true })
              .sort({ name: 1 })
              .select("_id name code")
              .lean(),
            MenuItem.aggregate([
              { $match: baseQuery },
              { $unwind: "$tags" },
              {
                $group: {
                  _id: { $toLower: "$tags" },
                  count: { $sum: 1 },
                  label: { $first: "$tags" },
                },
              },
              { $sort: { count: -1, label: 1 } },
              { $limit: 12 },
            ]),
            MenuItem.aggregate([
              { $match: baseQuery },
              { $unwind: "$prices" },
              {
                $group: {
                  _id: null,
                  minPrice: { $min: "$prices.price" },
                  maxPrice: { $max: "$prices.price" },
                },
              },
            ]),
            MenuItem.aggregate([
              { $match: baseQuery },
              {
                $group: {
                  _id: "$spiceLevel",
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ]),
            MenuItem.aggregate([
              { $match: baseQuery },
              {
                $group: {
                  _id: null,
                  vegetarian: {
                    $sum: { $cond: [{ $eq: ["$isVegetarian", true] }, 1, 0] },
                  },
                  vegan: {
                    $sum: { $cond: [{ $eq: ["$isVegan", true] }, 1, 0] },
                  },
                  nonVegetarian: {
                    $sum: {
                      $cond: [{ $eq: ["$isNonVegetarian", true] }, 1, 0],
                    },
                  },
                  glutenFree: {
                    $sum: { $cond: [{ $eq: ["$isGlutenFree", true] }, 1, 0] },
                  },
                },
              },
            ]),
          ]);

        return {
          sizes,
          popularTags: tagStats.map((tag) => ({
            value: tag.label,
            count: tag.count,
          })),
          priceRange: {
            min: priceRange[0]?.minPrice || 0,
            max: priceRange[0]?.maxPrice || 0,
          },
          spiceLevels: spiceStats.map((entry) => ({
            level: entry._id ?? 0,
            count: entry.count,
          })),
          dietary: dietaryCounts[0] || {
            vegetarian: 0,
            vegan: 0,
            nonVegetarian: 0,
            glutenFree: 0,
          },
        };
      },
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Get menu filter options error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching menu filter options",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate("category", "name")
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .lean();

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }
    delete menuItem.__v;

    if (menuItem.prices && Array.isArray(menuItem.prices)) {
      menuItem.prices = menuItem.prices.map((price) => ({
        size: price.sizeId,
        price: price.price,
        ...(price.costPrice && { costPrice: price.costPrice }),
      }));
    }
    menuItem.image = buildImageUrl(
      req,
      "menu-item",
      menuItem._id,
      menuItem.image,
    );
    menuItem.activeDiscount = getActiveDiscount(menuItem.discount);

    res.status(200).json({
      success: true,
      message: "Item Fetched successfully!",
      data: menuItem,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    let updateData = { ...req.body, updatedBy: req.user.id };

    const safeParseArray = (value) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        value = value.trim();

        if (value === "") {
          return [];
        }

        if (value.startsWith("[")) {
          try {
            return JSON.parse(value);
          } catch (error) {
            logger.error("JSON parse error, trying comma separation");
          }
        }

        if (value.includes(",")) {
          return value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== "");
        }

        return [value];
      }

      return [value];
    };

    const parseJsonObject = (value, fieldName) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        return value;
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        value = value.trim();

        if (value === "") {
          return null;
        }

        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Invalid JSON format for ${fieldName}`);
        }
      }

      return value;
    };

    try {
      updateData.ingredients = safeParseArray(updateData.ingredients);
      updateData.allergens = safeParseArray(updateData.allergens);
      updateData.tags = safeParseArray(updateData.tags);

      updateData.prices = parseJsonObject(updateData.prices, "prices");
      updateData.nutritionalInfo = parseJsonObject(
        updateData.nutritionalInfo,
        "nutritionalInfo",
      );
      if (Object.prototype.hasOwnProperty.call(updateData, "seasonal")) {
        updateData.seasonal = normalizeSeasonalData(updateData.seasonal);
      }
      if (Object.prototype.hasOwnProperty.call(updateData, "discount")) {
        updateData.discount = normalizeDiscountData(updateData.discount);
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (updateData.isVegetarian !== undefined) {
      updateData.isVegetarian =
        updateData.isVegetarian === "true" || updateData.isVegetarian === true;
    }

    if (updateData.isNonVegetarian !== undefined) {
      updateData.isNonVegetarian =
        updateData.isNonVegetarian === "true" ||
        updateData.isNonVegetarian === true;
    }

    if (updateData.isVegan !== undefined) {
      updateData.isVegan =
        updateData.isVegan === "true" || updateData.isVegan === true;
    }

    if (updateData.isGlutenFree !== undefined) {
      updateData.isGlutenFree =
        updateData.isGlutenFree === "true" || updateData.isGlutenFree === true;
    }

    if (updateData.isAvailable !== undefined) {
      updateData.isAvailable =
        updateData.isAvailable === "true" || updateData.isAvailable === true;
    }

    if (updateData.isActive !== undefined) {
      updateData.isActive =
        updateData.isActive === "true" || updateData.isActive === true;
    }

    if (updateData.spiceLevel) {
      updateData.spiceLevel = parseInt(updateData.spiceLevel);
    }

    if (updateData.preparationTime) {
      updateData.preparationTime = parseInt(updateData.preparationTime);
    }

    if (updateData.displayOrder) {
      updateData.displayOrder = parseInt(updateData.displayOrder);
    }

    if (updateData.prices) {
      if (!Array.isArray(updateData.prices)) {
        return res.status(400).json({
          success: false,
          message: "Prices must be an array",
        });
      }

      for (const price of updateData.prices) {
        const sizeExists = await Size.findById(price.sizeId);
        if (!sizeExists) {
          return res.status(400).json({
            success: false,
            message: `Invalid size ID: ${price.sizeId}`,
          });
        }
      }

      const currentItem = await MenuItem.findById(req.params.id);
      if (currentItem) {
        for (const newPrice of updateData.prices) {
          const oldPriceObj = currentItem.prices.find(
            (p) => p.sizeId.toString() === newPrice.sizeId.toString(),
          );

          if (oldPriceObj && oldPriceObj.price !== newPrice.price) {
            const changeType =
              oldPriceObj.price < newPrice.price ? "increase" : "decrease";
            const changePercentage =
              ((newPrice.price - oldPriceObj.price) / oldPriceObj.price) * 100;

            await PriceHistory.create({
              menuItem: req.params.id,
              size: newPrice.sizeId,
              oldPrice: oldPriceObj.price,
              newPrice: newPrice.price,
              changeType,
              changePercentage: Math.round(changePercentage * 100) / 100,
              changedBy: req.user.id,
              reason: "Manual update via edit form",
              changedAt: new Date(),
            });
          } else if (!oldPriceObj) {
            await PriceHistory.create({
              menuItem: req.params.id,
              size: newPrice.sizeId,
              oldPrice: 0,
              newPrice: newPrice.price,
              changeType: "initial",
              changePercentage: 100,
              changedBy: req.user.id,
              reason: "New size added via edit form",
              changedAt: new Date(),
            });
          }
        }
      }
    }

    if (req.file) {
      if (!req.file.url) {
        return res.status(400).json({
          success: false,
          message: "Image upload failed - no Cloudinary URL received",
        });
      }

      updateData.image = req.file.url;
      updateData.imagePublicId = req.file.publicId;
      updateData.imageProvider = req.file.storageProvider || "cloudinary";

      const oldMenuItem = await MenuItem.findById(req.params.id);
      if (oldMenuItem?.imagePublicId) {
        try {
          await deleteAsset(oldMenuItem.imagePublicId, "image");
          logger.info("Deleted old Cloudinary image:", oldMenuItem.image);
        } catch (err) {
          logger.error("Failed to delete old Cloudinary image:", err);
        }
      }
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    )
      .populate("category", "name")
      .populate({
        path: "updatedBy",
        select: "_id name",
      });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    invalidateMenuReadCaches();

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
    });
  } catch (error) {
    logger.error("Update menu item error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Menu item with this name already exists in this category",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}: ${error.value}`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error updating menu item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.toggleMenuItemAvailability = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    menuItem.isAvailable = !menuItem.isAvailable;
    menuItem.updatedBy = req.user.id;
    await menuItem.save();

    await menuItem.populate("updatedBy", "name");

    invalidateMenuReadCaches();

    res.status(200).json({
      success: true,
      message: `Menu item ${
        menuItem.isAvailable ? "available" : "unavailable"
      } successfully`,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const query = {};

    if (activeOnly === "true") {
      query.isActive = true;
    } else if (activeOnly === "false") {
      query.isActive = false;
    }

    const coupons = await Coupon.find(query)
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: coupons.length,
      data: coupons,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      code: String(req.body.code || "").trim().toUpperCase(),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    };

    const coupon = await Coupon.create(payload);

    invalidateMenuReadCaches();

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message:
        error.code === 11000 ? "Coupon code already exists" : "Failed to create coupon",
      error: error.message,
    });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      updatedBy: req.user.id,
    };

    if (payload.code) {
      payload.code = String(payload.code).trim().toUpperCase();
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    invalidateMenuReadCaches();

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message:
        error.code === 11000 ? "Coupon code already exists" : "Failed to update coupon",
      error: error.message,
    });
  }
};

exports.toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    coupon.isActive = !coupon.isActive;
    coupon.updatedBy = req.user.id;
    await coupon.save();

    invalidateMenuReadCaches();

    return res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
      data: coupon,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle coupon status",
      error: error.message,
    });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    invalidateMenuReadCaches();

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getMenuStatistics = async (req, res) => {
  try {
    const [
      totalItems,
      availableItems,
      categoriesCount,
      vegetarianCount,
      nonVegetarianCount,
      veganCount,
      glutenFreeCount,
    ] = await Promise.all([
      MenuItem.countDocuments({ isActive: true }),
      MenuItem.countDocuments({ isActive: true, isAvailable: true }),
      Category.countDocuments({ isActive: true }),
      MenuItem.countDocuments({ isActive: true, isVegetarian: true }),
      MenuItem.countDocuments({ isActive: true, isNonVegetarian: true }),
      MenuItem.countDocuments({ isActive: true, isVegan: true }),
      MenuItem.countDocuments({ isActive: true, isGlutenFree: true }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalItems,
        availableItems,
        unavailableItems: totalItems - availableItems,
        categoriesCount,
        dietary: {
          vegetarian: vegetarianCount,
          nonVegetarian: nonVegetarianCount,
          vegan: veganCount,
          glutenFree: glutenFreeCount,
        },
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.bulkUpdateMenuItems = async (req, res) => {
  try {
    const { updates, action } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Updates array is required",
      });
    }

    const results = { successful: 0, failed: 0, errors: [] };

    for (const update of updates) {
      try {
        const {
          menuItemId,
          sizeId,
          newPrice,
          costPrice,
          isAvailable,
          isActive,
          categoryId,
          reason,
        } = update;

        const menuItem = await MenuItem.findById(menuItemId);
        if (!menuItem) {
          results.failed++;
          results.errors.push(`MenuItem not found: ${menuItemId}`);
          continue;
        }

        switch (action) {
          case "updatePrices":
            if (!sizeId) {
              results.failed++;
              results.errors.push(
                `Size is required for price update: ${menuItemId}`,
              );
              continue;
            }

            const sizeDoc = await Size.findById(sizeId);
            if (!sizeDoc) {
              results.failed++;
              results.errors.push(`Size not found: ${sizeId}`);
              continue;
            }

            const priceIndex = menuItem.prices.findIndex((p) =>
              p.sizeId.equals(sizeDoc._id),
            );
            let oldPrice = 0;

            if (priceIndex !== -1) {
              oldPrice = menuItem.prices[priceIndex].price;
              menuItem.prices[priceIndex].price = parseFloat(newPrice);
              if (costPrice !== undefined)
                menuItem.prices[priceIndex].costPrice = parseFloat(costPrice);
            } else {
              menuItem.prices.push({
                sizeId: sizeDoc._id,
                price: parseFloat(newPrice),
                costPrice:
                  costPrice !== undefined ? parseFloat(costPrice) : undefined,
              });
            }

            menuItem.updatedBy = req.user.id;
            await menuItem.save();

            const changeType =
              oldPrice === 0
                ? "initial"
                : oldPrice < newPrice
                  ? "increase"
                  : "decrease";
            const changePercentage =
              oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 100;

            await PriceHistory.create({
              menuItem: menuItem._id,
              sizeId: sizeDoc._id,
              oldPrice,
              newPrice: parseFloat(newPrice),
              changeType,
              changePercentage: Math.round(changePercentage * 100) / 100,
              changedBy: req.user.id,
              reason:
                reason ||
                (priceIndex === -1 ? "New size added" : "Bulk price update"),
              changedAt: new Date(),
            });

            results.successful++;
            break;

          case "updateAvailability":
            if (sizeId) {
              const sizeDoc = await Size.findOne({
                code: sizeId.toUpperCase(),
              });
              if (!sizeDoc) {
                results.failed++;
                results.errors.push(`Size not found: ${sizeId}`);
                continue;
              }
              const priceObj = menuItem.prices.find((p) =>
                p.sizeId.equals(sizeDoc._id),
              );
              if (priceObj) priceObj.isAvailable = isAvailable;
            } else {
              menuItem.isAvailable = isAvailable;
            }
            menuItem.updatedBy = req.user.id;
            await menuItem.save();
            results.successful++;
            break;

          case "updateStatus":
            if (sizeId) {
              const sizeDoc = await Size.findOne({
                code: sizeId.toUpperCase(),
              });
              if (!sizeDoc) {
                results.failed++;
                results.errors.push(`Size not found: ${sizeId}`);
                continue;
              }
              const priceObj = menuItem.prices.find((p) =>
                p.sizeId.equals(sizeDoc._id),
              );
              if (priceObj) priceObj.isActive = isActive;
            } else {
              menuItem.isActive = isActive;
            }
            menuItem.updatedBy = req.user.id;
            await menuItem.save();
            results.successful++;
            break;

          case "updateCategories":
            menuItem.category = categoryId;
            menuItem.updatedBy = req.user.id;
            await menuItem.save();
            results.successful++;
            break;

          default:
            results.failed++;
            results.errors.push(`Invalid action: ${action}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Error processing item ${update.menuItemId}: ${error.message}`,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed`,
      data: results,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk operation",
      error: error.message,
    });
  }
};

exports.getSeasonalItems = async (req, res) => {
  try {
    const currentDate = new Date();

    const seasonalItems = await MenuItem.find({
      "seasonal.isSeasonal": true,
      $or: [
        {
          "seasonal.startDate": { $lte: currentDate },
          "seasonal.endDate": { $gte: currentDate },
        },
        {
          "seasonal.startDate": { $exists: false },
          "seasonal.endDate": { $exists: false },
        },
      ],
    })
      .populate("category", "name")
      .populate("prices.sizeId", "name code")
      .sort({ "seasonal.startDate": 1, displayOrder: 1 })
      .lean();

    const formattedItems = seasonalItems.map((item) => {
      item.image = buildImageUrl(req, "menu-item", item._id, item.image);

      if (Array.isArray(item.prices)) {
        item.prices = item.prices.map((price) => ({
          price: price.price,
          costPrice: price.costPrice,
          size: price.sizeId,
        }));
      }

      return item;
    });

    res.status(200).json({
      success: true,
      count: formattedItems.length,
      data: formattedItems,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seasonal items",
      error: error.message,
    });
  }
};

exports.getPriceHistory = async (req, res) => {
  try {
    const { period = "all", sizeId } = req.query;
    const now = new Date();

    let dateFilter = {};
    switch (period) {
      case "week":
        dateFilter.changedAt = {
          $gte: new Date(now.setDate(now.getDate() - 7)),
        };
        break;
      case "month":
        dateFilter.changedAt = {
          $gte: new Date(now.setMonth(now.getMonth() - 1)),
        };
        break;
      case "quarter":
        dateFilter.changedAt = {
          $gte: new Date(now.setMonth(now.getMonth() - 3)),
        };
        break;
      case "year":
        dateFilter.changedAt = {
          $gte: new Date(now.setFullYear(now.getFullYear() - 1)),
        };
        break;
      default:
        break;
    }

    const query = {
      menuItem: req.params.id,
      ...dateFilter,
    };

    if (sizeId) {
      query.sizeId = sizeId;
    }

    const priceHistory = await PriceHistory.find(query)
      .populate("changedBy", "name email")
      .populate("sizeId", "name code")
      .sort({ changedAt: -1 })
      .lean();

    const menuItem = await MenuItem.findById(req.params.id)
      .select("name category")
      .populate("category", "name")
      .lean();

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    const formattedHistory = priceHistory.map((h) => ({
      id: h._id,
      size: h.sizeId
        ? {
            id: h.sizeId._id,
            name: h.sizeId.name,
            code: h.sizeId.code,
          }
        : null,
      oldPrice: h.oldPrice,
      newPrice: h.newPrice,
      changeType: h.changeType,
      changePercentage: h.changePercentage,
      changedBy: h.changedBy
        ? {
            id: h.changedBy._id,
            name: h.changedBy.name,
          }
        : null,
      changedAt: h.changedAt,
      reason: h.reason,
    }));

    res.status(200).json({
      success: true,
      data: {
        menuItem: {
          id: menuItem._id,
          name: menuItem.name,
          category: menuItem.category?.name || null,
        },
        history: formattedHistory,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch price history",
      error: error.message,
    });
  }
};

exports.getAllPriceChanges = async (req, res) => {
  try {
    const { startDate, endDate, changeType, page = 1, limit = 20 } = req.query;

    let filter = {};
    if (startDate || endDate) {
      filter.changedAt = {};
      if (startDate) filter.changedAt.$gte = new Date(startDate);
      if (endDate) filter.changedAt.$lte = new Date(endDate);
    }

    if (changeType) {
      filter.changeType = changeType;
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [priceChanges, total] = await Promise.all([
      PriceHistory.find(filter)
        .populate("menuItem", "name")
        .populate("sizeId", "name code")
        .populate("changedBy", "name email")
        .sort({ changedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      PriceHistory.countDocuments(filter),
    ]);

    const formattedData = priceChanges.map((p) => ({
      id: p._id,
      menuItem: p.menuItem
        ? {
            id: p.menuItem._id,
            name: p.menuItem.name,
          }
        : null,
      size: p.sizeId
        ? {
            id: p.sizeId._id,
            name: p.sizeId.name,
            code: p.sizeId.code,
          }
        : null,
      oldPrice: p.oldPrice,
      newPrice: p.newPrice,
      changeType: p.changeType,
      changePercentage: p.changePercentage,
      changedBy: p.changedBy
        ? {
            id: p.changedBy._id,
            name: p.changedBy.name,
          }
        : null,
      changedAt: p.changedAt,
      reason: p.reason,
    }));

    res.status(200).json({
      success: true,
      count: formattedData.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch price changes",
      error: error.message,
    });
  }
};

exports.exportMenuItems = async (req, res) => {
  try {
    const {
      category,
      itemIds,
      availableOnly = "false",
      activeOnly = "true",
    } = req.query;

    let query = { isActive: activeOnly === "true" };
    if (category) query.category = category;
    if (availableOnly === "true") query.isAvailable = true;
    if (itemIds) {
      query._id = {
        $in: String(itemIds)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      };
    }

    const menuItems = await MenuItem.find(query)
      .populate({
        path: "prices.sizeId",
        select: "name code",
      })
      .populate("category", "name")
      .sort({ category: 1, displayOrder: 1 });

    const csvData = generateExportData(menuItems);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=menu-export-${Date.now()}.csv`,
    );

    res.send(csvData);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Export failed",
      error: error.message,
    });
  }
};

exports.downloadImportTemplate = async (req, res) => {
  try {
    const csvTemplate = generateCSVTemplate();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=menu-import-template.csv",
    );

    res.status(200).send(csvTemplate);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to generate template",
      error: error.message,
    });
  }
};

exports.bulkImportMenuItems = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required for import",
      });
    }

    const fileBuffer = req.file.buffer;

    const results = {
      created: 0,
      failed: 0,
      errors: [],
    };

    const rows = await parseCSV(fileBuffer);

    for (const row of rows) {
      try {
        if (!row.name || !row.category || !row.sizeId) {
          results.failed++;
          results.errors.push(
            `Missing required fields (name/category/size): ${JSON.stringify(
              row,
            )}`,
          );
          continue;
        }

        const sizeExists = await Size.findById(row.sizeId);
        if (!sizeExists) {
          results.failed++;
          results.errors.push(`Invalid size id: ${row.sizeId}`);
          continue;
        }

        const categoryDoc = await Category.findById(row.category).select(
          "kitchenStation",
        );

        if (!categoryDoc || !categoryDoc.kitchenStation) {
          results.failed++;
          results.errors.push(
            `Kitchen station not configured for category: ${row.category}`,
          );
          continue;
        }

        const toBool = (val) =>
          typeof val === "string" && val.toLowerCase() === "true";

        const ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
        const allergens = row.allergens ? JSON.parse(row.allergens) : [];
        const tags = row.tags ? JSON.parse(row.tags) : [];
        const seasonal = normalizeSeasonalData({
          isSeasonal: row.isSeasonal,
          startDate: row.startDate,
          endDate: row.endDate,
          seasonName: row.seasonName,
        });

        let menuItem = await MenuItem.findOne({ name: row.name });

        const priceRow = {
          sizeId: row.sizeId,
          price: Number(row.price) || 0,
          costPrice: Number(row.costPrice) || 0,
        };

        if (menuItem) {
          menuItem.name = row.name;
          menuItem.description = row.description || "";
          menuItem.category = row.category;
          menuItem.station = categoryDoc.kitchenStation;
          menuItem.nutritionalInfo = {
            calories: Number(row.calories) || 0,
            protein: Number(row.protein) || 0,
            carbs: Number(row.carbs) || 0,
            fat: Number(row.fat) || 0,
          };
          menuItem.displayOrder = Number(row.displayOrder) || 0;
          menuItem.spiceLevel = Number(row.spiceLevel) || 0;
          menuItem.preparationTime = Number(row.preparationTime) || 15;
          menuItem.isVegetarian = toBool(row.isVegetarian);
          menuItem.isNonVegetarian = toBool(row.isNonVegetarian);
          menuItem.isVegan = toBool(row.isVegan);
          menuItem.isGlutenFree = toBool(row.isGlutenFree);
          menuItem.isAvailable =
            row.isAvailable === undefined || row.isAvailable === ""
              ? menuItem.isAvailable
              : toBool(row.isAvailable);
          menuItem.isActive =
            row.isActive === undefined || row.isActive === ""
              ? menuItem.isActive
              : toBool(row.isActive);
          menuItem.ingredients = ingredients;
          menuItem.allergens = allergens;
          menuItem.tags = tags;
          menuItem.seasonal = seasonal;

          const existingPriceIndex = menuItem.prices.findIndex((price) =>
            String(price.sizeId) === String(row.sizeId),
          );

          if (existingPriceIndex >= 0) {
            menuItem.prices[existingPriceIndex] = {
              ...menuItem.prices[existingPriceIndex].toObject(),
              ...priceRow,
            };
          } else {
            menuItem.prices.push(priceRow);
          }

          menuItem.updatedBy = req.user.id;
          await menuItem.save();
          results.created++;
        } else {
          menuItem = new MenuItem({
            name: row.name,
            description: row.description || "",
            category: row.category,
            station: categoryDoc.kitchenStation,
            nutritionalInfo: {
              calories: Number(row.calories) || 0,
              protein: Number(row.protein) || 0,
              carbs: Number(row.carbs) || 0,
              fat: Number(row.fat) || 0,
            },
            displayOrder: Number(row.displayOrder) || 0,
            spiceLevel: Number(row.spiceLevel) || 0,
            preparationTime: Number(row.preparationTime) || 15,
            isVegetarian: toBool(row.isVegetarian),
            isNonVegetarian: toBool(row.isNonVegetarian),
            isVegan: toBool(row.isVegan),
            isGlutenFree: toBool(row.isGlutenFree),
            isAvailable: toBool(row.isAvailable),
            isActive:
              row.isActive === undefined || row.isActive === ""
                ? true
                : toBool(row.isActive),
            ingredients,
            allergens,
            tags,
            seasonal,
            prices: [priceRow],
            createdBy: req.user.id,
            updatedBy: req.user.id,
          });

          await menuItem.save();
          results.created++;
        }
      } catch (err) {
        results.failed++;
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || "field";
          const value = err.keyValue?.[field] || row.name;

          results.errors.push(
            `Menu item with ${field} '${value}' already exists`,
          );
        } else {
          results.errors.push(`Failed to import '${row.name}': ${err.message}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk Import Completed",
      data: results,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      success: false,
      message: "Import failed",
      error: error.message,
    });
  }
};
