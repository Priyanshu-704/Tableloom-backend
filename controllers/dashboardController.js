const {
  logger
} = require("./../utils/logger.js");
const Order = require("../models/Order");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const WaiterCall = require("../models/WaiterCall");
const {
  sendSuccess,
  sendError
} = require("../utils/httpResponse");
const {
  getOrSetCache
} = require("../utils/responseCache");
const feedbackManager = require("../utils/feedbackManager");
const DASHBOARD_OVERVIEW_CACHE_TTL_MS = 15 * 1000;
const buildCustomerAnalytics = async (rangeStart, rangeEnd) => {
  const analytics = await Customer.aggregate([{
    $match: {
      $or: [{
        sessionStart: {
          $gte: rangeStart,
          $lte: rangeEnd
        }
      }, {
        sessionEnd: {
          $gte: rangeStart,
          $lte: rangeEnd
        }
      }]
    }
  }, {
    $group: {
      _id: null,
      totalSessions: {
        $sum: {
          $cond: [{
            $and: [{
              $gte: ["$sessionStart", rangeStart]
            }, {
              $lte: ["$sessionStart", rangeEnd]
            }, {
              $eq: ["$isActive", true]
            }]
          }, 1, 0]
        }
      },
      activeSessions: {
        $sum: {
          $cond: [{
            $and: [{
              $gte: ["$sessionStart", rangeStart]
            }, {
              $lte: ["$sessionStart", rangeEnd]
            }, {
              $eq: ["$isActive", true]
            }, {
              $in: ["$sessionStatus", ["active", "payment_pending"]]
            }]
          }, 1, 0]
        }
      },
      completedSessions: {
        $sum: {
          $cond: [{
            $and: [{
              $gte: ["$sessionEnd", rangeStart]
            }, {
              $lte: ["$sessionEnd", rangeEnd]
            }, {
              $eq: ["$isActive", true]
            }, {
              $eq: ["$sessionStatus", "completed"]
            }]
          }, 1, 0]
        }
      },
      revenue: {
        $sum: {
          $cond: [{
            $and: [{
              $gte: ["$sessionEnd", rangeStart]
            }, {
              $lte: ["$sessionEnd", rangeEnd]
            }, {
              $eq: ["$sessionStatus", "completed"]
            }]
          }, {
            $ifNull: ["$totalSpent", 0]
          }, 0]
        }
      }
    }
  }]);
  return analytics[0] || {};
};
exports.getAdminDashboard = async (req, res) => {
  try {
    const cacheKey = `dashboard:overview:${req.tenantId || "default"}`;
    const data = await getOrSetCache(cacheKey, DASHBOARD_OVERVIEW_CACHE_TTL_MS, async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const [todayOrders, todayRevenue, occupiedTables, reservedTables, activeSessions, averagePreparation, latestOrders, latestCalls, pendingOrders, preparingOrders, popularItems, customerAnalytics, feedbackNps, waiterSummary] = await Promise.all([Order.countDocuments({
        orderPlacedAt: {
          $gte: today
        }
      }), Order.aggregate([{
        $match: {
          orderPlacedAt: {
            $gte: today
          },
          paymentStatus: "paid"
        }
      }, {
        $group: {
          _id: null,
          total: {
            $sum: "$totalAmount"
          }
        }
      }]), Table.countDocuments({
        isActive: true,
        status: "occupied"
      }), Table.countDocuments({
        isActive: true,
        status: "reserved"
      }), Customer.countDocuments({
        isActive: true,
        sessionStatus: {
          $in: ["active", "payment_pending"]
        }
      }), Order.aggregate([{
        $match: {
          orderPlacedAt: {
            $gte: today
          },
          preparationTime: {
            $gt: 0
          }
        }
      }, {
        $group: {
          _id: null,
          average: {
            $avg: "$preparationTime"
          }
        }
      }]), Order.find({}).select("_id orderNumber orderPlacedAt createdAt table").populate("table", "tableNumber tableName").sort({
        orderPlacedAt: -1
      }).limit(5).lean(), WaiterCall.find({}).select("_id createdAt tableName tableNumber").sort({
        createdAt: -1
      }).limit(5).lean(), Order.countDocuments({
        orderPlacedAt: {
          $gte: today
        },
        status: {
          $in: ["pending", "confirmed"]
        }
      }), Order.countDocuments({
        orderPlacedAt: {
          $gte: today
        },
        status: "preparing"
      }), Order.aggregate([{
        $match: {
          orderPlacedAt: {
            $gte: today
          }
        }
      }, {
        $unwind: "$items"
      }, {
        $group: {
          _id: {
            menuItem: "$items.menuItem",
            size: "$items.sizeId"
          },
          totalQuantity: {
            $sum: "$items.quantity"
          },
          totalRevenue: {
            $sum: "$items.totalPrice"
          }
        }
      }, {
        $sort: {
          totalQuantity: -1
        }
      }, {
        $limit: 5
      }, {
        $lookup: {
          from: "menuitems",
          localField: "_id.menuItem",
          foreignField: "_id",
          as: "menuItem"
        }
      }, {
        $unwind: {
          path: "$menuItem",
          preserveNullAndEmptyArrays: true
        }
      }, {
        $lookup: {
          from: "sizes",
          localField: "_id.size",
          foreignField: "_id",
          as: "size"
        }
      }, {
        $unwind: {
          path: "$size",
          preserveNullAndEmptyArrays: true
        }
      }, {
        $project: {
          name: "$menuItem.name",
          size: "$size.name",
          totalQuantity: 1,
          totalRevenue: 1
        }
      }]), buildCustomerAnalytics(today, todayEnd), feedbackManager.getNPS("30days"), WaiterCall.aggregate([{
        $group: {
          _id: null,
          pendingCalls: {
            $sum: {
              $cond: [{
                $eq: ["$status", "pending"]
              }, 1, 0]
            }
          },
          activeCalls: {
            $sum: {
              $cond: [{
                $in: ["$status", ["assigned", "acknowledged", "in_progress"]]
              }, 1, 0]
            }
          },
          totalCalls: {
            $sum: 1
          }
        }
      }])]);
      const recentActivity = [...latestOrders.map(order => ({
        id: `order-${order._id}`,
        type: "order",
        timestamp: order.orderPlacedAt || order.createdAt,
        message: `Order #${order.orderNumber} from ${order.table?.tableName || `Table ${order.table?.tableNumber || ""}`.trim()}`
      })), ...latestCalls.map(call => ({
        id: `call-${call._id}`,
        type: "waiter",
        timestamp: call.createdAt,
        message: `Waiter call from ${call.tableName || `Table ${call.tableNumber}`}`
      }))].sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp)).slice(0, 6);
      return {
        stats: {
          todayOrders,
          todayRevenue: todayRevenue[0]?.total || 0,
          activeTables: occupiedTables + reservedTables,
          activeSessions,
          avgPreparationTime: Math.round(averagePreparation[0]?.average || 0)
        },
        recentActivity,
        orderStats: {
          pendingOrders,
          preparingOrders,
          todayOrders,
          popularItems
        },
        customerAnalytics: {
          activeSessions: customerAnalytics.activeSessions || 0,
          completedSessions: customerAnalytics.completedSessions || 0
        },
        feedbackDashboard: {
          nps: {
            score: Number(feedbackNps?.score ?? feedbackNps?.nps ?? 0)
          }
        },
        waiterDashboard: {
          pendingCalls: waiterSummary[0]?.pendingCalls || 0,
          activeCalls: waiterSummary[0]?.activeCalls || 0,
          statistics: {
            pendingCalls: waiterSummary[0]?.pendingCalls || 0,
            activeCalls: waiterSummary[0]?.activeCalls || 0,
            totalCalls: waiterSummary[0]?.totalCalls || 0
          },
          lastUpdated: new Date()
        }
      };
    });
    return sendSuccess(res, 200, null, data);
  } catch (error) {
    logger.error("Get admin dashboard failed:", error);
    return sendError(res, 500, "Failed to get dashboard data");
  }
};
