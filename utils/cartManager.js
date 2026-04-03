const { logger } = require("./logger.js");
const Cart = require("../models/Cart");
const Coupon = require("../models/Coupon");
const Customer = require("../models/Customer");
const MenuItem = require("../models/MenuItem");
const orderManager = require("./orderManager");
const { buildTenantAssetUrl } = require("./assetUrl");
const {
  calculatePricingBreakdown,
  getTenantTaxSettings,
} = require("./taxCalculator");
require("dotenv").config({ quiet: true });

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
  if (!menuItemDoc?.discount?.isActive || !Number(menuItemDoc?.discount?.value || 0)) {
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

  const coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase() });

  if (!coupon || !coupon.isCurrentlyValid()) {
    throw new Error("Invalid or expired coupon code");
  }

  if (Number(subtotalAfterItemDiscounts || 0) < Number(coupon.minOrderAmount || 0)) {
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

const recalculateCartPricing = async (cart) => {
  if (!cart) {
    return cart;
  }

  const menuItemIds = cart.items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find({
    _id: { $in: menuItemIds },
    isActive: true,
  })
    .populate("prices.sizeId", "name code")
    .lean();

  const menuItemMap = new Map(menuItems.map((item) => [String(item._id), item]));

  let grossSubtotal = 0;
  let itemDiscountTotal = 0;
  let netSubtotal = 0;

  cart.items = cart.items.map((item) => {
    const menuItemDoc = menuItemMap.get(String(item.menuItem._id || item.menuItem));

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

  const coupon = await validateCoupon(cart.appliedCoupon?.code, netSubtotal).catch(() => {
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

// Get or create cart for customer session
exports.getOrCreateCart = async (sessionId) => {
  try {
    let cart = await Cart.findOne({ sessionId })
      .populate(
        "items.menuItem",
        "name description prices image isAvailable isActive",
      )
      .populate("table", "tableNumber tableName");

    if (!cart) {
      // Get customer session to create cart
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

      await cart.populate(
        "items.menuItem",
        "name description prices image isAvailable isActive",
      );
      await cart.populate("table", "tableNumber tableName");
    }

    await recalculateCartPricing(cart);
    await cart.save();

    const transformedCart = transformCartData(cart);

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

    let cart = await Cart.findOne({ sessionId });

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
      // Update existing item quantity
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].totalPrice =
        cart.items[existingItemIndex].unitPrice *
        cart.items[existingItemIndex].quantity;
    } else {
      // Add new item
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

    await recalculateCartPricing(cart);
    normalizeCartDiscount(cart);
    await cart.save();
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
    const cart = await Cart.findOne({ sessionId })
      .populate(
        "items.menuItem",
        "name description prices image isAvailable isActive",
      )
      .populate("table", "tableNumber tableName");

    if (!cart) {
      throw new Error("Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.menuItem._id.toString() === menuItemId &&
        (!sizeId || item.sizeId.toString() === sizeId), // FIXED: use sizeId
    );

    if (itemIndex === -1) {
      throw new Error("Item not found in cart");
    }

    cart.items[itemIndex].quantity += 1;
    await recalculateCartPricing(cart);
    normalizeCartDiscount(cart);
    await cart.save();

    return transformCartData(cart);
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
    const cart = await Cart.findOne({ sessionId })
      .populate(
        "items.menuItem",
        "name description prices image isAvailable isActive",
      )
      .populate("table", "tableNumber tableName");

    if (!cart) {
      throw new Error("Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.menuItem._id.toString() === menuItemId &&
        (!sizeId || item.sizeId.toString() === sizeId), // FIXED: use sizeId
    );

    if (itemIndex === -1) {
      throw new Error("Item not found in cart");
    }

    const currentQty = cart.items[itemIndex].quantity;

    if (currentQty <= 1) {
      return await this.removeItemFromCart(sessionId, menuItemId, sizeId);
    }

    cart.items[itemIndex].quantity = currentQty - 1;
    await recalculateCartPricing(cart);
    normalizeCartDiscount(cart);
    await cart.save();

    return transformCartData(cart);
  } catch (error) {
    logger.error("Decrement item quantity failed:", error);
    throw error;
  }
};

exports.removeItemFromCart = async (sessionId, menuItemId, sizeId = null) => {
  try {
    const cart = await Cart.findOne({ sessionId })
      .populate(
        "items.menuItem",
        "name description prices image isAvailable isActive",
      )
      .populate("table", "tableNumber tableName");

    if (!cart) {
      throw new Error("Cart not found");
    }

    // Fixed filter logic
    cart.items = cart.items.filter((item) => {
      const isMenuItemMatch = item.menuItem._id.toString() === menuItemId;
      const isSizeMatch = !sizeId || item.sizeId.toString() === sizeId; // FIXED: use sizeId
      return !(isMenuItemMatch && isSizeMatch);
    });

    await recalculateCartPricing(cart);
    normalizeCartDiscount(cart);
    await cart.save();

    return transformCartData(cart);
  } catch (error) {
    logger.error("Remove item from cart failed:", error);
    throw error;
  }
};

// Clear cart (remove all items)
exports.clearCart = async (sessionId) => {
  try {
    const cart = await Cart.findOne({ sessionId });

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
  } catch (error) {
    logger.error("Clear cart failed:", error);
    throw error;
  }
};

// Apply discount to cart
exports.applyDiscount = async (sessionId, _discountAmount, discountCode = "") => {
  try {
    const cart = await Cart.findOne({ sessionId });

    if (!cart) {
      throw new Error("Cart not found");
    }

    if (!String(discountCode || "").trim()) {
      throw new Error("Coupon code is required");
    }

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
  } catch (error) {
    logger.error("Apply discount failed:", error);
    throw error;
  }
};

exports.convertCartToOrder = async (sessionId, orderData = {}) => {
  try {
    const cart = await Cart.findOne({ sessionId })
      .populate("customer")
      .populate("table");

    if (!cart) {
      throw new Error("Cart not found");
    }

    if (cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    const menuItemIds = cart.items.map((item) => item.menuItem);
    const availableItems = await MenuItem.find({
      _id: { $in: menuItemIds },
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
// Helper function to transform cart data with image URLs
// const transformCartData = (cart) => {
//   if (!cart) return null;

//   const baseUrl = getBaseUrl();
//   const groupedItemsMap = new Map();

//   for (const item of cart.items) {
//     const key = [
//       item.menuItem._id.toString(),
//       item.sizeName,
//       item.unitPrice,
//       item.specialInstructions || "",
//     ].join("|");

//     if (!groupedItemsMap.has(key)) {
//       groupedItemsMap.set(key, {
//         _id: item.menuItem._id,
//         name: item.menuItem.name,
//         image: item.menuItem.image
//           ? `${baseUrl}/images/menu-item/${item.menuItem._id}`
//           : null,
//         size: item.sizeName,
//         quantity: item.quantity,
//         unitPrice: item.unitPrice,
//         totalPrice: item.totalPrice,
//         instructions: item.specialInstructions || "",
//       });
//     } else {
//       const existing = groupedItemsMap.get(key);
//       existing.quantity += item.quantity;
//       existing.totalPrice += item.totalPrice;
//     }
//   }

//   return {
//     table: cart.table
//       ? {
//           number: cart.table.tableNumber,
//           name: cart.table.tableName,
//         }
//       : null,

//     summary: {
//       itemCount: [...groupedItemsMap.values()].reduce(
//         (sum, i) => sum + i.quantity,
//         0,
//       ),
//       subtotal: cart.subtotal,
//       discount: cart.discountAmount || 0,
//       total: cart.totalAmount,
//     },

//     items: Array.from(groupedItemsMap.values()),
//   };
// };

const transformCartData = (cart) => {
  if (!cart) return null;

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
    table: cart.table
      ? {
          number: cart.table.tableNumber,
          name: cart.table.tableName,
        }
      : null,

    summary,

    items: cart.items.map((item) => ({
      _id: item._id,
      menuItemId: item.menuItem._id,
      sizeId: item.sizeId,
      name: item.menuItem.name,
      image: item.menuItem.image
        ? buildTenantAssetUrl(null, `/images/menu-item/${item.menuItem._id}`)
        : null,
      size: item.sizeName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      originalUnitPrice: item.originalUnitPrice || item.unitPrice,
      unitDiscountAmount: item.unitDiscountAmount || 0,
      itemDiscountAmount: item.itemDiscountAmount || 0,
      totalPrice: item.totalPrice,
      instructions: item.specialInstructions || "",
    })),
  };
};
