const { logger } = require("./../utils/logger.js");
const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a menu item name"],
    trim: true,
    maxlength: [100, "Menu item name cannot exceed 100 characters"],
  },
  description: {
    type: String,
    maxlength: [500, "Description cannot exceed 500 characters"],
  },
  prices: [
    {
      sizeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Size",
        required: true,
      },
      price: {
        type: Number,
        required: [true, "Please add a price for this size"],
        min: [0, "Price cannot be negative"],
      },
      costPrice: {
        type: Number,
        min: [0, "Cost price cannot be negative"],
      },
    },
  ],
  image: {
    type: String,
    default: null,
  },
  imagePublicId: {
    type: String,
    default: null,
  },
  imageProvider: {
    type: String,
    default: null,
  },
  category: {
    type: mongoose.Schema.ObjectId,
    ref: "Category",
    required: true,
  },
  station: {
    type: mongoose.Schema.ObjectId,
    ref: "KitchenStation",
    required: true,
  },
  ingredients: [
    {
      type: String,
      trim: true, 
    },
  ],
  allergens: [
    {
      type: String,
      trim: true,
    },
  ],
  spiceLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  preparationTime: {
    type: Number,
    default: 15,
  },
  isVegetarian: {
    type: Boolean,
    default: false,
  },
  isNonVegetarian: {
    type: Boolean,
    default: false,
  },
  isVegan: {
    type: Boolean,
    default: false,
  },
  isGlutenFree: {
    type: Boolean,
    default: false,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  nutritionalInfo: {
    calories: { type: Number, min: 0 },
    protein: { type: Number, min: 0 },
    carbs: { type: Number, min: 0 },
    fat: { type: Number, min: 0 },
  },
  orderCount: {
    type: Number,
    default: 0,
  },
  lastOrdered: {
    type: Date,
  },
  seasonal: {
    isSeasonal: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    seasonName: { type: String },
  },
  discount: {
    isActive: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
});

// Middleware to auto-update station from category
menuItemSchema.pre("save", async function () {
  this.updatedAt = Date.now();

  // Remove duplicate prices
  if (this.prices?.length > 0) {
    const unique = new Map();
    for (let i = this.prices.length - 1; i >= 0; i--) {
      const sizeId = String(this.prices[i].size);
      if (!unique.has(sizeId)) {
        unique.set(sizeId, this.prices[i]);
      }
    }
    this.prices = [...unique.values()];
  }

  // Auto-update station from category (on create or category change)
  if (this.isNew || this.isModified("category")) {
    await this.updateStationFromCategory();
  }
});

// Middleware for findOneAndUpdate operations
menuItemSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();

  // Update updatedAt timestamp
  this.set({ updatedAt: Date.now() });

  // If category is being updated, update station as well
  if (update.category || update.$set?.category) {
    const categoryId = update.category || update.$set?.category;
    const Category = mongoose.model("Category");

    try {
      const category = await Category.findById(categoryId).select(
        "kitchenStation"
      );
      if (category && category.kitchenStation) {
        this.set({ station: category.kitchenStation });
      } else {
        this.set({ station: null });
      }
    } catch (error) {
      logger.error("Error updating menu item station:", error);
    }
  }
});

// Instance method to update station from category
menuItemSchema.methods.updateStationFromCategory = async function () {
  try {
    const Category = mongoose.model("Category");
    const category = await Category.findById(this.category).select(
      "kitchenStation"
    );

    if (category && category.kitchenStation) {
      this.station = category.kitchenStation;
    } else {
      this.station = null;
    }
  } catch (error) {
    logger.error("Error updating station from category:", error);
    this.station = null;
  }
};

menuItemSchema.methods.getActiveDiscount = function () {
  const discount = this.discount || {};

  if (!discount.isActive || !discount.value) {
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

// Static method to update station for all menu items in a category
menuItemSchema.statics.updateStationForCategory = async function (
  categoryId,
  stationId = null
) {
  try {
    const updateData = stationId ? { station: stationId } : { station: null };

    const result = await this.updateMany({ category: categoryId }, updateData);

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: `Updated station for ${result.modifiedCount} menu items`,
    };
  } catch (error) {
    logger.error("Error updating station for category:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Static method to bulk update stations based on category stations
menuItemSchema.statics.syncAllStationsFromCategories = async function () {
  try {
    const Category = mongoose.model("Category");
    const categories = await Category.find({ kitchenStation: { $ne: null } })
      .select("_id kitchenStation")
      .lean();

    let totalUpdated = 0;

    for (const category of categories) {
      const result = await this.updateMany(
        { category: category._id },
        { station: category.kitchenStation }
      );
      totalUpdated += result.modifiedCount;
    }

    // Clear station for categories without station
    const categoriesWithoutStation = await Category.find({
      kitchenStation: null,
    })
      .select("_id")
      .lean();

    const categoryIdsWithoutStation = categoriesWithoutStation.map(
      (c) => c._id
    );

    const clearResult = await this.updateMany(
      { category: { $in: categoryIdsWithoutStation } },
      { station: null }
    );

    totalUpdated += clearResult.modifiedCount;

    return {
      success: true,
      totalUpdated,
      message: `Synced stations for ${totalUpdated} menu items`,
    };
  } catch (error) {
    logger.error("Error syncing stations from categories:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Create indexes for better performance
menuItemSchema.index({ tenantId: 1, name: 1, category: 1 }, { unique: true });
menuItemSchema.index({ category: 1, isAvailable: 1, isActive: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ tags: 1 });
menuItemSchema.index({ "prices.price": 1 });
menuItemSchema.index({ "seasonal.isSeasonal": 1 });
// ADD NEW INDEXES FOR STATION
menuItemSchema.index({ station: 1, isAvailable: 1 });
menuItemSchema.index({ category: 1, station: 1 });
menuItemSchema.index({ tenantId: 1, name: 1 }, { unique: true });
menuItemSchema.plugin(tenantScoped);

module.exports = mongoose.model("MenuItem", menuItemSchema);
