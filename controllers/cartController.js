const { logger } = require("./../utils/logger.js");
const cartManager = require("../utils/cartManager");
exports.getCart = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }
    const cart = await cartManager.getOrCreateCart(sessionId);
    res.status(200).json({
      success: true,
      message: "Cart Details Fetched Successfully",
      data: cart,
    });
  } catch (error) {
    logger.error(error);
    if (error.message.includes("Active customer session not found")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to get cart",
      error: error.message,
    });
  }
};
exports.addItemToCart = async (req, res) => {
  try {
    const { sessionId, menuItem, quantity, specialInstructions, sizeId, size } =
      req.body;
    const normalizedSizeId = sizeId || size || null;
    if (!sessionId || !menuItem) {
      return res.status(400).json({
        success: false,
        message: "Session ID and menu item are required",
      });
    }
    const cart = await cartManager.addItemToCart(sessionId, {
      menuItem,
      quantity: quantity || 1,
      specialInstructions: specialInstructions || "",
      sizeId: normalizedSizeId,
    });
    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: cart,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Cart not found") ||
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
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};
exports.updateItemQuantity = async (req, res) => {
  try {
    const { sessionId, sizeId, size, delta } = req.body;
    const { menuItemId } = req.params;
    const normalizedSizeId = sizeId || size || null;
    const normalizedDelta = Number(delta);
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }
    if (![1, -1].includes(normalizedDelta)) {
      return res.status(400).json({
        success: false,
        message: "Delta must be 1 (increment) or -1 (decrement)",
      });
    }
    if (normalizedDelta === 1) {
      const cart = await cartManager.incrementItemQuantity(
        sessionId,
        menuItemId,
        normalizedSizeId,
      );
      return res.status(200).json({
        success: true,
        message: "Item quantity incremented successfully",
        data: cart,
      });
    } else {
      const cart = await cartManager.decrementItemQuantity(
        sessionId,
        menuItemId,
        normalizedSizeId,
      );
      return res.status(200).json({
        success: true,
        message: "Item quantity decremented successfully",
        data: cart,
      });
    }
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Cart not found") ||
      error.message.includes("Item not found in cart")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to update item quantity",
      error: error.message,
    });
  }
};
exports.removeItemFromCart = async (req, res) => {
  try {
    const { sessionId, sizeId, size } = req.body;
    const { menuItemId } = req.params;
    const normalizedSizeId = sizeId || size || null;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }
    const cart = await cartManager.removeItemFromCart(
      sessionId,
      menuItemId,
      normalizedSizeId,
    );
    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      data: cart,
    });
  } catch (error) {
    logger.error(error);
    if (error.message.includes("Cart not found")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart",
      error: error.message,
    });
  }
};
exports.clearCart = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }
    const cart = await cartManager.clearCart(sessionId);
    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    logger.error(error);
    if (error.message.includes("Cart not found")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};
exports.applyDiscount = async (req, res) => {
  try {
    const { sessionId, discountAmount, discountCode } = req.body;
    if (!sessionId || (!discountCode && discountAmount === undefined)) {
      return res.status(400).json({
        success: false,
        message: "Session ID and coupon code are required",
      });
    }
    const result = await cartManager.applyDiscount(
      sessionId,
      parseFloat(discountAmount || 0),
      discountCode,
    );
    const replacedCoupon =
      result?.previousCouponCode &&
      result?.appliedCoupon?.code &&
      result.previousCouponCode !== result.appliedCoupon.code;
    res.status(200).json({
      success: true,
      message: replacedCoupon
        ? "Coupon replaced successfully"
        : "Coupon applied successfully",
      data: result || null,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Cart not found") ||
      error.message.includes("Invalid") ||
      error.message.includes("Coupon") ||
      error.message.includes("minimum order")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to apply discount",
      error: error.message,
    });
  }
};
exports.checkoutCart = async (req, res) => {
  try {
    const { sessionId, specialInstructions } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }
    const order = await cartManager.convertCartToOrder(sessionId, {
      specialInstructions,
    });
    res.status(201).json({
      success: true,
      message: "Order created successfully from cart",
      data: order,
    });
  } catch (error) {
    logger.error(error);
    if (
      error.message.includes("Cart not found") ||
      error.message.includes("Cart is empty") ||
      error.message.includes("Some items in cart are no longer available")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to checkout cart",
      error: error.message,
    });
  }
};
