require("dotenv").config({
  quiet: true,
});
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const KitchenOrder = require("../models/KitchenOrder");
require("../models/Size");
const getBaselineTime = (order = {}) =>
  order.preparationStartedAt ||
  order.orderConfirmedAt ||
  order.orderPlacedAt ||
  order.createdAt ||
  new Date();
const buildComparableItems = (orders = []) =>
  orders.flatMap((order = {}) =>
    (order.items || []).map((item = {}) => ({
      menuItem: item.menuItem?._id || item.menuItem || null,
      name: item.menuItem?.name || item.name || "Menu item",
      size: item.sizeName || item.sizeId?.name || item.size?.name || "Regular",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),
    })),
  );
async function backfillMenuItemPreparationTimes() {
  const result = await MenuItem.updateMany(
    {
      $or: [
        {
          preparationTime: {
            $exists: false,
          },
        },
        {
          preparationTime: null,
        },
        {
          preparationTime: {
            $lt: 1,
          },
        },
      ],
    },
    {
      $set: {
        preparationTime: 15,
      },
    },
  );
  console.log(`[migration] menu items updated: ${result.modifiedCount || 0}`);
}
async function backfillOrders() {
  const orders = await Order.find({})
    .select(
      "_id customer sessionId items preparationTime estimatedReadyTime orderPlacedAt createdAt orderConfirmedAt preparationStartedAt",
    )
    .lean();
  const customerIds = [
    ...new Set(
      orders.map((order) => String(order.customer || "")).filter(Boolean),
    ),
  ];
  const menuItemIds = [
    ...new Set(
      orders.flatMap((order) =>
        (order.items || [])
          .map((item) => String(item.menuItem || ""))
          .filter(Boolean),
      ),
    ),
  ];
  const [customers, menuItems] = await Promise.all([
    Customer.find({
      _id: {
        $in: customerIds,
      },
    })
      .select("_id sessionId")
      .lean(),
    MenuItem.find({
      _id: {
        $in: menuItemIds,
      },
    })
      .select("_id preparationTime")
      .lean(),
  ]);
  const customerSessionById = new Map(
    customers.map((customer) => [
      String(customer._id),
      customer.sessionId || "",
    ]),
  );
  const prepTimeByMenuItemId = new Map(
    menuItems.map((item) => [
      String(item._id),
      Math.max(1, Number(item.preparationTime || 15)),
    ]),
  );
  let updatedCount = 0;
  for (const order of orders) {
    const nextSessionId =
      order.sessionId ||
      customerSessionById.get(String(order.customer || "")) ||
      "";
    const nextPreparationTime = Math.max(
      1,
      ...(order.items || []).map(
        (item) => prepTimeByMenuItemId.get(String(item.menuItem || "")) || 15,
      ),
    );
    const baselineTime = new Date(getBaselineTime(order));
    const nextEstimatedReadyTime = new Date(
      baselineTime.getTime() + nextPreparationTime * 60000,
    );
    const shouldUpdate =
      !order.sessionId ||
      Number(order.preparationTime || 0) < 1 ||
      !order.estimatedReadyTime;
    if (!shouldUpdate) {
      continue;
    }
    await Order.updateOne(
      {
        _id: order._id,
      },
      {
        $set: {
          ...(nextSessionId
            ? {
                sessionId: nextSessionId,
              }
            : {}),
          preparationTime: nextPreparationTime,
          estimatedReadyTime: nextEstimatedReadyTime,
        },
      },
    );
    updatedCount += 1;
  }
  console.log(`[migration] orders updated: ${updatedCount}`);
}
async function backfillKitchenOrders() {
  const kitchenOrders = await KitchenOrder.find({})
    .select("_id items timers")
    .lean();
  const menuItemIds = [
    ...new Set(
      kitchenOrders.flatMap((order) =>
        (order.items || [])
          .map((item) => String(item.menuItem || ""))
          .filter(Boolean),
      ),
    ),
  ];
  const menuItems = await MenuItem.find({
    _id: {
      $in: menuItemIds,
    },
  })
    .select("_id preparationTime")
    .lean();
  const prepTimeByMenuItemId = new Map(
    menuItems.map((item) => [
      String(item._id),
      Math.max(1, Number(item.preparationTime || 15)),
    ]),
  );
  let updatedCount = 0;
  for (const kitchenOrder of kitchenOrders) {
    let changed = false;
    const nextItems = (kitchenOrder.items || []).map((item) => {
      const currentPreparationTime = Number(item.preparationTime || 0);
      const nextPreparationTime =
        currentPreparationTime >= 1
          ? currentPreparationTime
          : prepTimeByMenuItemId.get(String(item.menuItem || "")) || 15;
      const baseTime =
        item.startTime ||
        kitchenOrder.timers?.startedCooking ||
        kitchenOrder.timers?.kitchenAccepted ||
        kitchenOrder.timers?.orderReceived ||
        new Date();
      const estimatedCompletion =
        item.estimatedCompletion ||
        new Date(new Date(baseTime).getTime() + nextPreparationTime * 60000);
      if (
        Number(item.preparationTime || 0) < 1 ||
        !item.estimatedCompletion ||
        !item.delayStatus
      ) {
        changed = true;
      }
      return {
        ...item,
        preparationTime: nextPreparationTime,
        estimatedCompletion,
        delayStatus: item.delayStatus || "on_time",
        delayColor: item.delayColor || "#4CAF50",
        delayMinutes: Math.max(0, Number(item.delayMinutes || 0)),
        lastDelayCheck: item.lastDelayCheck || new Date(),
      };
    });
    if (!changed) {
      continue;
    }
    await KitchenOrder.updateOne(
      {
        _id: kitchenOrder._id,
      },
      {
        $set: {
          items: nextItems,
        },
      },
    );
    updatedCount += 1;
  }
  console.log(`[migration] kitchen orders updated: ${updatedCount}`);
}
async function syncPendingBills() {
  const pendingBills = await Bill.find({
    paymentStatus: "pending",
    billStatus: {
      $in: ["draft", "sent", "viewed"],
    },
  })
    .select(
      "_id customerId sessionId subtotal taxAmount serviceCharge discountAmount totalAmount metadata",
    )
    .lean();
  let updatedCount = 0;
  for (const bill of pendingBills) {
    let customerId = bill.customerId;
    if (!customerId && bill.sessionId) {
      const customer = await Customer.findOne({
        sessionId: bill.sessionId,
      })
        .select("_id")
        .lean();
      customerId = customer?._id || null;
    }
    if (!customerId) {
      continue;
    }
    const orders = await Order.find({
      customer: customerId,
      paymentStatus: {
        $ne: "paid",
      },
    })
      .populate("items.menuItem", "name")
      .populate("items.sizeId", "name")
      .sort({
        orderPlacedAt: 1,
      })
      .lean();
    if (orders.length === 0) {
      continue;
    }
    const nextData = {
      subtotal: orders.reduce(
        (sum, order) => sum + Number(order.subtotal || 0),
        0,
      ),
      taxAmount: orders.reduce(
        (sum, order) => sum + Number(order.taxAmount || 0),
        0,
      ),
      serviceCharge: orders.reduce(
        (sum, order) => sum + Number(order.serviceCharge || 0),
        0,
      ),
      discountAmount: orders.reduce(
        (sum, order) => sum + Number(order.discountAmount || 0),
        0,
      ),
      totalAmount: orders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0,
      ),
      items: buildComparableItems(orders),
      metadata: {
        ...(bill.metadata || {}),
        orderCount: orders.length,
        orderIds: orders.map((order) => String(order._id)),
        orderNumbers: orders.map((order) => order.orderNumber || ""),
        lastSyncedAt: new Date(),
      },
    };
    const changed =
      Number(bill.subtotal || 0) !== nextData.subtotal ||
      Number(bill.taxAmount || 0) !== nextData.taxAmount ||
      Number(bill.serviceCharge || 0) !== nextData.serviceCharge ||
      Number(bill.discountAmount || 0) !== nextData.discountAmount ||
      Number(bill.totalAmount || 0) !== nextData.totalAmount;
    if (!changed) {
      continue;
    }
    await Bill.updateOne(
      {
        _id: bill._id,
      },
      {
        $set: nextData,
      },
    );
    updatedCount += 1;
  }
  console.log(`[migration] pending bills updated: ${updatedCount}`);
}
async function run() {
  try {
    await connectDB();
    await backfillMenuItemPreparationTimes();
    await backfillOrders();
    await backfillKitchenOrders();
    await syncPendingBills();
    console.log("[migration] completed successfully");
  } catch (error) {
    console.error("[migration] failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}
run();
