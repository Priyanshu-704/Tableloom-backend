const { logger } = require("./../utils/logger.js");
const KitchenStation = require("../models/KitchenStation");
const Category = require("../models/Category");

exports.getKitchenStations = async (req, res) => {
  try {
    const stations = await KitchenStation.find()
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    const stationsWithCategories = await Promise.all(
      stations.map(async (station) => {
        const categories = await Category.find({ kitchenStation: station._id })
          .select("name description")
          .lean();
        return {
          ...station,
          assignedCategories: categories,
          categoryCount: categories.length,
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: stations.length,
      data: stationsWithCategories,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get kitchen stations",
      error: error.message,
    });
  }
};

exports.getKitchenStation = async (req, res) => {
  try {
    const station = await KitchenStation.findById(req.params.id).lean();

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Kitchen station not found",
      });
    }

    const categories = await Category.find({ kitchenStation: station._id })
      .select("name description isActive")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...station,
        assignedCategories: categories,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get kitchen station",
      error: error.message,
    });
  }
};

exports.createKitchenStation = async (req, res) => {
  try {
    const {
      name,
      stationType,
      capacity,
      colorCode,
      displayOrder,
      status,
      preparationTimes,
    } = req.body;

    const existingStation = await KitchenStation.findOne({ name });
    if (existingStation) {
      return res.status(400).json({
        success: false,
        message: "Kitchen station with this name already exists",
      });
    }

    const stationData = {
      name,
      stationType,
      capacity: capacity || 1,
      colorCode: colorCode || "#4CAF50",
      displayOrder: displayOrder || 0,
      status: status || "active",
      currentLoad: 0,
    };

    if (preparationTimes) {
      stationData.preparationTimes = {
        min: preparationTimes.min || 5,
        max: preparationTimes.max || 30,
        average: preparationTimes.average || 15,
      };
    }

    const station = await KitchenStation.create(stationData);

    res.status(201).json({
      success: true,
      message: "Kitchen station created successfully",
      data: station,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create kitchen station",
      error: error.message,
    });
  }
};

exports.updateKitchenStation = async (req, res) => {
  try {
    const { name, stationType, capacity, colorCode, displayOrder, status } =
      req.body;

    const station = await KitchenStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Kitchen station not found",
      });
    }

    if (name && name !== station.name) {
      const existingStation = await KitchenStation.findOne({ name });
      if (existingStation) {
        return res.status(400).json({
          success: false,
          message: "Kitchen station with this name already exists",
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (stationType) updateData.stationType = stationType;
    if (capacity) updateData.capacity = capacity;
    if (colorCode) updateData.colorCode = colorCode;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (status) updateData.status = status;

    const updatedStation = await KitchenStation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Kitchen station updated successfully",
      data: updatedStation,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update kitchen station",
      error: error.message,
    });
  }
};

exports.deleteKitchenStation = async (req, res) => {
  try {
    const station = await KitchenStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Kitchen station not found",
      });
    }

    const assignedCategories = await Category.countDocuments({
      kitchenStation: station._id,
    });

    if (assignedCategories > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete kitchen station because categories are assigned to it. Please reassign categories first.",
        assignedCategories,
      });
    }

    await KitchenStation.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Kitchen station deleted successfully",
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete kitchen station",
      error: error.message,
    });
  }
};

exports.assignCategoryToStation = async (req, res) => {
  try {
    const { id: stationId, categoryId } = req.params;

    const station = await KitchenStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Kitchen station not found",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.kitchenStation = stationId;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category "${category.name}" assigned to "${station.name}" station`,
      data: {
        station: {
          _id: station._id,
          name: station.name,
          stationType: station.stationType,
        },
        category: {
          _id: category._id,
          name: category.name,
        },
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to assign category to station",
      error: error.message,
    });
  }
};

exports.removeCategoryFromStation = async (req, res) => {
  try {
    const { id: stationId, categoryId } = req.params;

    const station = await KitchenStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Kitchen station not found",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (
      !category.kitchenStation ||
      category.kitchenStation.toString() !== stationId
    ) {
      return res.status(400).json({
        success: false,
        message: "This category is not assigned to this station",
      });
    }

    category.kitchenStation = null;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category "${category.name}" removed from "${station.name}" station`,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to remove category from station",
      error: error.message,
    });
  }
};

exports.getStationDashboard = async (req, res) => {
  try {
    const station = await KitchenStation.findById(req.params.id).lean();
    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Kitchen station not found",
      });
    }

    // Get assigned categories
    const categories = await Category.find({ kitchenStation: station._id })
      .select("name _id")
      .lean();

    const categoryIds = categories.map((cat) => cat._id);
    const menuItems = await require("../models/MenuItem")
      .find({ category: { $in: categoryIds } })
      .select("name category preparationTime")
      .populate("category", "name")
      .lean();

    const kitchenOrders = await require("../models/KitchenOrder")
      .find({
        "items.station": station._id,
        "items.status": { $nin: ["ready", "served"] },
        overallStatus: { $ne: "completed" },
      })
      .populate("items.station", "name")
      .populate("items.assignedTo", "name")
      .lean();

    const currentOrders = kitchenOrders.map((order) => {
      const stationItems = order.items.filter(
        (item) =>
          item.station &&
          item.station._id.toString() === station._id.toString(),
      );
      return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        items: stationItems,
        createdAt: order.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        station,
        categories,

        loadMetrics: {
          current: station.currentLoad,
          capacity: station.capacity,
          loadPercentage: Math.round(
            (station.currentLoad / station.capacity) * 100,
          ),
        },
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get station dashboard",
      error: error.message,
    });
  }
};
