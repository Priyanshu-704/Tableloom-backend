const { logger } = require("./../utils/logger.js");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const orderManager = require("../utils/orderManager");
const { buildTenantImageAssetUrl } = require("../utils/assetUrl");
const {
  isCheckoutMethodAllowed,
  isManualMethodAllowed,
  loadTenantPaymentConfiguration,
} = require("../utils/paymentGatewayManager");
require("dotenv").config({
  quiet: true,
});
const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  online: "Online",
  card: "Card",
  upi: "UPI",
  wallet: "Wallet",
};
const shapeOrderHistorySummary = (order) => ({
  _id: order._id,
  orderNumber: order.orderNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  totalAmount: Number(order.totalAmount || 0),
  orderPlacedAt: order.orderPlacedAt || order.createdAt,
  createdAt: order.createdAt,
  items: Array.isArray(order.items)
    ? order.items.map((item, index) => ({
        _id: item._id || `${order._id}-${index}`,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || item.price || 0),
        totalPrice:
          Number(item.totalPrice) ||
          Number(item.unitPrice || item.price || 0) *
            Number(item.quantity || 0),
        name: item.menuItem?.name || item.name || "Menu item",
        sizeName: item.sizeName || item.sizeId?.name || "",
      }))
    : [],
});
const shapeOrderItemResponse = (item = {}, index = 0) => {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || item.price || 0);
  const totalPrice = Number(item.totalPrice) || unitPrice * quantity;
  return {
    _id: item._id || `${item.menuItem?._id || "item"}-${index}`,
    quantity,
    unitPrice,
    totalPrice,
    name: item.menuItem?.name || item.name || "Menu item",
    sizeName: item.sizeName || item.sizeId?.name || "",
    notes: item.notes || item.specialInstructions || "",
    specialInstructions: item.specialInstructions || "",
    menuItem: item.menuItem
      ? {
          _id: item.menuItem._id,
          name: item.menuItem.name,
        }
      : null,
    sizeId: item.sizeId
      ? {
          _id: item.sizeId._id,
          name: item.sizeId.name,
        }
      : null,
  };
};
const shapeOrderResponse = (order = {}) => ({
  _id: order._id,
  orderNumber: order.orderNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  totalAmount: Number(order.totalAmount || 0),
  currency: order.currency || "INR",
  specialInstructions: order.specialInstructions || "",
  preparationTime: Number(order.preparationTime || 0),
  estimatedReadyTime: order.estimatedReadyTime || null,
  orderPlacedAt: order.orderPlacedAt || order.createdAt || null,
  createdAt: order.createdAt || null,
  table: order.table
    ? {
        _id: order.table._id,
        tableNumber: order.table.tableNumber,
        tableName: order.table.tableName || "",
      }
    : null,
  items: Array.isArray(order.items)
    ? order.items.map((item, index) => shapeOrderItemResponse(item, index))
    : [],
});
const transformOrderData = (order, req) => {
  if (!order) return null;
  const orderObj = order.toObject ? order.toObject() : order;
  if (orderObj.items && Array.isArray(orderObj.items)) {
    orderObj.items = orderObj.items.map((item) => {
      if (item.menuItem && (item.menuItem.image || item.menuItem.thumbnail)) {
        item.menuItem.image = buildTenantImageAssetUrl(
          req,
          `/images/menu-item/${item.menuItem._id}`,
        );
        item.menuItem.thumbnail = buildTenantImageAssetUrl(
          req,
          `/images/menu-item/${item.menuItem._id}`,
          {
            variant: "thumbnail",
          },
        );
      }
      if (
        item.menuItem &&
        item.menuItem.prices &&
        Array.isArray(item.menuItem.prices)
      ) {
        item.menuItem.prices = item.menuItem.prices.map((price) => ({
          _id: price._id,
          price: price.price,
          size: price.size
            ? {
                _id: price.size._id,
                name: price.size.name,
                code: price.size.code,
              }
            : null,
        }));
      }
      return item;
    });
  }
  return orderObj;
};
const resolveOrderStatisticsDateRange = (query = {}) => {
  const { startDate, endDate } = query || {};
  if (startDate || endDate) {
    const range = {};
    if (startDate) {
      range.$gte = new Date(startDate);
    }
    if (endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);
      range.$lte = inclusiveEndDate;
    }
    return range;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    $gte: today,
  };
};
const canAccessOrder = (req, order = {}) => {
  if (req.user?._id) {
    return true;
  }

  return (
    Boolean(req.customerSessionId) &&
    String(order?.customer?.sessionId || "") === String(req.customerSessionId)
  );
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select(
        "orderNumber status paymentStatus totalAmount currency specialInstructions preparationTime estimatedReadyTime orderPlacedAt createdAt table items customer",
      )
      .populate("table", "tableNumber tableName")
      .populate("customer", "sessionId")
      .populate("items.menuItem", "name")
      .populate("items.sizeId", "name")
      .lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (!canAccessOrder(req, order)) {
      return res.status(req.customerSessionId || req.user?._id ? 403 : 401).json({
        success: false,
        message: "You are not authorized to access this order",
      });
    }
    res.status(200).json({
      success: true,
      data: shapeOrderResponse(order),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get order",
      error: error.message,
    });
  }
};
exports.getOrderBySession = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      sessionId: req.params.sessionId,
      isActive: true,
    })
      .select("_id")
      .lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer session not found",
      });
    }
    const order = await Order.findOne({
      customer: customer._id,
    })
      .select(
        "orderNumber status paymentStatus totalAmount currency specialInstructions preparationTime estimatedReadyTime orderPlacedAt createdAt table items",
      )
      .populate("table", "tableNumber tableName")
      .populate("items.menuItem", "name")
      .populate("items.sizeId", "name")
      .sort({
        createdAt: -1,
      })
      .lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "No active order found for this session",
      });
    }
    res.status(200).json({
      success: true,
      data: shapeOrderResponse(order),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get order by session",
      error: error.message,
    });
  }
};
exports.getOrderHistoryBySession = async (req, res) => {
  try {
    const { limit = 20, page = 1, summary = "false" } = req.query;
    const customer = await Customer.findOne({
      sessionId: req.params.sessionId,
      isActive: true,
    })
      .select("_id")
      .lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer session not found",
      });
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;
    const summaryOnly = summary === "true";
    let ordersQuery = Order.find({
      customer: customer._id,
    })
      .select(
        summaryOnly
          ? "_id orderNumber status paymentStatus totalAmount orderPlacedAt createdAt items"
          : undefined,
      )
      .populate(
        "items.menuItem",
        summaryOnly
          ? "name"
          : "name description image thumbnail category tags nutritionalInfo allergens ingredients",
      )
      .populate("items.sizeId", summaryOnly ? "name" : "name code")
      .sort({
        orderPlacedAt: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNum)
      .lean();
    if (!summaryOnly) {
      ordersQuery = ordersQuery
        .populate("customer", "sessionId name phone email")
        .populate("table", "tableNumber tableName capacity location");
    }
    const [orders, total] = await Promise.all([
      ordersQuery,
      Order.countDocuments({
        customer: customer._id,
      }),
    ]);
    const transformedOrders = summaryOnly
      ? orders.map(shapeOrderHistorySummary)
      : orders.map((order) => transformOrderData(order));
    return res.status(200).json({
      success: true,
      count: transformedOrders.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      data: transformedOrders,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to get order history by session",
      error: error.message,
    });
  }
};
exports.addItemsToOrder = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items array is required",
      });
    }
    const invalidItems = items.filter((item) => !item.size);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Size is required for all menu items",
      });
    }
    const order = await orderManager.addItemsToOrder(req.params.id, items);
    res.status(200).json({
      success: true,
      message: "Items added to order successfully",
      data: order,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Cannot add items to order") ||
      error.message.includes("Menu item not available") ||
      error.message.includes("Selected size not available")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to add items to order",
      error: error.message,
    });
  }
};
exports.updateItemQuantity = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
      });
    }
    const order = await orderManager.updateOrderItemQuantity(
      req.params.orderId,
      req.params.itemId,
      parseInt(quantity),
    );
    res.status(200).json({
      success: true,
      message: "Item quantity updated successfully",
      data: order,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Order item not found") ||
      error.message.includes("Cannot modify order")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update item quantity",
      error: error.message,
    });
  }
};
exports.removeItemFromOrder = async (req, res) => {
  try {
    const order = await orderManager.removeItemFromOrder(
      req.params.orderId,
      req.params.itemId,
    );
    res.status(200).json({
      success: true,
      message: "Item removed from order successfully",
      data: order,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Cannot modify order")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to remove item from order",
      error: error.message,
    });
  }
};
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }
    const canFullyUpdateOrderStatus = Boolean(
      req.user?.hasPermission?.("ORDER_UPDATE_STATUS"),
    );
    const canMarkServedOnly = Boolean(
      req.user?.hasPermission?.("KITCHEN_MARK_SERVED"),
    );
    if (
      !canFullyUpdateOrderStatus &&
      (!canMarkServedOnly || String(status).trim().toLowerCase() !== "served")
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You only have permission to mark ready orders as served.",
      });
    }
    const order = await orderManager.updateOrderStatus(
      req.params.id,
      status,
      req.user.id,
      notes,
    );
    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Invalid status transition")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("only have permission to mark")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};
exports.processPayment = async (req, res) => {
  try {
    const { method, transactionId, gateway, amount } = req.body;
    if (!method) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }
    if (!req.user?._id) {
      const orderForAccessCheck = await Order.findById(req.params.id)
        .select("customer")
        .populate("customer", "sessionId")
        .lean();
      if (!orderForAccessCheck) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
      if (!canAccessOrder(req, orderForAccessCheck)) {
        return res.status(req.customerSessionId ? 403 : 401).json({
          success: false,
          message: "You are not authorized to access this order",
        });
      }
    }
    const orderForPayment = await Order.findById(req.params.id)
      .select("tenantId branchId")
      .lean();
    if (!orderForPayment) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    const paymentConfiguration = await loadTenantPaymentConfiguration(
      orderForPayment.tenantId,
      {
        branchId: orderForPayment.branchId,
      },
    );
    const normalizedMethod = String(method || "")
      .trim()
      .toLowerCase();
    const normalizedGateway = String(gateway || "offline")
      .trim()
      .toLowerCase();
    const isAllowed =
      normalizedGateway === "razorpay"
        ? isCheckoutMethodAllowed(paymentConfiguration, normalizedMethod)
        : isManualMethodAllowed(paymentConfiguration, normalizedMethod);
    if (!isAllowed) {
      return res.status(400).json({
        success: false,
        message:
          normalizedMethod !== "cash" &&
          !paymentConfiguration?.paymentGateway?.enabled
            ? "Only cash payments are available until this tenant securely configures payment gateway credentials."
            : `${PAYMENT_METHOD_LABELS[normalizedMethod] || "Selected"} payments are not enabled for this tenant.`,
      });
    }
    const order = await orderManager.processPayment(req.params.id, {
      method: normalizedMethod,
      transactionId,
      gateway: normalizedGateway,
      amount,
    });
    res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      data: order,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Order is already paid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    });
  }
};
exports.getOrdersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "served",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }
    const result = await orderManager.getOrdersByStatus(status, page, limit);
    res.status(200).json({
      success: true,
      count: result.orders.length,
      ...result.pagination,
      data: result.orders,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get orders by status",
      error: error.message,
    });
  }
};
exports.getAllOrders = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      table,
      search,
      page = 1,
      limit = 20,
    } = req.query;
    let query = {};
    if (status) {
      query.status = status;
    }
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    if (startDate || endDate) {
      query.orderPlacedAt = {};
      if (startDate) query.orderPlacedAt.$gte = new Date(startDate);
      if (endDate) query.orderPlacedAt.$lte = new Date(endDate);
    }
    if (table) {
      query.table = table;
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let ordersQuery = Order.find(query)
      .select(
        "orderNumber status paymentStatus totalAmount currency specialInstructions estimatedReadyTime orderPlacedAt createdAt table items",
      )
      .populate("table", "tableNumber tableName")
      .populate("items.menuItem", "name")
      .populate("items.sizeId", "name")
      .sort({
        orderPlacedAt: -1,
      });
    if (search) {
      ordersQuery = ordersQuery.populate("customer", "name phone");
    }
    if (!search) {
      ordersQuery = ordersQuery.skip(skip).limit(limitNum);
    }
    const orders = await ordersQuery;
    let transformedOrders = orders.map((order) => {
      const orderObj = order.toObject ? order.toObject() : order;
      const shapedOrder = shapeOrderResponse(orderObj);
      return search
        ? {
            ...shapedOrder,
            customer: orderObj.customer
              ? {
                  name: orderObj.customer.name || "",
                  phone: orderObj.customer.phone || "",
                }
              : null,
          }
        : shapedOrder;
    });
    if (search) {
      const keyword = search.trim().toLowerCase();
      transformedOrders = transformedOrders.filter((order) => {
        const itemMatch = (order.items || []).some((item) =>
          String(item.menuItem?.name || item.name || "")
            .toLowerCase()
            .includes(keyword),
        );
        return (
          String(order.orderNumber || "")
            .toLowerCase()
            .includes(keyword) ||
          String(order.table?.tableNumber || order.table?.tableName || "")
            .toLowerCase()
            .includes(keyword) ||
          String(order.customer?.name || order.customer?.phone || "")
            .toLowerCase()
            .includes(keyword) ||
          itemMatch
        );
      });
    }
    const total = search
      ? transformedOrders.length
      : await Order.countDocuments(query);
    const paginatedOrders = (
      search
        ? transformedOrders.slice(skip, skip + limitNum)
        : transformedOrders
    ).map(({ customer, ...order }) => order);
    const revenueStats = await Order.aggregate([
      {
        $match: {
          ...query,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$totalAmount",
          },
          totalOrders: {
            $sum: 1,
          },
        },
      },
    ]);
    res.status(200).json({
      success: true,
      count: paginatedOrders.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      statistics: {
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        totalPaidOrders: revenueStats[0]?.totalOrders || 0,
      },
      data: paginatedOrders,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get orders",
      error: error.message,
    });
  }
};
exports.getOrderStatistics = async (req, res) => {
  try {
    const orderPlacedAt = resolveOrderStatisticsDateRange(req.query);
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
      todayOrders,
      todayRevenue,
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
      Order.countDocuments({
        orderPlacedAt,
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
          $unwind: "$menuItem",
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
          $unwind: "$size",
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
    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        preparingOrders,
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        statusCounts,
        popularItems,
        dateRange: {
          startDate: orderPlacedAt?.$gte || null,
          endDate: orderPlacedAt?.$lte || null,
        },
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get order statistics",
      error: error.message,
    });
  }
};
exports.getOrdersByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { status } = req.query;
    const orders = await orderManager.getOrdersByTable(tableId, status);
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to get orders by table",
      error: error.message,
    });
  }
};
