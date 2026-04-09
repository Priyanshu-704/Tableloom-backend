const csvParser = require("csv-parser");
const { Readable } = require("stream");
const InventoryItem = require("../models/InventoryItem");
const MenuItem = require("../models/MenuItem");
const notificationManager = require("../utils/notificationManager");

const INVENTORY_UNITS = ["kg", "pieces", "gram", "milligram", "liter", "ton"];
const INVENTORY_UNIT_ALIASES = {
  pcs: "pieces",
  piece: "pieces",
  pieces: "pieces",
  kg: "kg",
  kgs: "kg",
  gram: "gram",
  grams: "gram",
  g: "gram",
  gm: "gram",
  milligram: "milligram",
  milligrams: "milligram",
  mg: "milligram",
  liter: "liter",
  litres: "liter",
  litre: "liter",
  l: "liter",
  ton: "ton",
  tons: "ton",
  tonne: "ton",
  tonnes: "ton",
};

const normalizeInventoryUnit = (value = "pieces") => {
  const normalized = String(value || "pieces").trim().toLowerCase();
  return INVENTORY_UNIT_ALIASES[normalized] || normalized;
};

const isSupportedInventoryUnit = (value = "") =>
  INVENTORY_UNITS.includes(normalizeInventoryUnit(value));

const parseCsvBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer.toString("utf8"))
      .pipe(csvParser())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

const readCsvField = (row = {}, keys = []) => {
  const normalizedRow = Object.entries(row || {}).reduce((accumulator, [key, value]) => {
    accumulator[String(key || "").trim().toLowerCase()] = value;
    return accumulator;
  }, {});

  for (const key of keys) {
    const value = normalizedRow[String(key || "").trim().toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
};

const getRelationsForInventory = (inventoryItem) => {
  const relatedMenuItems = Array.isArray(inventoryItem?.relatedMenuItems)
    ? inventoryItem.relatedMenuItems
    : [];

  if (relatedMenuItems.length > 0) {
    return relatedMenuItems
      .filter((relation) => relation?.menuItem)
      .map((relation) => ({
        menuItem: relation.menuItem,
        quantityRequired: Math.max(Number(relation.quantityRequired || 0), 0),
      }));
  }

  if (inventoryItem?.menuItem) {
    return [
      {
        menuItem: inventoryItem.menuItem,
        quantityRequired: 1,
      },
    ];
  }

  return [];
};

const buildStatus = (item) => {
  if (!item?.isActive) {
    return "inactive";
  }

  if (Number(item.currentStock || 0) <= 0) {
    return "out_of_stock";
  }

  if (Number(item.currentStock || 0) <= Number(item.minimumStock || 0)) {
    return "low_stock";
  }

  return "in_stock";
};

const serializeInventory = (item) => {
  const inventory = item.toObject ? item.toObject() : item;
  const normalizedUnit = normalizeInventoryUnit(inventory.unit);
  return {
    ...inventory,
    unit: normalizedUnit,
    stockStatus: buildStatus(inventory),
    linkedMenuItemsCount: getRelationsForInventory(inventory).length,
  };
};

const notifyInventoryRequirement = async (inventoryItem, previousStatus = null, actorId = null) => {
  const nextStatus = buildStatus(inventoryItem);
  if (!["low_stock", "out_of_stock"].includes(nextStatus) || previousStatus === nextStatus) {
    return;
  }

  await notificationManager.createNotification({
    title: nextStatus === "out_of_stock" ? "Inventory Out Of Stock" : "Inventory Running Low",
    message:
      nextStatus === "out_of_stock"
        ? `${inventoryItem.ingredientName} is out of stock and needs replenishment.`
        : `${inventoryItem.ingredientName} is below minimum stock level.`,
    type: "inventory_low",
    priority: nextStatus === "out_of_stock" ? "high" : "medium",
    recipientType: "role",
    roles: ["admin", "manager"],
    sender: actorId || null,
    senderType: actorId ? "user" : "system",
    relatedTo: inventoryItem._id,
    relatedModel: "Inventory",
    actionRequired: false,
    actions: [
      {
        label: "View Inventory",
        type: "link",
        action: "/dashboard/inventory",
        color: "warning",
      },
    ],
    metadata: {
      inventoryItemId: inventoryItem._id,
      ingredientName: inventoryItem.ingredientName,
      currentStock: Number(inventoryItem.currentStock || 0),
      minimumStock: Number(inventoryItem.minimumStock || 0),
      reorderQuantity: Number(inventoryItem.reorderQuantity || 0),
      stockStatus: nextStatus,
    },
  });
};

const syncMenuAvailability = async (menuItemIds = [], updatedBy = null) => {
  const normalizedMenuItemIds = [...new Set(
    menuItemIds
      .map((menuItemId) => String(menuItemId || "").trim())
      .filter(Boolean),
  )];

  if (!normalizedMenuItemIds.length) {
    return;
  }

  await Promise.all(
    normalizedMenuItemIds.map(async (menuItemId) => {
      const inventoryItems = await InventoryItem.find({
        $or: [
          { "relatedMenuItems.menuItem": menuItemId },
          { menuItem: menuItemId },
        ],
      }).lean();

      const linkedIngredients = inventoryItems
        .map((inventoryItem) => {
          const relation = getRelationsForInventory(inventoryItem).find(
            (entry) => String(entry.menuItem) === String(menuItemId),
          );

          if (!relation) {
            return null;
          }

          return {
            isActive: Boolean(inventoryItem.isActive),
            currentStock: Number(inventoryItem.currentStock || 0),
            quantityRequired: Math.max(Number(relation.quantityRequired || 0), 0),
          };
        })
        .filter(Boolean);

      const shouldBeAvailable =
        linkedIngredients.length === 0 ||
        linkedIngredients.every(
          (ingredient) =>
            ingredient.isActive &&
            ingredient.currentStock >= ingredient.quantityRequired,
        );

      await MenuItem.findByIdAndUpdate(menuItemId, {
        isAvailable: shouldBeAvailable,
        updatedAt: new Date(),
        updatedBy,
      });
    }),
  );
};

const validateAndNormalizeRelatedMenuItems = async (relatedMenuItems = []) => {
  const normalizedRelations = (Array.isArray(relatedMenuItems) ? relatedMenuItems : [])
    .filter((relation) => relation?.menuItem)
    .map((relation) => ({
      menuItem: String(relation.menuItem).trim(),
      quantityRequired: Math.max(Number(relation.quantityRequired || 0), 0),
    }));

  const uniqueMenuItemIds = [...new Set(
    normalizedRelations.map((relation) => relation.menuItem),
  )];

  if (!uniqueMenuItemIds.length) {
    return [];
  }

  const existingMenuItems = await MenuItem.find({
    _id: { $in: uniqueMenuItemIds },
  }).select("_id");

  if (existingMenuItems.length !== uniqueMenuItemIds.length) {
    throw new Error("One or more related menu items were not found");
  }

  return normalizedRelations;
};

exports.getInventoryItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status = "all",
      category,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    const inventoryQuery = {};

    if (search) {
      inventoryQuery.$or = [
        { ingredientName: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "inactive") {
      inventoryQuery.isActive = false;
    } else if (status !== "all") {
      inventoryQuery.isActive = true;

      if (status === "out_of_stock") {
        inventoryQuery.currentStock = { $lte: 0 };
      } else if (status === "low_stock") {
        inventoryQuery.$expr = {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minimumStock"] },
          ],
        };
      } else if (status === "in_stock") {
        inventoryQuery.$expr = {
          $gt: ["$currentStock", "$minimumStock"],
        };
      }
    }

    if (category) {
      const matchedMenuItems = await MenuItem.find({ category }).select("_id").lean();
      const menuItemIds = matchedMenuItems.map((item) => item._id);

      inventoryQuery.$and = [
        ...(Array.isArray(inventoryQuery.$and) ? inventoryQuery.$and : []),
        {
          $or: [
            { "relatedMenuItems.menuItem": { $in: menuItemIds } },
            { menuItem: { $in: menuItemIds } },
          ],
        },
      ];
    }

    const [items, total, allItems] = await Promise.all([
      InventoryItem.find(inventoryQuery)
        .populate({
          path: "relatedMenuItems.menuItem",
          select: "name category isAvailable",
          populate: { path: "category", select: "name" },
        })
        .populate({
          path: "menuItem",
          select: "name category isAvailable",
          populate: { path: "category", select: "name" },
        })
        .populate("createdBy", "name")
        .populate("updatedBy", "name")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      InventoryItem.countDocuments(inventoryQuery),
      InventoryItem.find({})
        .select("currentStock minimumStock isActive")
        .lean(),
    ]);

    const stats = allItems.reduce(
      (accumulator, item) => {
        accumulator.totalItems += 1;

        const statusKey = buildStatus(item);
        if (statusKey === "in_stock") {
          accumulator.inStock += 1;
        } else if (statusKey === "low_stock") {
          accumulator.lowStock += 1;
        } else if (statusKey === "out_of_stock") {
          accumulator.outOfStock += 1;
        } else {
          accumulator.inactive += 1;
        }

        accumulator.totalUnits += Number(item.currentStock || 0);
        return accumulator;
      },
      {
        totalItems: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        inactive: 0,
        totalUnits: 0,
      },
    );

    res.status(200).json({
      success: true,
      data: items.map(serializeInventory),
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        total,
      },
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory items",
      error: error.message,
    });
  }
};

exports.createInventoryItem = async (req, res) => {
  try {
    const {
      ingredientName,
      sku,
      unit,
      currentStock = 0,
      minimumStock = 5,
      reorderQuantity = 10,
      notes,
      isActive = true,
      relatedMenuItems = [],
    } = req.body;

    const normalizedRelations = await validateAndNormalizeRelatedMenuItems(
      relatedMenuItems,
    );
    const normalizedUnit = normalizeInventoryUnit(unit);

    if (!isSupportedInventoryUnit(normalizedUnit)) {
      return res.status(400).json({
        success: false,
        message: `Unit must be one of: ${INVENTORY_UNITS.join(", ")}`,
      });
    }

    const inventoryItem = await InventoryItem.create({
      ingredientName,
      sku,
      unit: normalizedUnit,
      currentStock: Number(currentStock || 0),
      minimumStock: Number(minimumStock || 0),
      reorderQuantity: Number(reorderQuantity || 0),
      notes,
      isActive: isActive === true || isActive === "true",
      relatedMenuItems: normalizedRelations,
      lastRestockedAt: Number(currentStock || 0) > 0 ? new Date() : null,
      lastAdjustedAt: new Date(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await syncMenuAvailability(
      normalizedRelations.map((relation) => relation.menuItem),
      req.user._id,
    );
    await notifyInventoryRequirement(inventoryItem, null, req.user._id);

    res.status(201).json({
      success: true,
      message: "Ingredient inventory created successfully",
      data: serializeInventory(await inventoryItem.populate({
        path: "relatedMenuItems.menuItem",
        select: "name category isAvailable",
        populate: { path: "category", select: "name" },
      })),
    });
  } catch (error) {
    const duplicateMessage =
      error.code === 11000
        ? "Ingredient inventory already exists for this ingredient or SKU"
        : error.message;

    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: duplicateMessage,
      error: error.message,
    });
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const inventoryItem = await InventoryItem.findById(req.params.id);

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    const previousStatus = buildStatus(inventoryItem);

    const {
      ingredientName,
      sku,
      unit,
      currentStock,
      minimumStock,
      reorderQuantity,
      notes,
      isActive,
      relatedMenuItems,
    } = req.body;

    const previousMenuItemIds = getRelationsForInventory(inventoryItem).map(
      (relation) => relation.menuItem,
    );
    const normalizedUnit = unit !== undefined ? normalizeInventoryUnit(unit) : normalizeInventoryUnit(inventoryItem.unit);

    if (!isSupportedInventoryUnit(normalizedUnit)) {
      return res.status(400).json({
        success: false,
        message: `Unit must be one of: ${INVENTORY_UNITS.join(", ")}`,
      });
    }

    if (ingredientName !== undefined) inventoryItem.ingredientName = ingredientName;
    if (sku !== undefined) inventoryItem.sku = sku;
    inventoryItem.unit = normalizedUnit;
    if (currentStock !== undefined) {
      inventoryItem.currentStock = Math.max(Number(currentStock || 0), 0);
      if (inventoryItem.currentStock > 0) {
        inventoryItem.lastRestockedAt = new Date();
      }
    }
    if (minimumStock !== undefined) {
      inventoryItem.minimumStock = Math.max(Number(minimumStock || 0), 0);
    }
    if (reorderQuantity !== undefined) {
      inventoryItem.reorderQuantity = Math.max(Number(reorderQuantity || 0), 0);
    }
    if (notes !== undefined) inventoryItem.notes = notes;
    if (isActive !== undefined) {
      inventoryItem.isActive = isActive === true || isActive === "true";
    }
    if (relatedMenuItems !== undefined) {
      inventoryItem.relatedMenuItems = await validateAndNormalizeRelatedMenuItems(
        relatedMenuItems,
      );
      inventoryItem.menuItem = undefined;
    }

    inventoryItem.lastAdjustedAt = new Date();
    inventoryItem.updatedBy = req.user._id;

    await inventoryItem.save();
    await syncMenuAvailability(
      [
        ...previousMenuItemIds,
        ...getRelationsForInventory(inventoryItem).map((relation) => relation.menuItem),
      ],
      req.user._id,
    );
    await notifyInventoryRequirement(inventoryItem, previousStatus, req.user._id);

    const populated = await InventoryItem.findById(inventoryItem._id).populate({
      path: "relatedMenuItems.menuItem",
      select: "name category isAvailable",
      populate: { path: "category", select: "name" },
    });

    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: serializeInventory(populated),
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message:
        error.code === 11000
          ? "Inventory ingredient or SKU must be unique"
          : "Failed to update ingredient inventory",
      error: error.message,
    });
  }
};

exports.adjustInventoryStock = async (req, res) => {
  try {
    const { quantity, adjustmentType = "add", notes = "" } = req.body;
    const amount = Number(quantity || 0);

    if (!amount || amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Adjustment quantity must be greater than zero",
      });
    }

    const inventoryItem = await InventoryItem.findById(req.params.id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    const previousStatus = buildStatus(inventoryItem);
    inventoryItem.unit = normalizeInventoryUnit(inventoryItem.unit);

    const signedQuantity = adjustmentType === "subtract" ? -amount : amount;
    inventoryItem.currentStock = Math.max(
      Number(inventoryItem.currentStock || 0) + signedQuantity,
      0,
    );
    inventoryItem.lastAdjustedAt = new Date();
    inventoryItem.updatedBy = req.user._id;
    inventoryItem.notes = notes || inventoryItem.notes;

    if (signedQuantity > 0) {
      inventoryItem.lastRestockedAt = new Date();
    }

    await inventoryItem.save();
    await syncMenuAvailability(
      getRelationsForInventory(inventoryItem).map((relation) => relation.menuItem),
      req.user._id,
    );
    await notifyInventoryRequirement(inventoryItem, previousStatus, req.user._id);

    const populated = await InventoryItem.findById(inventoryItem._id).populate({
      path: "relatedMenuItems.menuItem",
      select: "name category isAvailable",
      populate: { path: "category", select: "name" },
    });

    res.status(200).json({
      success: true,
      message: "Inventory stock adjusted successfully",
      data: serializeInventory(populated),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to adjust stock",
      error: error.message,
    });
  }
};

exports.bulkUploadInventory = async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "CSV file is required",
    });
  }

  try {
    const rows = await parseCsvBuffer(req.file.buffer);
    const stats = {
      total: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
    const affectedMenuItemIds = new Set();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const lineNumber = index + 2;

      try {
        const ingredientName = String(
          readCsvField(row, ["ingredientName", "ingredient", "name"])
        ).trim();
        const sku = String(readCsvField(row, ["sku", "stockCode"])).trim().toUpperCase();
        const unit = normalizeInventoryUnit(readCsvField(row, ["unit"]));
        const currentStock = Math.max(
          Number(readCsvField(row, ["currentStock", "current_stock", "stock"]) || 0),
          0
        );
        const minimumStock = Math.max(
          Number(readCsvField(row, ["minimumStock", "minimum_stock", "minThreshold"]) || 0),
          0
        );
        const reorderQuantity = Math.max(
          Number(readCsvField(row, ["reorderQuantity", "reorder_quantity", "reorder"]) || 0),
          0
        );
        const notes = String(readCsvField(row, ["notes", "note"])).trim();
        const isActiveValue = String(readCsvField(row, ["isActive", "active"])).trim().toLowerCase();
        const isActive =
          isActiveValue === ""
            ? true
            : !["false", "0", "no", "inactive"].includes(isActiveValue);

        if (!ingredientName) {
          throw new Error("Ingredient name is required");
        }

        if (!isSupportedInventoryUnit(unit)) {
          throw new Error(`Unsupported unit "${unit}"`);
        }

        const existingItem = await InventoryItem.findOne(
          sku
            ? {
                $or: [{ sku }, { ingredientName }],
              }
            : { ingredientName }
        );

        if (existingItem) {
          existingItem.ingredientName = ingredientName;
          existingItem.sku = sku || undefined;
          existingItem.unit = unit;
          existingItem.currentStock = currentStock;
          existingItem.minimumStock = minimumStock;
          existingItem.reorderQuantity = reorderQuantity;
          existingItem.notes = notes || existingItem.notes;
          existingItem.isActive = isActive;
          existingItem.lastAdjustedAt = new Date();
          existingItem.updatedBy = req.user._id;
          if (currentStock > 0) {
            existingItem.lastRestockedAt = new Date();
          }
          await existingItem.save();
          getRelationsForInventory(existingItem).forEach((relation) =>
            affectedMenuItemIds.add(String(relation.menuItem))
          );
          stats.updated += 1;
        } else {
          const createdItem = await InventoryItem.create({
            ingredientName,
            sku: sku || undefined,
            unit,
            currentStock,
            minimumStock,
            reorderQuantity,
            notes,
            isActive,
            relatedMenuItems: [],
            lastRestockedAt: currentStock > 0 ? new Date() : null,
            lastAdjustedAt: new Date(),
            createdBy: req.user._id,
            updatedBy: req.user._id,
          });
          getRelationsForInventory(createdItem).forEach((relation) =>
            affectedMenuItemIds.add(String(relation.menuItem))
          );
          stats.created += 1;
        }
      } catch (error) {
        stats.failed += 1;
        stats.errors.push({
          line: lineNumber,
          message: error.message,
        });
      }
    }

    if (affectedMenuItemIds.size > 0) {
      await syncMenuAvailability(Array.from(affectedMenuItemIds), req.user._id);
    }

    return res.status(200).json({
      success: true,
      message: "Inventory bulk upload completed",
      data: stats,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to process inventory CSV upload",
      error: error.message,
    });
  }
};

exports.deleteInventoryItem = async (req, res) => {
  try {
    const inventoryItem = await InventoryItem.findById(req.params.id);

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    const previousMenuItemIds = getRelationsForInventory(inventoryItem).map(
      (relation) => relation.menuItem,
    );

    await InventoryItem.findByIdAndDelete(req.params.id);
    await syncMenuAvailability(previousMenuItemIds, req.user._id);

    res.status(200).json({
      success: true,
      message: "Ingredient inventory deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete inventory item",
      error: error.message,
    });
  }
};
