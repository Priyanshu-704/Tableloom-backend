const { logger } = require("./../utils/logger.js");
const User = require("../models/User");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const Size = require("../models/Size");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Feedback = require("../models/Feedback");
const WaiterCall = require("../models/WaiterCall");
const KitchenStation = require("../models/KitchenStation");
const AppSetting = require("../models/AppSetting");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");
const { sendError, sendSuccess } = require("../utils/httpResponse");

const backupCollections = [
  {
    key: "users",
    model: User,
    exportQuery: () =>
      User.find({})
        .select("-password -refreshToken -passwordResetToken -passwordResetExpires")
        .lean(),
    cloneQuery: () => User.find({}).lean(),
  },
  { key: "categories", model: Category },
  { key: "menuItems", model: MenuItem },
  { key: "sizes", model: Size },
  { key: "tables", model: Table },
  { key: "customers", model: Customer },
  { key: "orders", model: Order },
  { key: "feedback", model: Feedback },
  { key: "waiterCalls", model: WaiterCall },
  { key: "kitchenStations", model: KitchenStation },
  { key: "settings", model: AppSetting },
  { key: "notifications", model: Notification },
];

const loadCollectionDocuments = async (mode = "export") => {
  const entries = await Promise.all(
    backupCollections.map(async ({ key, model, exportQuery, cloneQuery }) => {
      const query =
        mode === "clone"
          ? cloneQuery?.() || model.find({}).lean()
          : exportQuery?.() || model.find({}).lean();

      return [key, await query];
    })
  );

  return Object.fromEntries(entries);
};

exports.exportBackup = async (req, res) => {
  try {
    const backupPayload = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: req.user?._id || null,
        email: req.user?.email || null,
        role: req.user?.role || null,
      },
      collections: await loadCollectionDocuments("export"),
    };

    const filename = `quickbite-backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(JSON.stringify(backupPayload, null, 2));
  } catch (error) {
    logger.error("Backup export failed:", error);
    return sendError(res, 500, "Failed to export backup", error);
  }
};

exports.cloneBackupToTarget = async (req, res) => {
  let targetConnection = null;

  try {
    const {
      targetUri = "",
      targetDbName = "",
      mode = "replace",
    } = req.body || {};

    if (!targetUri.trim()) {
      return sendError(res, 400, "Target MongoDB URI is required");
    }

    targetConnection = await mongoose
      .createConnection(targetUri.trim(), {
        dbName: targetDbName.trim() || undefined,
      })
      .asPromise();

    const collections = await loadCollectionDocuments("clone");
    const summary = {};

    for (const { key, model } of backupCollections) {
      const collectionName = model.collection.collectionName;
      const targetCollection = targetConnection.db.collection(collectionName);
      const documents = collections[key] || [];

      if (mode !== "append") {
        await targetCollection.deleteMany({});
        if (documents.length > 0) {
          await targetCollection.insertMany(documents, { ordered: false });
        }
      } else if (documents.length > 0) {
        await targetCollection.bulkWrite(
          documents.map((document) => ({
            replaceOne: {
              filter: { _id: document._id },
              replacement: document,
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }

      summary[key] = {
        collection: collectionName,
        count: documents.length,
      };
    }

    return sendSuccess(res, 200, "Backup cloned successfully to target database", {
      targetDbName: targetConnection.name,
      mode,
      collections: summary,
    });
  } catch (error) {
    logger.error("Backup clone failed:", error);
    return sendError(res, 500, "Failed to clone backup to target database", error);
  } finally {
    if (targetConnection) {
      await targetConnection.close().catch(() => {});
    }
  }
};
