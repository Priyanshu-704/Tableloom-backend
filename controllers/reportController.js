const { sendError, sendSuccess } = require("../utils/httpResponse");
const {
  generateAnalyticsReport,
  getGeneratedReport,
} = require("../utils/reportGenerator");
const { logger } = require("../utils/logger");
const { getOrSetCache } = require("../utils/responseCache");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Feedback = require("../models/Feedback");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const WaiterCall = require("../models/WaiterCall");
const KitchenOrder = require("../models/KitchenOrder");
const feedbackManager = require("../utils/feedbackManager");
const REPORT_DATASET_CACHE_TTL_MS = 15 * 1000;
const normalizeReportType = (value = "analytics") => {
  const normalized = String(value || "analytics")
    .trim()
    .toLowerCase();
  return normalized === "finance" ? "finance" : "analytics";
};
const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeReportTitle = (reportTitle = "", reportType = "analytics") => {
  const fallbackTitle =
    reportType === "finance" ? "Finance Report" : "Analytics Report";
  const normalizedTitle = String(reportTitle || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalizedTitle) {
    return fallbackTitle;
  }
  const duplicateSuffixPattern = new RegExp(
    `^${escapeRegExp(fallbackTitle)}\\s+[0-9\\u00B9\\u00B2\\u00B3\\u2070-\\u2079]+$`,
    "i",
  );
  return duplicateSuffixPattern.test(normalizedTitle)
    ? fallbackTitle
    : normalizedTitle;
};
const resolveDateRange = (dateRange = {}) => {
  const startDate = dateRange?.startDate ? new Date(dateRange.startDate) : null;
  const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : null;
  if (
    !startDate ||
    Number.isNaN(startDate.getTime()) ||
    !endDate ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error("Start date and end date are required");
  }
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);
  return {
    rangeStart,
    rangeEnd,
  };
};
const buildSessionMatch = (rangeStart, rangeEnd) => ({
  $or: [
    {
      sessionStart: {
        $gte: rangeStart,
        $lte: rangeEnd,
      },
    },
    {
      sessionEnd: {
        $gte: rangeStart,
        $lte: rangeEnd,
      },
    },
  ],
});
const buildOrderStatisticsDataset = async (rangeStart, rangeEnd) => {
  const orderPlacedAt = {
    $gte: rangeStart,
    $lte: rangeEnd,
  };
  const baseStatusCounts = {
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    served: 0,
    completed: 0,
    cancelled: 0,
  };
  const [
    totalOrders,
    pendingOrders,
    preparingOrders,
    paidRevenue,
    popularItems,
    groupedStatusCounts,
  ] = await Promise.all([
    Order.countDocuments({
      orderPlacedAt,
    }),
    Order.countDocuments({
      orderPlacedAt,
      status: {
        $in: ["pending", "confirmed"],
      },
    }),
    Order.countDocuments({
      orderPlacedAt,
      status: "preparing",
    }),
    Order.aggregate([
      {
        $match: {
          orderPlacedAt,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$totalAmount",
          },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          orderPlacedAt,
        },
      },
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: {
            menuItem: "$items.menuItem",
            size: "$items.sizeId",
          },
          totalQuantity: {
            $sum: "$items.quantity",
          },
          totalRevenue: {
            $sum: "$items.totalPrice",
          },
        },
      },
      {
        $sort: {
          totalQuantity: -1,
        },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "menuitems",
          localField: "_id.menuItem",
          foreignField: "_id",
          as: "menuItem",
        },
      },
      {
        $unwind: {
          path: "$menuItem",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "sizes",
          localField: "_id.size",
          foreignField: "_id",
          as: "size",
        },
      },
      {
        $unwind: {
          path: "$size",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: "$menuItem.name",
          size: "$size.name",
          totalQuantity: 1,
          totalRevenue: 1,
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          orderPlacedAt,
        },
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);
  const statusCounts = groupedStatusCounts.reduce(
    (accumulator, entry) => {
      if (entry?._id) {
        accumulator[entry._id] = entry.count || 0;
      }
      return accumulator;
    },
    {
      ...baseStatusCounts,
    },
  );
  return {
    totalOrders,
    pendingOrders,
    preparingOrders,
    todayOrders: totalOrders,
    todayRevenue: paidRevenue[0]?.total || 0,
    statusCounts,
    popularItems,
    dateRange: {
      startDate: rangeStart,
      endDate: rangeEnd,
    },
  };
};
const buildSessionAnalyticsDataset = async (rangeStart, rangeEnd) => {
  const analytics = await Customer.aggregate([
    {
      $match: buildSessionMatch(rangeStart, rangeEnd),
    },
    {
      $group: {
        _id: null,
        totalSessions: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ["$sessionStart", rangeStart],
                  },
                  {
                    $lte: ["$sessionStart", rangeEnd],
                  },
                  {
                    $eq: ["$isActive", true],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        activeSessions: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ["$sessionStart", rangeStart],
                  },
                  {
                    $lte: ["$sessionStart", rangeEnd],
                  },
                  {
                    $eq: ["$isActive", true],
                  },
                  {
                    $in: ["$sessionStatus", ["active", "payment_pending"]],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        completedSessions: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ["$sessionEnd", rangeStart],
                  },
                  {
                    $lte: ["$sessionEnd", rangeEnd],
                  },
                  {
                    $eq: ["$isActive", true],
                  },
                  {
                    $eq: ["$sessionStatus", "completed"],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        revenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ["$sessionEnd", rangeStart],
                  },
                  {
                    $lte: ["$sessionEnd", rangeEnd],
                  },
                  {
                    $eq: ["$sessionStatus", "completed"],
                  },
                ],
              },
              {
                $ifNull: ["$totalSpent", 0],
              },
              0,
            ],
          },
        },
        averageSessionMinutesTotal: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ["$sessionStart", rangeStart],
                  },
                  {
                    $lte: ["$sessionStart", rangeEnd],
                  },
                  {
                    $eq: ["$sessionStatus", "completed"],
                  },
                  {
                    $ne: ["$sessionEnd", null],
                  },
                ],
              },
              {
                $divide: [
                  {
                    $subtract: ["$sessionEnd", "$sessionStart"],
                  },
                  60000,
                ],
              },
              0,
            ],
          },
        },
        averageSessionMinutesCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ["$sessionStart", rangeStart],
                  },
                  {
                    $lte: ["$sessionStart", rangeEnd],
                  },
                  {
                    $eq: ["$sessionStatus", "completed"],
                  },
                  {
                    $ne: ["$sessionEnd", null],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const summary = analytics[0] || {};
  const averageSessionTime =
    summary.averageSessionMinutesCount > 0
      ? summary.averageSessionMinutesTotal / summary.averageSessionMinutesCount
      : 0;
  return {
    period: "custom",
    totalSessions: summary.totalSessions || 0,
    activeSessions: summary.activeSessions || 0,
    completedSessions: summary.completedSessions || 0,
    averageSessionTime,
    revenue: summary.revenue || 0,
    dateRange: {
      startDate: rangeStart,
      endDate: rangeEnd,
    },
  };
};
const buildKitchenAnalyticsDataset = async (rangeStart, rangeEnd) => {
  const analytics = await KitchenOrder.aggregate([
    {
      $match: {
        createdAt: {
          $gte: rangeStart,
          $lte: rangeEnd,
        },
        overallStatus: "completed",
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
          },
        },
        totalOrders: {
          $sum: 1,
        },
        avgPreparationTime: {
          $avg: "$timeMetrics.preparationTime",
        },
        avgTotalTime: {
          $avg: "$timeMetrics.totalTime",
        },
        onTimeRate: {
          $avg: {
            $cond: [
              {
                $lte: ["$timeMetrics.preparationTime", 1800],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);
  return {
    dailyAnalytics: analytics,
    overallStats: {
      totalOrders: analytics.reduce(
        (sum, day) => sum + (day.totalOrders || 0),
        0,
      ),
      avgPreparationTime:
        analytics.length > 0
          ? analytics.reduce(
              (sum, day) => sum + (day.avgPreparationTime || 0),
              0,
            ) / analytics.length
          : 0,
      avgTotalTime:
        analytics.length > 0
          ? analytics.reduce((sum, day) => sum + (day.avgTotalTime || 0), 0) /
            analytics.length
          : 0,
      overallOnTimeRate:
        analytics.length > 0
          ? analytics.reduce((sum, day) => sum + (day.onTimeRate || 0), 0) /
            analytics.length
          : 0,
    },
    dateRange: {
      startDate: rangeStart,
      endDate: rangeEnd,
    },
  };
};
const buildFeedbackDataset = async (rangeStart, rangeEnd) => {
  const filters = {
    startDate: rangeStart.toISOString(),
    endDate: rangeEnd.toISOString(),
  };
  const [statistics, nps, trendingTopics, recentFeedback] = await Promise.all([
    feedbackManager.getFeedbackStatistics(filters),
    feedbackManager.getNPS(filters),
    feedbackManager.getTrendingTopics(5),
    Feedback.find({
      createdAt: {
        $gte: rangeStart,
        $lte: rangeEnd,
      },
    })
      .populate("customer", "name email phone")
      .populate("order", "orderNumber")
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean(),
  ]);
  return {
    statistics,
    nps,
    trendingTopics,
    recentFeedback,
  };
};
const buildWaiterDataset = async (rangeStart, rangeEnd) => {
  const createdAt = {
    $gte: rangeStart,
    $lte: rangeEnd,
  };
  const [byStatus, summary] = await Promise.all([
    WaiterCall.aggregate([
      {
        $match: {
          createdAt,
        },
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
          avgResponseTime: {
            $avg: "$responseTime",
          },
          avgResolutionTime: {
            $avg: "$resolutionTime",
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]),
    WaiterCall.aggregate([
      {
        $match: {
          createdAt,
        },
      },
      {
        $group: {
          _id: null,
          totalCalls: {
            $sum: 1,
          },
          pendingCalls: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "pending"],
                },
                1,
                0,
              ],
            },
          },
          activeCalls: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", ["assigned", "acknowledged", "in_progress"]],
                },
                1,
                0,
              ],
            },
          },
          avgResponseTime: {
            $avg: "$responseTime",
          },
          avgResolutionTime: {
            $avg: "$resolutionTime",
          },
        },
      },
    ]),
  ]);
  const overview = summary[0] || {};
  return {
    totalCalls: overview.totalCalls || 0,
    pendingCalls: overview.pendingCalls || 0,
    activeCalls: overview.activeCalls || 0,
    avgResponseTime: overview.avgResponseTime || 0,
    avgResolutionTime: overview.avgResolutionTime || 0,
    byStatus: byStatus.map((row) => ({
      status: row._id || "unknown",
      count: row.count || 0,
      avgResponseTime: row.avgResponseTime || 0,
      avgResolutionTime: row.avgResolutionTime || 0,
    })),
    statistics: {
      totalCalls: overview.totalCalls || 0,
      pendingCalls: overview.pendingCalls || 0,
      activeCalls: overview.activeCalls || 0,
    },
  };
};
const buildTableDataset = async () => {
  const [activeTables, available, occupied, reserved] = await Promise.all([
    Table.countDocuments({
      isActive: true,
    }),
    Table.countDocuments({
      isActive: true,
      status: "available",
    }),
    Table.countDocuments({
      isActive: true,
      status: "occupied",
    }),
    Table.countDocuments({
      isActive: true,
      status: "reserved",
    }),
  ]);
  return {
    total: activeTables,
    available,
    occupied,
    reserved,
    occupancyRate:
      activeTables > 0 ? ((occupied + reserved) / activeTables) * 100 : 0,
  };
};
const buildMenuDataset = async () => {
  const [
    totalItems,
    availableItems,
    unavailableItems,
    vegetarian,
    nonVegetarian,
    vegan,
    glutenFree,
  ] = await Promise.all([
    MenuItem.countDocuments({
      isActive: true,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isAvailable: true,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isAvailable: false,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isVegetarian: true,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isNonVegetarian: true,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isNonVegetarian: false,
      isVegetarian: false,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isVegan: true,
    }),
    MenuItem.countDocuments({
      isActive: true,
      isGlutenFree: true,
    }),
  ]);
  return {
    totalItems,
    availableItems,
    unavailableItems,
    dietary: {
      vegetarian,
      nonVegetarian,
      vegan,
      glutenFree,
    },
  };
};
const buildFinanceDataset = async (rangeStart, rangeEnd) => {
  const orderPlacedAt = {
    $gte: rangeStart,
    $lte: rangeEnd,
  };
  const [summary, paymentMethods, dailyRevenue, orderTypes, sessionRevenue] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            orderPlacedAt,
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$totalAmount",
            },
            subtotal: {
              $sum: "$subtotal",
            },
            taxAmount: {
              $sum: "$taxAmount",
            },
            serviceCharge: {
              $sum: "$serviceCharge",
            },
            discountAmount: {
              $sum: "$discountAmount",
            },
            totalPaidOrders: {
              $sum: 1,
            },
            averageOrderValue: {
              $avg: "$totalAmount",
            },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            orderPlacedAt,
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: "$paymentMethod",
            orders: {
              $sum: 1,
            },
            revenue: {
              $sum: "$totalAmount",
            },
          },
        },
        {
          $sort: {
            revenue: -1,
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            orderPlacedAt,
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$orderPlacedAt",
              },
            },
            revenue: {
              $sum: "$totalAmount",
            },
            orders: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            orderPlacedAt,
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: "$orderType",
            orders: {
              $sum: 1,
            },
            revenue: {
              $sum: "$totalAmount",
            },
          },
        },
        {
          $sort: {
            revenue: -1,
          },
        },
      ]),
      Customer.aggregate([
        {
          $match: {
            sessionEnd: {
              $gte: rangeStart,
              $lte: rangeEnd,
            },
            sessionStatus: "completed",
          },
        },
        {
          $group: {
            _id: null,
            completedSessions: {
              $sum: 1,
            },
            totalSessionRevenue: {
              $sum: {
                $ifNull: ["$totalSpent", 0],
              },
            },
            averageSessionRevenue: {
              $avg: {
                $ifNull: ["$totalSpent", 0],
              },
            },
          },
        },
      ]),
    ]);
  const financeSummary = summary[0] || {};
  const sessionSummary = sessionRevenue[0] || {};
  return {
    summary: {
      totalRevenue: financeSummary.totalRevenue || 0,
      subtotal: financeSummary.subtotal || 0,
      taxAmount: financeSummary.taxAmount || 0,
      serviceCharge: financeSummary.serviceCharge || 0,
      discountAmount: financeSummary.discountAmount || 0,
      totalPaidOrders: financeSummary.totalPaidOrders || 0,
      averageOrderValue: financeSummary.averageOrderValue || 0,
      completedSessions: sessionSummary.completedSessions || 0,
      totalSessionRevenue: sessionSummary.totalSessionRevenue || 0,
      averageSessionRevenue: sessionSummary.averageSessionRevenue || 0,
    },
    paymentMethods: paymentMethods.map((row) => ({
      method: row._id || "unknown",
      orders: row.orders || 0,
      revenue: row.revenue || 0,
    })),
    dailyRevenue: dailyRevenue.map((row) => ({
      day: row._id,
      revenue: row.revenue || 0,
      orders: row.orders || 0,
    })),
    orderTypes: orderTypes.map((row) => ({
      orderType: row._id || "unknown",
      orders: row.orders || 0,
      revenue: row.revenue || 0,
    })),
    dateRange: {
      startDate: rangeStart,
      endDate: rangeEnd,
    },
  };
};
const buildReportDataset = async (
  reportType,
  rangeStart,
  rangeEnd,
  tenantId,
) => {
  const cacheKey = `reports:${tenantId || "default"}:${reportType}:${rangeStart.toISOString()}:${rangeEnd.toISOString()}`;
  return getOrSetCache(cacheKey, REPORT_DATASET_CACHE_TTL_MS, async () => {
    if (reportType === "finance") {
      return buildFinanceDataset(rangeStart, rangeEnd);
    }
    const [orders, sessions, kitchen, feedback, menu, tables, waiterCalls] =
      await Promise.all([
        buildOrderStatisticsDataset(rangeStart, rangeEnd),
        buildSessionAnalyticsDataset(rangeStart, rangeEnd),
        buildKitchenAnalyticsDataset(rangeStart, rangeEnd),
        buildFeedbackDataset(rangeStart, rangeEnd),
        buildMenuDataset(),
        buildTableDataset(),
        buildWaiterDataset(rangeStart, rangeEnd),
      ]);
    return {
      orders,
      sessions,
      kitchen,
      feedback,
      menu,
      tables,
      waiterCalls,
    };
  });
};
exports.generateAnalyticsReportFile = async (req, res) => {
  try {
    const {
      format = "pdf",
      reportType = "analytics",
      reportTitle = "",
      restaurantName = "Restaurant",
      dateRange = {},
      dateRangeLabel = "",
      currency = "INR",
      download = false,
    } = req.body || {};
    if (!["pdf", "excel"].includes(String(format).toLowerCase())) {
      return sendError(res, 400, "Report format must be pdf or excel");
    }
    const normalizedReportType = normalizeReportType(reportType);
    const { rangeStart, rangeEnd } = resolveDateRange(dateRange);
    const dataset = await buildReportDataset(
      normalizedReportType,
      rangeStart,
      rangeEnd,
      req.tenantId || req.user?.tenantId || "default",
    );
    const resolvedTitle = normalizeReportTitle(
      reportTitle,
      normalizedReportType,
    );
    const result = await generateAnalyticsReport({
      tenantId: req.tenantId || req.user?.tenantId || "default",
      reportType: normalizedReportType,
      format: String(format).toLowerCase(),
      reportTitle: resolvedTitle,
      restaurantName:
        String(restaurantName || "Restaurant").trim() || "Restaurant",
      generatedAt: new Date(),
      dateRangeLabel:
        String(dateRangeLabel || "").trim() ||
        `${dateRange.startDate} to ${dateRange.endDate}`,
      currency: String(currency || "INR").trim() || "INR",
      dataset,
    });
    if (download) {
      const report = getGeneratedReport(result.reportId);
      if (!report) {
        return sendError(res, 500, "Generated report file not found");
      }
      res.setHeader("Content-Type", report.contentType);
      return res.download(report.filePath, report.filename);
    }
    return sendSuccess(res, 201, "Report generated successfully", {
      ...result,
      reportType: normalizedReportType,
      generatedAt: new Date().toISOString(),
      downloadPath: `/reports/download/${result.reportId}`,
    });
  } catch (error) {
    logger.error("Generate analytics report failed:", error);
    if (error.message === "Start date and end date are required") {
      return sendError(res, 400, error.message);
    }
    return sendError(res, 500, "Failed to generate report", error);
  }
};
exports.getReportDataset = async (req, res) => {
  try {
    const { reportType = "analytics", startDate, endDate } = req.query || {};
    const normalizedReportType = normalizeReportType(reportType);
    const { rangeStart, rangeEnd } = resolveDateRange({
      startDate,
      endDate,
    });
    const dataset = await buildReportDataset(
      normalizedReportType,
      rangeStart,
      rangeEnd,
      req.tenantId || req.user?.tenantId || "default",
    );
    return sendSuccess(res, 200, null, dataset, {
      reportType: normalizedReportType,
      dateRange: {
        startDate: rangeStart,
        endDate: rangeEnd,
      },
    });
  } catch (error) {
    logger.error("Get report dataset failed:", error);
    if (error.message === "Start date and end date are required") {
      return sendError(res, 400, error.message);
    }
    return sendError(res, 500, "Failed to fetch report dataset", error);
  }
};
exports.downloadGeneratedReport = async (req, res) => {
  try {
    const report = getGeneratedReport(req.params.reportId);
    if (!report) {
      return sendError(res, 404, "Generated report not found or expired");
    }
    if (
      String(report.tenantId || "") !==
      String(req.tenantId || req.user?.tenantId || "")
    ) {
      return sendError(res, 404, "Generated report not found");
    }
    res.setHeader("Content-Type", report.contentType);
    return res.download(report.filePath, report.filename);
  } catch (error) {
    logger.error("Download generated report failed:", error);
    return sendError(res, 500, "Failed to download report", error);
  }
};
