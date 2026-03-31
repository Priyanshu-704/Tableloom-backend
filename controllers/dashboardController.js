const { logger } = require("./../utils/logger.js");
const Order = require("../models/Order");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const WaiterCall = require("../models/WaiterCall");
const { sendSuccess, sendError } = require("../utils/httpResponse");
const { getOrSetCache } = require("../utils/responseCache");

const DASHBOARD_OVERVIEW_CACHE_TTL_MS = 15 * 1000;

exports.getAdminDashboard = async (req, res) => {
  try {
    const cacheKey = `dashboard:overview:${req.tenantId || "default"}`;
    const data = await getOrSetCache(
      cacheKey,
      DASHBOARD_OVERVIEW_CACHE_TTL_MS,
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          todayOrders,
          todayRevenue,
          occupiedTables,
          reservedTables,
          activeSessions,
          averagePreparation,
          latestOrders,
          latestCalls,
        ] = await Promise.all([
          Order.countDocuments({ orderPlacedAt: { $gte: today } }),
          Order.aggregate([
            {
              $match: {
                orderPlacedAt: { $gte: today },
                paymentStatus: "paid",
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$totalAmount" },
              },
            },
          ]),
          Table.countDocuments({ isActive: true, status: "occupied" }),
          Table.countDocuments({ isActive: true, status: "reserved" }),
          Customer.countDocuments({
            isActive: true,
            sessionStatus: { $in: ["active", "payment_pending"] },
          }),
          Order.aggregate([
            {
              $match: {
                orderPlacedAt: { $gte: today },
                preparationTime: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                average: { $avg: "$preparationTime" },
              },
            },
          ]),
          Order.find({})
            .select("_id orderNumber orderPlacedAt createdAt table")
            .populate("table", "tableNumber tableName")
            .sort({ orderPlacedAt: -1 })
            .limit(5)
            .lean(),
          WaiterCall.find({})
            .select("_id createdAt tableName tableNumber")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        ]);

        const recentActivity = [
          ...latestOrders.map((order) => ({
            id: `order-${order._id}`,
            type: "order",
            timestamp: order.orderPlacedAt || order.createdAt,
            message: `Order #${order.orderNumber} from ${
              order.table?.tableName ||
              `Table ${order.table?.tableNumber || ""}`.trim()
            }`,
          })),
          ...latestCalls.map((call) => ({
            id: `call-${call._id}`,
            type: "waiter",
            timestamp: call.createdAt,
            message: `Waiter call from ${
              call.tableName || `Table ${call.tableNumber}`
            }`,
          })),
        ]
          .sort(
            (left, right) =>
              new Date(right.timestamp) - new Date(left.timestamp),
          )
          .slice(0, 6);

        return {
          stats: {
            todayOrders,
            todayRevenue: todayRevenue[0]?.total || 0,
            activeTables: occupiedTables + reservedTables,
            activeSessions,
            avgPreparationTime: Math.round(averagePreparation[0]?.average || 0),
          },
          recentActivity,
        };
      },
    );

    return sendSuccess(res, 200, null, data);
  } catch (error) {
    logger.error("Get admin dashboard failed:", error);
    return sendError(res, 500, "Failed to get dashboard data");
  }
};
