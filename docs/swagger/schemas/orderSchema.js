/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       required:
 *         - menuItem
 *         - quantity
 *         - unitPrice
 *         - totalPrice
 *       properties:
 *         _id:
 *           type: string
 *           description: Order item ID
 *         menuItem:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             description:
 *               type: string
 *             image:
 *               type: string
 *               nullable: true
 *             category:
 *               type: string
 *             tags:
 *               type: array
 *               items:
 *                 type: string
 *             nutritionalInfo:
 *               type: object
 *               properties:
 *                 calories:
 *                   type: number
 *                 protein:
 *                   type: number
 *                 carbs:
 *                   type: number
 *                 fat:
 *                   type: number
 *             allergens:
 *               type: array
 *               items:
 *                 type: string
 *             ingredients:
 *               type: array
 *               items:
 *                 type: string
 *         size:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             code:
 *               type: string
 *         sizeName:
 *           type: string
 *           nullable: true
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *         totalPrice:
 *           type: number
 *           minimum: 0
 *         specialInstructions:
 *           type: string
 *           nullable: true
 *         itemStatus:
 *           type: string
 *           enum: [pending, preparing, ready, served, cancelled]
 *           default: pending
 * 
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Order ID
 *         orderNumber:
 *           type: string
 *           description: Unique order number
 *         customer:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             sessionId:
 *               type: string
 *             name:
 *               type: string
 *             phone:
 *               type: string
 *             email:
 *               type: string
 *         table:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             tableNumber:
 *               type: string
 *             tableName:
 *               type: string
 *             capacity:
 *               type: integer
 *             location:
 *               type: string
 *         status:
 *           type: string
 *           enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *           description: Order status
 *         orderType:
 *           type: string
 *           enum: [dine-in, takeaway, delivery]
 *           default: dine-in
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         subtotal:
 *           type: number
 *           minimum: 0
 *         taxAmount:
 *           type: number
 *           default: 0
 *         discountAmount:
 *           type: number
 *           default: 0
 *         serviceCharge:
 *           type: number
 *           default: 0
 *         totalAmount:
 *           type: number
 *           minimum: 0
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *           default: pending
 *         paymentMethod:
 *           type: string
 *           enum: [cash, card, online]
 *           default: cash
 *         paymentDetails:
 *           type: object
 *           nullable: true
 *           properties:
 *             transactionId:
 *               type: string
 *             paymentGateway:
 *               type: string
 *             paidAmount:
 *               type: number
 *             paidAt:
 *               type: string
 *               format: date-time
 *         specialInstructions:
 *           type: string
 *           nullable: true
 *         preparationTime:
 *           type: integer
 *           description: Preparation time in minutes
 *         estimatedReadyTime:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         orderPlacedAt:
 *           type: string
 *           format: date-time
 *         orderConfirmedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         orderCompletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         cancelledAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         cancelledBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         cancellationReason:
 *           type: string
 *           nullable: true
 *         createdBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         confirmedBy:
 *           type: string
 *           nullable: true
 *         preparedBy:
 *           type: string
 *           nullable: true
 *         readyBy:
 *           type: string
 *           nullable: true
 *         servedBy:
 *           type: string
 *           nullable: true
 *         completedBy:
 *           type: string
 *           nullable: true
 *         hasFeedback:
 *           type: boolean
 *           default: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     PaymentRequest:
 *       type: object
 *       required:
 *         - method
 *       properties:
 *         method:
 *           type: string
 *           enum: [cash, card, online]
 *           description: Payment method
 *         transactionId:
 *           type: string
 *           description: Transaction reference ID
 *         gateway:
 *           type: string
 *           description: Payment gateway name
 *         amount:
 *           type: number
 *           description: Payment amount (if different from total)
 * 
 *     StatusUpdateRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *           description: New order status
 *         notes:
 *           type: string
 *           description: Additional notes for status update
 * 
 *     OrderStatistics:
 *       type: object
 *       properties:
 *         totalOrders:
 *           type: integer
 *           description: Total number of orders
 *         pendingOrders:
 *           type: integer
 *           description: Orders pending or confirmed
 *         preparingOrders:
 *           type: integer
 *           description: Orders being prepared
 *         todayOrders:
 *           type: integer
 *           description: Orders placed today
 *         todayRevenue:
 *           type: number
 *           description: Revenue generated today
 *         statusCounts:
 *           type: object
 *           properties:
 *             pending:
 *               type: integer
 *             confirmed:
 *               type: integer
 *             preparing:
 *               type: integer
 *             ready:
 *               type: integer
 *             served:
 *               type: integer
 *             completed:
 *               type: integer
 *             cancelled:
 *               type: integer
 *         popularItems:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               size:
 *                 type: string
 *               totalQuantity:
 *                 type: integer
 *               totalRevenue:
 *                 type: number
 * 
 *     OrdersListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         count:
 *           type: integer
 *         total:
 *           type: integer
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             pages:
 *               type: integer
 *         statistics:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *             totalPaidOrders:
 *               type: integer
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Order'
 * 
 *     OrderFilters:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, confirmed, preparing, ready, served, completed, cancelled]
 *           description: Filter by order status
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *           description: Filter by payment status
 *         startDate:
 *           type: string
 *           format: date
 *           description: Filter orders from this date
 *         endDate:
 *           type: string
 *           format: date
 *           description: Filter orders until this date
 *         table:
 *           type: string
 *           description: Filter by table ID
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 */
