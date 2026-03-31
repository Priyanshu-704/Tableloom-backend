const express = require('express');
const router = express.Router();
const {
  getCart,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
  clearCart,
  applyDiscount,
  checkoutCart,
} = require('../controllers/cartController');


router.get('/', getCart);
router.post('/items', addItemToCart);
router.put('/items/:menuItemId', updateItemQuantity);
router.delete('/items/:menuItemId', removeItemFromCart);
router.delete('/', clearCart);
router.put('/discount', applyDiscount);
router.post('/checkout', checkoutCart);

module.exports = router;