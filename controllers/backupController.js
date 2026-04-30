const { logger } = require("./../utils/logger.js");
const mongoose = require("mongoose");
const { sendError, sendSuccess } = require("../utils/httpResponse");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");
const UserRole = require("../models/UserRole");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const Size = require("../models/Size");
const Table = require("../models/Table");
const TableHistory = require("../models/TableHistory");
const Customer = require("../models/Customer");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Bill = require("../models/Bill");
const Feedback = require("../models/Feedback");
const WaiterCall = require("../models/WaiterCall");
const KitchenOrder = require("../models/KitchenOrder");
const KitchenStation = require("../models/KitchenStation");
const InventoryItem = require("../models/InventoryItem");
const Coupon = require("../models/Coupon");
const AppSetting = require("../models/AppSetting");
const Notification = require("../models/Notification");
const PushNotificationToken = require("../models/PushNotificationToken");
const SupportRequest = require("../models/SupportRequest");
const PriceHistory = require("../models/PriceHistory");

const SENSITIVE_USER_FIELDS = new Set([
  "password",
  "refreshToken",
  "refreshTokenExpires",
  "passwordResetToken",
  "passwordResetExpires",
]);

const TENANT_COLLECTIONS = Object.freeze([
  {
    key: "tenants",
    model: Tenant,
    load: async ({ tenantObjectId }) => {
      const tenant = await Tenant.findById(tenantObjectId).lean();
      return tenant ? [tenant] : [];
    },
  },
  {
    key: "permissions",
    model: Permission,
    load: async () => Permission.find({}).lean(),
  },
  {
    key: "roles",
    model: Role,
    load: async ({ tenantObjectId }) =>
      Role.find({
        $or: [
          {
            tenantId: tenantObjectId,
          },
          {
            tenantId: null,
          },
        ],
      }).lean(),
  },
  {
    key: "users",
    model: User,
    load: async ({ tenantObjectId, exportMode }) => {
      const query = User.find({
        tenantId: tenantObjectId,
      });
      if (exportMode) {
        query.select(
          "-password -refreshToken -refreshTokenExpires -passwordResetToken -passwordResetExpires",
        );
      }
      return query.lean();
    },
  },
  {
    key: "categories",
    model: Category,
  },
  {
    key: "menuItems",
    model: MenuItem,
  },
  {
    key: "sizes",
    model: Size,
  },
  {
    key: "tables",
    model: Table,
  },
  {
    key: "tableHistories",
    model: TableHistory,
  },
  {
    key: "customers",
    model: Customer,
  },
  {
    key: "carts",
    model: Cart,
  },
  {
    key: "orders",
    model: Order,
  },
  {
    key: "bills",
    model: Bill,
  },
  {
    key: "feedback",
    model: Feedback,
  },
  {
    key: "waiterCalls",
    model: WaiterCall,
  },
  {
    key: "kitchenOrders",
    model: KitchenOrder,
  },
  {
    key: "kitchenStations",
    model: KitchenStation,
  },
  {
    key: "inventoryItems",
    model: InventoryItem,
  },
  {
    key: "coupons",
    model: Coupon,
  },
  {
    key: "settings",
    model: AppSetting,
  },
  {
    key: "notifications",
    model: Notification,
  },
  {
    key: "pushNotificationTokens",
    model: PushNotificationToken,
  },
  {
    key: "supportRequests",
    model: SupportRequest,
  },
  {
    key: "priceHistories",
    model: PriceHistory,
  },
]);

const buildAccessScope = (req) => {
  const isSuperAdmin = String(req.user?.role || "").toLowerCase() === "super_admin";
  if (isSuperAdmin) {
    return {
      accessScope: "full_database",
      tenantId: req.tenant?._id || null,
      tenantName: req.tenant?.name || null,
    };
  }
  if (!req.tenant?._id) {
    return null;
  }
  return {
    accessScope: "tenant_only",
    tenantId: req.tenant._id,
    tenantName: req.tenant?.name || null,
  };
};

const sanitizeUserDocument = (user = {}) => {
  const sanitizedUser = {
    ...(user || {}),
  };
  Array.from(SENSITIVE_USER_FIELDS).forEach((field) => {
    delete sanitizedUser[field];
  });
  return sanitizedUser;
};

const getCollectionName = (model) => model?.collection?.collectionName || "";

const loadFullDatabaseCollections = async () => {
  const collections = await mongoose.connection.db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const entries = await Promise.all(
    collections
      .filter((collection) => !String(collection?.name || "").startsWith("system."))
      .map(async (collection) => {
        const documents = await mongoose.connection.db
          .collection(collection.name)
          .find({})
          .toArray();
        return [
          collection.name,
          {
            collection: collection.name,
            documents,
          },
        ];
      }),
  );
  return Object.fromEntries(entries);
};

const loadTenantDatabaseCollections = async ({ tenantId, exportMode = false }) => {
  const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));
  const context = {
    tenantId: String(tenantId),
    tenantObjectId,
    exportMode,
  };
  const collections = {};

  for (const entry of TENANT_COLLECTIONS) {
    if (entry.load) {
      collections[entry.key] = {
        collection: getCollectionName(entry.model),
        documents: await entry.load(context),
      };
      continue;
    }
    collections[entry.key] = {
      collection: getCollectionName(entry.model),
      documents: await entry.model.find({
        tenantId: tenantObjectId,
      }).lean(),
    };
  }

  const includedRoleIds = (collections.roles?.documents || []).map((role) => role._id);
  const includedUserIds = (collections.users?.documents || []).map((user) => user._id);

  collections.rolePermissions = {
    collection: getCollectionName(RolePermission),
    documents: await RolePermission.find({
      roleId: {
        $in: includedRoleIds,
      },
    }).lean(),
  };
  collections.userRoles = {
    collection: getCollectionName(UserRole),
    documents: await UserRole.find({
      userId: {
        $in: includedUserIds,
      },
    }).lean(),
  };

  if (exportMode) {
    collections.users.documents = (collections.users.documents || []).map(
      sanitizeUserDocument,
    );
  }

  return collections;
};

const loadBackupCollections = async ({ accessScope, tenantId, exportMode }) => {
  if (accessScope === "full_database") {
    return loadFullDatabaseCollections();
  }
  return loadTenantDatabaseCollections({
    tenantId,
    exportMode,
  });
};

const cloneCollectionsToTarget = async ({
  targetConnection,
  collections,
  mode,
}) => {
  const summary = {};
  for (const [key, entry] of Object.entries(collections || {})) {
    const collectionName = entry?.collection || key;
    const documents = Array.isArray(entry?.documents) ? entry.documents : [];
    const targetCollection = targetConnection.db.collection(collectionName);
    if (mode !== "append") {
      await targetCollection.deleteMany({});
      if (documents.length > 0) {
        await targetCollection.insertMany(documents, {
          ordered: false,
        });
      }
    } else if (documents.length > 0) {
      await targetCollection.bulkWrite(
        documents.map((document) => ({
          replaceOne: {
            filter: {
              _id: document._id,
            },
            replacement: document,
            upsert: true,
          },
        })),
        {
          ordered: false,
        },
      );
    }
    summary[key] = {
      collection: collectionName,
      count: documents.length,
    };
  }
  return summary;
};

exports.exportBackup = async (req, res) => {
  try {
    const scope = buildAccessScope(req);
    if (!scope) {
      return sendError(
        res,
        400,
        "Restaurant context is required for tenant backup export",
      );
    }
    const collections = await loadBackupCollections({
      accessScope: scope.accessScope,
      tenantId: scope.tenantId,
      exportMode: true,
    });
    const backupPayload = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: req.user?._id || null,
        email: req.user?.email || null,
        role: req.user?.role || null,
      },
      scope: {
        accessScope: scope.accessScope,
        tenantId: scope.accessScope === "tenant_only" ? scope.tenantId : null,
        tenantName:
          scope.accessScope === "tenant_only" ? scope.tenantName : null,
      },
      collections: Object.fromEntries(
        Object.entries(collections).map(([key, entry]) => [key, entry.documents]),
      ),
    };
    const filenamePrefix =
      scope.accessScope === "full_database"
        ? "tableloom-full-db-backup"
        : `tableloom-tenant-backup-${String(scope.tenantId || "tenant")}`;
    const filename = `${filenamePrefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Backup-Scope", scope.accessScope);
    return res.status(200).send(JSON.stringify(backupPayload, null, 2));
  } catch (error) {
    logger.error("Backup export failed:", error);
    return sendError(res, 500, "Failed to export backup", error);
  }
};

exports.cloneBackupToTarget = async (req, res) => {
  let targetConnection = null;
  try {
    const scope = buildAccessScope(req);
    if (!scope) {
      return sendError(
        res,
        400,
        "Restaurant context is required for tenant backup cloning",
      );
    }
    const {
      targetUri = "",
      targetDbName = "",
      mode = "replace",
    } = req.body || {};
    if (!targetUri.trim()) {
      return sendError(res, 400, "Target MongoDB URI is required");
    }
    if (!["replace", "append"].includes(String(mode))) {
      return sendError(
        res,
        400,
        "Clone mode must be either replace or append",
      );
    }

    const collections = await loadBackupCollections({
      accessScope: scope.accessScope,
      tenantId: scope.tenantId,
      exportMode: false,
    });

    targetConnection = await mongoose
      .createConnection(targetUri.trim(), {
        dbName: targetDbName.trim() || undefined,
      })
      .asPromise();

    const summary = await cloneCollectionsToTarget({
      targetConnection,
      collections,
      mode,
    });

    return sendSuccess(
      res,
      200,
      "Backup cloned successfully to target database",
      {
        targetDbName: targetConnection.name,
        mode: String(mode),
        accessScope: scope.accessScope,
        tenantId: scope.accessScope === "tenant_only" ? scope.tenantId : null,
        tenantName:
          scope.accessScope === "tenant_only" ? scope.tenantName : null,
        collections: summary,
      },
    );
  } catch (error) {
    logger.error("Backup clone failed:", error);
    return sendError(
      res,
      500,
      "Failed to clone backup to target database",
      error,
    );
  } finally {
    if (targetConnection) {
      await targetConnection.close().catch(() => {});
    }
  }
};
