const express = require("express");
const router = express.Router();
const {
  getCart,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
  clearCart,
  applyDiscount,
  checkoutCart,
} = require("../controllers/cartController");
const { protectCustomerSession } = require("../middleware/customerSessionAuth");

router.get("/", protectCustomerSession(), getCart);
router.post(
  "/items",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  addItemToCart,
);
router.put(
  "/items/:menuItemId",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  updateItemQuantity,
);
router.delete(
  "/items/:menuItemId",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  removeItemFromCart,
);
router.delete(
  "/",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  clearCart,
);
router.put(
  "/discount",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  applyDiscount,
);
router.post(
  "/checkout",
  protectCustomerSession({
    field: "sessionId",
    sources: ["body"],
  }),
  checkoutCart,
);
module.exports = router;
