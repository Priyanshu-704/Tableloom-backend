const { logger } = require("./logger.js");
const Cart = require("../models/Cart");
const Coupon = require("../models/Coupon");
const Customer = require("../models/Customer");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const orderManager = require("./orderManager");
const { buildTenantImageAssetUrl } = require("./assetUrl");
const {
  calculatePricingBreakdown,
  getTenantTaxSettings,
} = require("./taxCalculator");
require("dotenv").config({
  quiet: true,
});
const normalizeCartDiscount = (cart) => {
  if (cart.discountAmount > cart.subtotal) {
    cart.discountAmount = Number(cart.itemDiscountAmount || 0);
    cart.couponDiscountAmount = 0;
    cart.appliedCoupon = {
      couponId: null,
      code: "",
      type: "percentage",
      value: 0,
    };
  }
};
const getMenuPriceForSize = (menuItemDoc, sizeId) => {
  if (!menuItemDoc?.prices?.length) {
    return null;
  }
  if (sizeId) {
    return (
      menuItemDoc.prices.find(
        (price) =>
          price?.sizeId &&
          String(price.sizeId._id || price.sizeId) === String(sizeId),
      ) || null
    );
  }
  return menuItemDoc.prices[0] || null;
};
const getActiveMenuDiscount = (menuItemDoc) => {
  if (
    !menuItemDoc?.discount?.isActive ||
    !Number(menuItemDoc?.discount?.value || 0)
  ) {
    return null;
  }
  const now = new Date();
  const startDate = menuItemDoc.discount.startDate
    ? new Date(menuItemDoc.discount.startDate)
    : null;
  const endDate = menuItemDoc.discount.endDate
    ? new Date(menuItemDoc.discount.endDate)
    : null;
  if (startDate && startDate > now) {
    return null;
  }
  if (endDate && endDate < now) {
    return null;
  }
  return menuItemDoc.discount;
};
const calculateDiscountedUnitPrice = (originalPrice, discount) => {
  const basePrice = Number(originalPrice || 0);
  if (!discount || basePrice <= 0) {
    return {
      unitPrice: basePrice,
      unitDiscountAmount: 0,
    };
  }
  let unitDiscountAmount =
    discount.type === "fixed"
      ? Number(discount.value || 0)
      : (basePrice * Number(discount.value || 0)) / 100;
  if (unitDiscountAmount > basePrice) {
    unitDiscountAmount = basePrice;
  }
  return {
    unitPrice: Math.max(basePrice - unitDiscountAmount, 0),
    unitDiscountAmount,
  };
};
const validateCoupon = async (couponCode, subtotalAfterItemDiscounts) => {
  if (!couponCode) {
    return null;
  }
  const coupon = await Coupon.findOne({
    code: String(couponCode).trim().toUpperCase(),
  });
  if (!coupon || !coupon.isCurrentlyValid()) {
    throw new Error("Invalid or expired coupon code");
  }
  if (
    Number(subtotalAfterItemDiscounts || 0) < Number(coupon.minOrderAmount || 0)
  ) {
    throw new Error(
      `Coupon requires a minimum order of ₹${Number(coupon.minOrderAmount || 0).toFixed(2)}`,
    );
  }
  return coupon;
};
const calculateCouponDiscount = (coupon, subtotalAfterItemDiscounts) => {
  if (!coupon) {
    return 0;
  }
  const baseAmount = Number(subtotalAfterItemDiscounts || 0);
  let couponDiscount =
    coupon.type === "fixed"
      ? Number(coupon.value || 0)
      : (baseAmount * Number(coupon.value || 0)) / 100;
  if (coupon.maxDiscountAmount) {
    couponDiscount = Math.min(couponDiscount, Number(coupon.maxDiscountAmount));
  }
  return Math.min(couponDiscount, baseAmount);
};
const buildCartMenuItemMap = async (cart, { activeOnly = true } = {}) => {
  const menuItemIds = [
    ...new Set(
      (cart?.items || [])
        .map((item) => String(item?.menuItem?._id || item?.menuItem || ""))
        .filter(Boolean),
    ),
  ];
  if (menuItemIds.length === 0) {
    return new Map();
  }
  const query = {
    _id: {
      $in: menuItemIds,
    },
  };
  if (activeOnly) {
    query.isActive = true;
  }
  const menuItems = await MenuItem.find(query)
    .select("name image thumbnail prices discount isActive isAvailable")
    .populate("prices.sizeId", "name code")
    .lean();
  return new Map(menuItems.map((item) => [String(item._id), item]));
};
const getTableSummary = async (cart) => {
  if (!cart?.table) {
    return null;
  }
  const existingTableNumber = cart?.table?.tableNumber;
  if (existingTableNumber) {
    return {
      number: cart.table.tableNumber,
      name: cart.table.tableName,
    };
  }
  const table = await Table.findById(cart.table)
    .select("tableNumber tableName")
    .lean();
  if (!table) {
    return null;
  }
  return {
    number: table.tableNumber,
    name: table.tableName,
  };
};
const toPlainId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value?._id) {
    return String(value._id);
  }
  return String(value);
};
const recalculateCartPricing = async (cart, options = {}) => {
  if (!cart) {
    return cart;
  }
  const menuItemMap = options.menuItemMap || (await buildCartMenuItemMap(cart));
  let grossSubtotal = 0;
  let itemDiscountTotal = 0;
  let netSubtotal = 0;
  cart.items = cart.items.map((item) => {
    const menuItemDoc = menuItemMap.get(
      String(item.menuItem._id || item.menuItem),
    );
    if (!menuItemDoc) {
      return item;
    }
    const selectedPrice = getMenuPriceForSize(menuItemDoc, item.sizeId);
    const originalUnitPrice = Number(
      selectedPrice?.price ?? item.originalUnitPrice ?? item.unitPrice ?? 0,
    );
    const activeDiscount = getActiveMenuDiscount(menuItemDoc);
    const { unitPrice, unitDiscountAmount } = calculateDiscountedUnitPrice(
      originalUnitPrice,
      activeDiscount,
    );
    const quantity = Number(item.quantity || 0);
    const itemDiscountAmount = unitDiscountAmount * quantity;
    const totalPrice = unitPrice * quantity;
    grossSubtotal += originalUnitPrice * quantity;
    itemDiscountTotal += itemDiscountAmount;
    netSubtotal += totalPrice;
    item.originalUnitPrice = originalUnitPrice;
    item.unitPrice = unitPrice;
    item.unitDiscountAmount = unitDiscountAmount;
    item.itemDiscountAmount = itemDiscountAmount;
    item.totalPrice = totalPrice;
    item.sizeName = selectedPrice?.sizeId?.name || item.sizeName;
    return item;
  });
  const coupon = await validateCoupon(
    cart.appliedCoupon?.code,
    netSubtotal,
  ).catch(() => {
    if (cart.appliedCoupon?.code) {
      cart.appliedCoupon = {
        couponId: null,
        code: "",
        type: "percentage",
        value: 0,
      };
      cart.couponDiscountAmount = 0;
    }
    return null;
  });
  const couponDiscountAmount = calculateCouponDiscount(coupon, netSubtotal);
  cart.subtotal = grossSubtotal;
  cart.itemDiscountAmount = itemDiscountTotal;
  cart.couponDiscountAmount = couponDiscountAmount;
  cart.discountAmount = itemDiscountTotal + couponDiscountAmount;
  const tenantTaxSettings = await getTenantTaxSettings();
  const pricingBreakdown = calculatePricingBreakdown({
    subtotal: grossSubtotal,
    discountAmount: cart.discountAmount,
    settings: tenantTaxSettings,
  });
  cart.taxAmount = pricingBreakdown.taxAmount;
  cart.taxRate = pricingBreakdown.taxRate;
  cart.taxInclusive = pricingBreakdown.taxInclusive;
  cart.serviceCharge = pricingBreakdown.serviceChargeAmount;
  cart.serviceChargeRate = pricingBreakdown.serviceChargeRate;
  cart.currency = pricingBreakdown.currency;
  cart.currencySymbol = pricingBreakdown.currencySymbol;
  if (coupon) {
    cart.appliedCoupon = {
      couponId: coupon._id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
    };
  } else if (!cart.appliedCoupon?.code) {
    cart.appliedCoupon = {
      couponId: null,
      code: "",
      type: "percentage",
      value: 0,
    };
  }
  normalizeCartDiscount(cart);
  return cart;
};
exports.getOrCreateCart = async (sessionId) => {
  try {
    let cart = await Cart.findOne({
      sessionId,
    });
    let tableSummary = null;
    if (!cart) {
      const customer = await Customer.findOne({
        sessionId,
        isActive: true,
        sessionStatus: "active",
      }).populate("table", "tableNumber tableName");
      if (!customer) {
        throw new Error("Active customer session not found");
      }
      cart = await Cart.create({
        sessionId,
        customer: customer._id,
        table: customer.table._id,
      });
      tableSummary = customer.table
        ? {
            number: customer.table.tableNumber,
            name: customer.table.tableName,
          }
        : null;
    }
    const menuItemMap = await buildCartMenuItemMap(cart);
    await recalculateCartPricing(cart, {
      menuItemMap,
    });
    await cart.save();
    const transformedCart = await transformCartData(cart, {
      menuItemMap,
      tableSummary,
    });
    return transformedCart;
  } catch (error) {
    logger.error("Get or create cart failed:", error);
    throw error;
  }
};
exports.addItemToCart = async (sessionId, itemData) => {
  try {
    const {
      menuItem,
      quantity = 1,
      specialInstructions = "",
      sizeId,
    } = itemData;
    const menuItemDoc = await MenuItem.findOne({
      _id: menuItem,
      isActive: true,
      isAvailable: true,
    }).lean();
    if (!menuItemDoc) {
      throw new Error("Menu item not available");
    }
    if (
      !menuItemDoc.prices ||
      !Array.isArray(menuItemDoc.prices) ||
      menuItemDoc.prices.length === 0
    ) {
      throw new Error("Menu item has no prices configured");
    }
    const populatedMenuItem = await MenuItem.populate(menuItemDoc, {
      path: "prices.sizeId",
      select: "name code",
    });
    const selectedPrice = getMenuPriceForSize(populatedMenuItem, sizeId);
    if (!selectedPrice) {
      throw new Error("Selected size not available for this menu item");
    }
    const activeDiscount = getActiveMenuDiscount(populatedMenuItem);
    const { unitPrice, unitDiscountAmount } = calculateDiscountedUnitPrice(
      selectedPrice.price,
      activeDiscount,
    );
    if (!selectedPrice.sizeId) {
      throw new Error("Size information not available");
    }
    let cart = await Cart.findOne({
      sessionId,
    });
    if (!cart) {
      const customer = await Customer.findOne({
        sessionId,
        isActive: true,
        sessionStatus: "active",
      }).populate("table");
      if (!customer) {
        throw new Error("Active customer session not found");
      }
      cart = await Cart.create({
        sessionId,
        customer: customer._id,
        table: customer.table._id,
      });
    }
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.menuItem.toString() === menuItem &&
        item.sizeId.toString() === selectedPrice.sizeId._id.toString(),
    );
    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].totalPrice =
        cart.items[existingItemIndex].unitPrice *
        cart.items[existingItemIndex].quantity;
    } else {
      cart.items.push({
        menuItem,
        sizeId: selectedPrice.sizeId._id,
        sizeName: selectedPrice.sizeId.name,
        quantity,
        unitPrice,
        originalUnitPrice: selectedPrice.price,
        unitDiscountAmount,
        itemDiscountAmount: unitDiscountAmount * quantity,
        totalPrice: unitPrice * quantity,
        specialInstructions,
        costPrice: selectedPrice.costPrice || 0,
      });
    }
    const menuItemMap = await buildCartMenuItemMap(cart);
    await recalculateCartPricing(cart, {
      menuItemMap,
    });
    normalizeCartDiscount(cart);
    await cart.save();
    return await transformCartData(cart, {
      menuItemMap,
    });
  } catch (error) {
    throw error;
  }
};
exports.incrementItemQuantity = async (
  sessionId,
  menuItemId,
  sizeId = null,
) => {
  try {
    const cart = await Cart.findOne({
      sessionId,
    });
    if (!cart) {
      throw new Error("Cart not found");
    }
    const itemIndex = cart.items.findIndex(
      (item) =>
        String(item.menuItem) === String(menuItemId) &&
        (!sizeId || String(item.sizeId) === String(sizeId)),
    );
    if (itemIndex === -1) {
      throw new Error("Item not found in cart");
    }
    cart.items[itemIndex].quantity += 1;
    const menuItemMap = await buildCartMenuItemMap(cart);
    await recalculateCartPricing(cart, {
      menuItemMap,
    });
    normalizeCartDiscount(cart);
    await cart.save();
    return await transformCartData(cart, {
      menuItemMap,
    });
  } catch (error) {
    logger.error("Increment item quantity failed:", error);
    throw error;
  }
};
exports.decrementItemQuantity = async (
  sessionId,
  menuItemId,
  sizeId = null,
) => {
  try {
    const cart = await Cart.findOne({
      sessionId,
    });
    if (!cart) {
      throw new Error("Cart not found");
    }
    const itemIndex = cart.items.findIndex(
      (item) =>
        String(item.menuItem) === String(menuItemId) &&
        (!sizeId || String(item.sizeId) === String(sizeId)),
    );
    if (itemIndex === -1) {
      throw new Error("Item not found in cart");
    }
    const currentQty = cart.items[itemIndex].quantity;
    if (currentQty <= 1) {
      return await this.removeItemFromCart(sessionId, menuItemId, sizeId);
    }
    cart.items[itemIndex].quantity = currentQty - 1;
    const menuItemMap = await buildCartMenuItemMap(cart);
    await recalculateCartPricing(cart, {
      menuItemMap,
    });
    normalizeCartDiscount(cart);
    await cart.save();
    return await transformCartData(cart, {
      menuItemMap,
    });
  } catch (error) {
    logger.error("Decrement item quantity failed:", error);
    throw error;
  }
};
exports.removeItemFromCart = async (sessionId, menuItemId, sizeId = null) => {
  try {
    const cart = await Cart.findOne({
      sessionId,
    });
    if (!cart) {
      throw new Error("Cart not found");
    }
    cart.items = cart.items.filter((item) => {
      const isMenuItemMatch = String(item.menuItem) === String(menuItemId);
      const isSizeMatch = !sizeId || String(item.sizeId) === String(sizeId);
      return !(isMenuItemMatch && isSizeMatch);
    });
    const menuItemMap = await buildCartMenuItemMap(cart);
    await recalculateCartPricing(cart, {
      menuItemMap,
    });
    normalizeCartDiscount(cart);
    await cart.save();
    return await transformCartData(cart, {
      menuItemMap,
    });
  } catch (error) {
    logger.error("Remove item from cart failed:", error);
    throw error;
  }
};
exports.clearCart = async (sessionId) => {
  try {
    const cart = await Cart.findOne({
      sessionId,
    });
    if (!cart) {
      throw new Error("Cart not found");
    }
    cart.items = [];
    cart.discountAmount = 0;
    cart.itemDiscountAmount = 0;
    cart.couponDiscountAmount = 0;
    cart.taxAmount = 0;
    cart.taxRate = cart.taxRate || 0;
    cart.taxInclusive = Boolean(cart.taxInclusive);
    cart.serviceCharge = 0;
    cart.serviceChargeRate = cart.serviceChargeRate || 0;
    cart.appliedCoupon = {
      couponId: null,
      code: "",
      type: "percentage",
      value: 0,
    };
    normalizeCartDiscount(cart);
    await cart.save();
    return await transformCartData(cart, {
      menuItemMap: new Map(),
    });
  } catch (error) {
    logger.error("Clear cart failed:", error);
    throw error;
  }
};
exports.applyDiscount = async (
  sessionId,
  _discountAmount,
  discountCode = "",
) => {
  try {
    const cart = await Cart.findOne({
      sessionId,
    });
    if (!cart) {
      throw new Error("Cart not found");
    }
    if (!String(discountCode || "").trim()) {
      throw new Error("Coupon code is required");
    }
    const previousCouponCode = String(cart.appliedCoupon?.code || "")
      .trim()
      .toUpperCase();
    await recalculateCartPricing(cart);
    const normalizedCode = String(discountCode).trim().toUpperCase();
    const subtotalAfterItemDiscounts = Math.max(
      Number(cart.subtotal || 0) - Number(cart.itemDiscountAmount || 0),
      0,
    );
    await validateCoupon(normalizedCode, subtotalAfterItemDiscounts);
    cart.appliedCoupon = {
      couponId: null,
      code: normalizedCode,
      type: "percentage",
      value: 0,
    };
    await recalculateCartPricing(cart);
    normalizeCartDiscount(cart);
    await cart.save();
    return {
      previousCouponCode,
      appliedCoupon: cart.appliedCoupon?.code
        ? {
            code: cart.appliedCoupon.code,
            type: cart.appliedCoupon.type,
            value: cart.appliedCoupon.value,
          }
        : null,
    };
  } catch (error) {
    logger.error("Apply discount failed:", error);
    throw error;
  }
};
exports.convertCartToOrder = async (sessionId, orderData = {}) => {
  try {
    const cart = await Cart.findOne({
      sessionId,
    })
      .populate("customer")
      .populate("table");
    if (!cart) {
      throw new Error("Cart not found");
    }
    if (cart.items.length === 0) {
      throw new Error("Cart is empty");
    }
    const menuItemIds = [
      ...new Set(cart.items.map((item) => String(item.menuItem))),
    ];
    const availableItems = await MenuItem.find({
      _id: {
        $in: menuItemIds,
      },
      isActive: true,
      isAvailable: true,
    }).populate("prices.sizeId");
    if (availableItems.length !== menuItemIds.length) {
      throw new Error("Some items in cart are no longer available");
    }
    for (const cartItem of cart.items) {
      const menuItem = availableItems.find(
        (item) => item._id.toString() === cartItem.menuItem.toString(),
      );
      if (menuItem) {
        const sizeAvailable = menuItem.prices.some(
          (price) =>
            price.sizeId &&
            price.sizeId._id.toString() === cartItem.sizeId.toString(),
        );
        if (!sizeAvailable) {
          throw new Error(`Size not available for ${menuItem.name}`);
        }
      }
    }
    await recalculateCartPricing(cart);
    const order = await orderManager.createOrder(sessionId, {
      items: cart.items.map((item) => {
        if (typeof item.unitPrice !== "number") {
          throw new Error("Invalid item price in cart");
        }
        return {
          menuItem: item.menuItem,
          size: item.sizeId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
          specialInstructions: item.specialInstructions,
        };
      }),
      specialInstructions: orderData.specialInstructions,
      discountAmount: cart.discountAmount,
    });
    await this.clearCart(sessionId);
    return order;
  } catch (error) {
    throw error;
  }
};
const transformCartData = async (cart, options = {}) => {
  if (!cart) return null;
  const menuItemMap =
    options.menuItemMap ||
    (await buildCartMenuItemMap(cart, {
      activeOnly: false,
    }));
  const tableSummary = options.tableSummary || (await getTableSummary(cart));
  const summary = {
    itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: cart.subtotal,
    tax: cart.taxAmount || 0,
    taxAmount: cart.taxAmount || 0,
    taxRate: cart.taxRate || 0,
    taxInclusive: Boolean(cart.taxInclusive),
    deliveryFee: cart.serviceCharge || 0,
    serviceCharge: cart.serviceCharge || 0,
    serviceChargeRate: cart.serviceChargeRate || 0,
    discount: cart.discountAmount || 0,
    itemDiscount: cart.itemDiscountAmount || 0,
    couponDiscount: cart.couponDiscountAmount || 0,
    currency: cart.currency || "INR",
    currencySymbol: cart.currencySymbol || "₹",
    appliedCoupon: cart.appliedCoupon?.code
      ? {
          code: cart.appliedCoupon.code,
          type: cart.appliedCoupon.type,
          value: cart.appliedCoupon.value,
        }
      : null,
    total: cart.totalAmount,
  };
  return {
    table: tableSummary,
    summary,
    items: cart.items.map((item) => ({
      menuItemId: toPlainId(item.menuItem?._id || item.menuItem),
      sizeId: toPlainId(item.sizeId),
      name:
        menuItemMap.get(String(item.menuItem?._id || item.menuItem))?.name ||
        item.menuItem?.name ||
        "Menu item",
      image:
        menuItemMap.get(String(item.menuItem?._id || item.menuItem))?.image ||
        menuItemMap.get(String(item.menuItem?._id || item.menuItem))?.thumbnail
          ? buildTenantImageAssetUrl(
              null,
              `/images/menu-item/${item.menuItem?._id || item.menuItem}`,
            )
          : null,
      thumbnail:
        menuItemMap.get(String(item.menuItem?._id || item.menuItem))?.image ||
        menuItemMap.get(String(item.menuItem?._id || item.menuItem))?.thumbnail
          ? buildTenantImageAssetUrl(
              null,
              `/images/menu-item/${item.menuItem?._id || item.menuItem}`,
              {
                variant: "thumbnail",
              },
            )
          : null,
      _id: item._id,
      size: item.sizeName || "",
      sizeName: item.sizeName || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      originalUnitPrice: Number(item.originalUnitPrice || item.unitPrice || 0),
      unitDiscountAmount: Number(item.unitDiscountAmount || 0),
      itemDiscountAmount: Number(item.itemDiscountAmount || 0),
      totalPrice: Number(item.totalPrice || 0),
      instructions: item.specialInstructions || "",
    })),
  };
};
