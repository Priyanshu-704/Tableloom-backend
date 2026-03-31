/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       required:
 *         - menuItem
 *         - size
 *         - quantity
 *       properties:
 *         _id:
 *           type: string
 *           description: Cart item ID
 *         menuItem:
 *           type: string
 *           description: Menu item ID
 *         size:
 *           type: string
 *           description: Size ID
 *         sizeName:
 *           type: string
 *           description: Size name (e.g., Regular, Large)
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: Item quantity
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *           description: Price per unit
 *         costPrice:
 *           type: number
 *           minimum: 0
 *           description: Cost price per unit
 *         totalPrice:
 *           type: number
 *           minimum: 0
 *           description: Total price (unitPrice * quantity)
 *         specialInstructions:
 *           type: string
 *           maxLength: 200
 *           description: Special instructions for the item
 *         addedAt:
 *           type: string
 *           format: date-time
 *           description: When item was added
 * 
 *     Cart:
 *       type: object
 *       required:
 *         - sessionId
 *         - customer
 *         - table
 *       properties:
 *         _id:
 *           type: string
 *           description: Cart ID
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         customer:
 *           type: string
 *           description: Customer ID
 *         table:
 *           type: string
 *           description: Table ID
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *           description: Items in cart
 *         subtotal:
 *           type: number
 *           minimum: 0
 *           default: 0
 *           description: Subtotal before taxes and charges
 *         taxAmount:
 *           type: number
 *           minimum: 0
 *           default: 0
 *           description: Tax amount
 *         serviceCharge:
 *           type: number
 *           minimum: 0
 *           default: 0
 *           description: Service charge
 *         discountAmount:
 *           type: number
 *           minimum: 0
 *           default: 0
 *           description: Discount amount
 *         itemCount:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *           description: Number of items in cart
 *         totalAmount:
 *           type: number
 *           minimum: 0
 *           description: Total amount (subtotal + tax + service - discount)
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Cart expiration time
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Update timestamp
 * 
 *     AddItemRequest:
 *       type: object
 *       required:
 *         - sessionId
 *         - menuItem
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         menuItem:
 *           type: string
 *           description: Menu item ID to add
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: Item quantity
 *         specialInstructions:
 *           type: string
 *           description: Special instructions for the item
 *         sizeId:
 *           type: string
 *           nullable: true
 *           description: Size ID (if applicable)
 * 
 *     UpdateQuantityRequest:
 *       type: object
 *       required:
 *         - sessionId
 *         - delta
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         sizeId:
 *           type: string
 *           nullable: true
 *           description: Size ID (if applicable)
 *         delta:
 *           type: integer
 *           enum: [1, -1]
 *           description: 1 to increment, -1 to decrement
 * 
 *     RemoveItemRequest:
 *       type: object
 *       required:
 *         - sessionId
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         sizeId:
 *           type: string
 *           nullable: true
 *           description: Size ID (if applicable)
 * 
 *     ClearCartRequest:
 *       type: object
 *       required:
 *         - sessionId
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 * 
 *     ApplyDiscountRequest:
 *       type: object
 *       required:
 *         - sessionId
 *         - discountAmount
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         discountAmount:
 *           type: number
 *           minimum: 0
 *           description: Discount amount to apply
 * 
 *     CheckoutRequest:
 *       type: object
 *       required:
 *         - sessionId
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         specialInstructions:
 *           type: string
 *           description: Special instructions for the entire order
 * 
 *     CartResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Cart Details Fetched Successfully"
 *         data:
 *           $ref: '#/components/schemas/Cart'
 * 
 *     CartSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Item added to cart successfully"
 * 
 *     CheckoutResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Order created successfully from cart"
 *         data:
 *           type: object
 *           description: Created order object
 *           properties:
 *             _id:
 *               type: string
 *             orderNumber:
 *               type: string
 *             status:
 *               type: string
 *               enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *             totalAmount:
 *               type: number
 */