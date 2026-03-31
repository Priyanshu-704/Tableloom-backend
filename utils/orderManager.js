const { logger } = require("./logger.js");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Table = require("../models/Table");
const MenuItem = require("../models/MenuItem");
const Size = require("../models/Size");
const notificationManager = require("./notificationManager");
const socketManager = require("./socketManager");
const kitchenManager = require("./kitchenManager");
const { orderStatusColors } = require("../utils/statusColors");
const User = require("../models/User");
const Bill = require("../models/Bill");
require("dotenv").config({ quiet: true });

const getBaseUrl = () => {
  return process.env.BACKEND_URL;
};

const transformMenuItemData = (menuItem) => {
  if (!menuItem) return null;

  const menuItemObj = menuItem.toObject ? menuItem.toObject() : menuItem;

  if (menuItemObj.image) {
    menuItemObj.image = `${getBaseUrl()}/images/menu-item/${menuItemObj._id}`;
  }

  if (menuItemObj.prices && Array.isArray(menuItemObj.prices)) {
    menuItemObj.prices = menuItemObj.prices.map((price) => ({
      _id: price._id,
      price: price.price,
      sizeId: price.sizeId
        ? {
            _id: price.sizeId._id,
            name: price.sizeId.name,
            code: price.sizeId.code,
          }
        : null,
      costPrice: price.costPrice || null,
    }));
  }

  return menuItemObj;
};

const notifyCustomerSession = async (sessionId, title, message, orderObj = {}) => {
  if (!sessionId) {
    return;
  }

  try {
    await notificationManager.createCustomerSessionNotification({
      customerSessionId: sessionId,
      title,
      message,
      type: "system_alert",
      priority: "medium",
      relatedTo: orderObj?._id || null,
      relatedModel: "Order",
      metadata: {
        orderId: orderObj?._id || null,
        orderNumber: orderObj?.orderNumber || "",
        status: orderObj?.status || "",
      },
    });
  } catch (error) {
    logger.error("Failed to create order notification:", error);
  }
};

exports.createOrder = async (sessionId, orderData) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: "active",
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new Error("Order items are required");
    }

    const validationPromises = orderData.items.map(async (item, index) => {
      if (!item.menuItem) {
        throw new Error(`Menu item ID is required for item at index ${index}`);
      }

      if (!item.size) {
        throw new Error(`Size is required for item at index ${index}`);
      }

      if (typeof item.quantity !== "number" || item.quantity < 1) {
        throw new Error(`Invalid quantity for item at index ${index}`);
      }

      const menuItem = await MenuItem.findOne({
        _id: item.menuItem,
        isActive: true,
        isAvailable: true,
      }).populate("prices.sizeId", "name code");

      if (!menuItem) {
        throw new Error(`Menu item not available for item at index ${index}`);
      }
      const sizePrice = menuItem.prices.find(
        (price) =>
          price.sizeId && price.sizeId._id.toString() === item.size.toString(),
      );

      if (!sizePrice) {
        throw new Error(`Selected size not available for ${menuItem.name}`);
      }

      return {
        menuItem: item.menuItem,
        sizeId: item.size,
        sizeName: sizePrice.sizeId.name,
        quantity: item.quantity,
        unitPrice: sizePrice.price,
        totalPrice: sizePrice.price * item.quantity,
        specialInstructions: item.specialInstructions || "",
        itemStatus: "pending",
        sizeDetails: {
          name: sizePrice.sizeId.name,
          code: sizePrice.sizeId.code,
        },
      };
    });

    const orderItems = await Promise.all(validationPromises);

    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

    const discountAmount = Number(orderData.discountAmount || 0);
    const taxAmount = Number(orderData.taxAmount || 0);
    const serviceCharge = Number(orderData.serviceCharge || 0);

    let totalAmount = subtotal + taxAmount + serviceCharge - discountAmount;

    if (totalAmount < 0) totalAmount = 0;

    const order = await Order.create({
      orderNumber: `ORD-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`,
      customer: customer._id,
      table: customer.table._id,
      items: orderItems,
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount,
      totalAmount,
      specialInstructions: orderData.specialInstructions || "",
      orderType: "dine-in",
      status: "pending",
    });

    customer.currentOrder = order._id;
    customer.totalOrders = (customer.totalOrders || 0) + 1;
    await customer.save();

    customer.table.currentOrder = order._id;
    await customer.table.save();

    await order.populate("customer", "sessionId name phone email");
    await order.populate("table", "tableNumber tableName capacity location");
    await order.populate(
      "items.menuItem",
      "name description image category tags nutritionalInfo",
    );

    const orderObj = order.toObject();

    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map((item) => {
        if (item.menuItem) {
          item.menuItem = transformMenuItemData(item.menuItem);
        }
        return item;
      });
    }
    socketManager.emitNewOrderToKitchen(orderObj);
    socketManager.emitOrderStatusUpdate(orderObj);

    if (customer.sessionId) {
      logger.info(`Emitting new order to customer: ${customer.sessionId}`);
      socketManager.emitOrderStatusToCustomer(customer.sessionId, orderObj);
      await notifyCustomerSession(
        customer.sessionId,
        `Order #${orderObj.orderNumber || ""} placed`,
        "Your order has been placed successfully.",
        orderObj,
      );
    }

    const kitchenOrder = await kitchenManager.createKitchenOrder(order._id);
    const response = {
      ...orderObj,
      kitchenOrderId: kitchenOrder._id,
    };
    return response;
  } catch (error) {
    throw error;
  }
};

exports.addItemsToOrder = async (orderId, newItems) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "pending" && order.status !== "confirmed") {
      throw new Error("Cannot add items to order in current status");
    }

    const validationPromises = newItems.map(async (item, index) => {
      if (!item.menuItem) {
        throw new Error(
          `Menu item ID is required for new item at index ${index}`,
        );
      }

      if (!item.size) {
        throw new Error(`Size is required for new item at index ${index}`);
      }

      const menuItem = await MenuItem.findOne({
        _id: item.menuItem,
        isActive: true,
        isAvailable: true,
      }).populate("prices.sizeId", "name code");

      if (!menuItem) {
        throw new Error(
          `Menu item not available for new item at index ${index}`,
        );
      }
      const sizePrice = menuItem.prices.find(
        (price) =>
          price.sizeId && price.sizeId._id.toString() === item.size.toString(),
      );

      if (!sizePrice) {
        throw new Error(`Selected size not available for ${menuItem.name}`);
      }

      return {
        menuItem: item.menuItem,
        sizeId: item.size,
        sizeName: sizePrice.sizeId.name,
        quantity: item.quantity,
        unitPrice: sizePrice.price,
        totalPrice: sizePrice.price * item.quantity,
        specialInstructions: item.specialInstructions || "",
        itemStatus: "pending",
        sizeDetails: {
          name: sizePrice.sizeId.name,
          code: sizePrice.sizeId.code,
        },
      };
    });

    const newOrderItems = await Promise.all(validationPromises);

    order.items.push(...newOrderItems);

    order.subtotal = order.items.reduce(
      (total, item) => total + item.totalPrice,
      0,
    );
    order.totalAmount =
      order.subtotal +
      order.taxAmount +
      order.serviceCharge -
      order.discountAmount;

    await order.save();

    await order.populate("items.menuItem", "name description image");
    const orderObj = order.toObject();

    socketManager.emitOrderUpdateToKitchen(orderObj);
    socketManager.emitOrderStatusUpdate(orderObj);

    if (order.customer && order.customer.sessionId) {
      socketManager.emitOrderStatusToCustomer(
        order.customer.sessionId,
        orderObj,
      );
      await notifyCustomerSession(
        order.customer.sessionId,
        `Order #${orderObj.orderNumber || ""} updated`,
        "Your order has been updated.",
        orderObj,
      );
    }
    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map((item) => {
        if (item.menuItem) {
          item.menuItem = transformMenuItemData(item.menuItem);
        }
        return item;
      });
    }

    return orderObj;
  } catch (error) {
    logger.error("Add items to order failed:", error);
    throw error;
  }
};

exports.updateOrderItemQuantity = async (orderId, itemId, newQuantity) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "pending" && order.status !== "confirmed") {
      throw new Error("Cannot modify order in current status");
    }

    const item = order.items.id(itemId);
    if (!item) {
      throw new Error("Order item not found");
    }

    if (newQuantity < 1) {
      order.items.pull(itemId);
    } else {
      item.quantity = newQuantity;
      item.totalPrice = item.unitPrice * newQuantity;
    }

    order.subtotal = order.items.reduce(
      (total, item) => total + item.totalPrice,
      0,
    );
    order.totalAmount =
      order.subtotal +
      order.taxAmount +
      order.serviceCharge -
      order.discountAmount;

    await order.save();

    await order.populate("items.menuItem", "name description image");
    const orderObj = order.toObject();
    socketManager.emitOrderUpdateToKitchen(orderObj);
    socketManager.emitOrderStatusUpdate(orderObj);

    if (order.customer && order.customer.sessionId) {
      socketManager.emitOrderStatusToCustomer(
        order.customer.sessionId,
        orderObj,
      );
      await notifyCustomerSession(
        order.customer.sessionId,
        `Order #${orderObj.orderNumber || ""} updated`,
        "Your order has been updated.",
        orderObj,
      );
    }

    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map((item) => {
        if (item.menuItem) {
          item.menuItem = transformMenuItemData(item.menuItem);
        }
        return item;
      });
    }

    return orderObj;
  } catch (error) {
    logger.error("Update order item quantity failed:", error);
    throw error;
  }
};

exports.removeItemFromOrder = async (orderId, itemId) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "pending" && order.status !== "confirmed") {
      throw new Error("Cannot modify order in current status");
    }

    order.items.pull(itemId);

    order.subtotal = order.items.reduce(
      (total, item) => total + item.totalPrice,
      0,
    );
    order.totalAmount =
      order.subtotal +
      order.taxAmount +
      order.serviceCharge -
      order.discountAmount;

    await order.save();

    await order.populate("items.menuItem", "name description image");
    const orderObj = order.toObject();
    socketManager.emitOrderUpdateToKitchen(orderObj);
    socketManager.emitOrderStatusUpdate(orderObj);

    if (order.customer && order.customer.sessionId) {
      socketManager.emitOrderStatusToCustomer(
        order.customer.sessionId,
        orderObj,
      );
      await notifyCustomerSession(
        order.customer.sessionId,
        `Order #${orderObj.orderNumber || ""} updated`,
        "An item has been removed from your order.",
        orderObj,
      );
    }

    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map((item) => {
        if (item.menuItem) {
          item.menuItem = transformMenuItemData(item.menuItem);
        }
        return item;
      });
    }

    return orderObj;
  } catch (error) {
    logger.error("Remove item from order failed:", error);
    throw error;
  }
};

exports.updateOrderStatus = async (
  orderId,
  newStatus,
  userId = null,
  notes = "",
) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    let userRole = null;

    if (userId) {
      const user = await User.findById(userId).select("role");
      if (!user) {
        throw new Error("User not found");
      }
      userRole = user.role;
    }

    const rolePermissions = {
      chef: [
        "confirmed",
        "preparing",
        "ready",
        "cancelled",
        "served",
        "completed",
      ],
      staff: ["confirmed", "cancelled", "served", "completed"],
      manager: [
        "confirmed",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      admin: [
        "confirmed",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
    };

    if (userRole && rolePermissions[userRole]) {
      if (!rolePermissions[userRole].includes(newStatus)) {
        throw new Error(
          `${userRole} role cannot update status to ${newStatus}`,
        );
      }
    }
    const validTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["served"],
      served: ["completed"],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${order.status} to ${newStatus}`,
      );
    }

    order.status = newStatus;
    order.lastUpdatedBy = userId;
    order.lastUpdatedAt = new Date();

    switch (newStatus) {
      case "confirmed":
        order.orderConfirmedAt = new Date();
        order.confirmedBy = userId;
        break;
      case "preparing":
        order.preparationStartedAt = new Date();
        order.preparedBy = userId;
        break;
      case "ready":
        order.readyAt = new Date();
        order.readyBy = userId;
        break;
      case "served":
        order.servedAt = new Date();
        order.servedBy = userId;
        break;
      case "completed":
        order.orderCompletedAt = new Date();
        order.completedBy = userId;
        break;
      case "cancelled":
        order.cancelledAt = new Date();
        order.cancelledBy = userId;
        order.cancellationReason = notes;
        break;
    }

    await order.save();

    await order.populate("customer", "sessionId name");
    await order.populate("items.menuItem", "name description image");
    await order.populate("table", "tableNumber tableName");

    if (userId) {
      await order.populate("lastUpdatedBy", "name role");
      if (newStatus === "preparing" || newStatus === "ready") {
        await order.populate("preparedBy", "name");
      }
      if (newStatus === "served") {
        await order.populate("servedBy", "name");
      }
    }
    const orderObj = order.toObject();
    orderObj.statusColor = orderStatusColors[orderObj.status];

    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map((item) => {
        const itemObj = {
          ...item,
          sizeName: item.sizeName || null,
          size: item.size || null,
        };

        if (item.menuItem) {
          itemObj.menuItem = transformMenuItemData(item.menuItem);
        }
        return itemObj;
      });
    }

    socketManager.emitOrderStatusUpdate(orderObj);

    if (["confirmed", "preparing", "ready", "cancelled"].includes(newStatus)) {
      socketManager.emitOrderUpdateToKitchen(orderObj);
    }

    if (order.customer && order.customer.sessionId) {
      socketManager.emitOrderStatusToCustomer(
        order.customer.sessionId,
        orderObj,
      );
      await notifyCustomerSession(
        order.customer.sessionId,
        `Order #${orderObj.orderNumber || ""} status`,
        `Your order is now ${String(newStatus || "").replace(/_/g, " ")}.`,
        orderObj,
      );
    }

    return orderObj;
  } catch (error) {
    logger.error("Update order status failed:", error);
    throw error;
  }
};

exports.processPayment = async (orderId, paymentData) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "pending" && order.status !== "served") {
      throw new Error(
        `Payment only allowed for completed orders. Current status: ${order.status}`,
      );
    }
    if (order.paymentStatus === "paid") {
      throw new Error("Order is already paid");
    }

    order.paymentStatus = "paid";
    order.paymentMethod = paymentData.method;
    order.paymentDetails = {
      transactionId: paymentData.transactionId,
      paymentGateway: paymentData.gateway,
      paidAmount: paymentData.amount || order.totalAmount,
      paidAt: new Date(),
    };

    if (order.customer) {
      await Customer.findByIdAndUpdate(order.customer, {
        $inc: { totalSpent: order.totalAmount },
        $set: {
          paymentStatus: "paid",
          sessionStatus: "payment_completed",
        },
      });
    }

    await order.save();

    return order;
  } catch (error) {
    logger.error("Process payment failed:", error);
    throw error;
  }
};

exports.getOrdersByStatus = async (status, page = 1, limit = 20) => {
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const orders = await Order.find({ status })
      .populate("customer", "name sessionId")
      .populate("table", "tableNumber tableName")
      .populate("items.menuItem", "name description image preparationTime")
      .sort({ orderPlacedAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const transformedOrders = orders.map((order) => {
      if (order.items && Array.isArray(order.items)) {
        order.items = order.items.map((item) => {
          if (item.menuItem) {
            item.menuItem = transformMenuItemData(item.menuItem);
          }
          return item;
        });
      }
      return order;
    });

    const total = await Order.countDocuments({ status });

    return {
      orders: transformedOrders,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
      },
    };
  } catch (error) {
    logger.error("Get orders by status failed:", error);
    throw error;
  }
};

exports.getOrdersByTable = async (tableId, status = null) => {
  try {
    let query = { table: tableId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate("customer", "name sessionId")
      .populate("table", "tableNumber tableName")
      .populate("items.menuItem", "name description image")
      .sort({ orderPlacedAt: -1 })
      .lean();

    const transformedOrders = orders.map((order) => {
      if (order.items && Array.isArray(order.items)) {
        order.items = order.items.map((item) => {
          if (item.menuItem) {
            item.menuItem = transformMenuItemData(item.menuItem);
          }
          return item;
        });
      }
      return order;
    });

    return transformedOrders;
  } catch (error) {
    logger.error("Get orders by table failed:", error);
    throw error;
  }
};

exports.getSessionBillSummary = async (sessionId) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    const orders = await Order.find({
      customer: customer._id,
      status: {
        $in: [
          "completed",
          "served",
          "pending",
          "confirmed",
          "preparing",
          "ready",
        ],
      },
    }).sort({ orderPlacedAt: 1 });

    let subtotal = 0;
    let taxAmount = 0;
    let serviceCharge = 0;
    let discountAmount = 0;
    let totalAmount = 0;

    orders.forEach((order) => {
      subtotal += order.subtotal || 0;
      taxAmount += order.taxAmount || 0;
      serviceCharge += order.serviceCharge || 0;
      discountAmount += order.discountAmount || 0;
      totalAmount += order.totalAmount || 0;
    });

    const existingBill = await Bill.findOne({
      sessionId,
      paymentStatus: "pending",
    });

    return {
      session: {
        id: customer._id,
        sessionId: customer.sessionId,
        table: customer.table,
        startTime: customer.sessionStart,
      },
      summary: {
        orderCount: orders.length,
        subtotal,
        taxAmount,
        serviceCharge,
        discountAmount,
        totalAmount,
        itemsCount: orders.reduce(
          (total, order) => total + order.items.length,
          0,
        ),
      },
      hasExistingBill: !!existingBill,
      existingBillId: existingBill?._id,
      canGenerateBill:
        customer.sessionStatus === "active" ||
        customer.sessionStatus === "payment_pending",
    };
  } catch (error) {
    throw error;
  }
};
