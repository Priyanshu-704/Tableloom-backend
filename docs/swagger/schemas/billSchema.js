/**
 * @swagger
 * components:
 *   schemas:
 *     BillItem:
 *       type: object
 *       required:
 *         - name
 *         - quantity
 *         - unitPrice
 *         - totalPrice
 *       properties:
 *         menuItem:
 *           type: string
 *           description: Menu item ID reference
 *         name:
 *           type: string
 *           description: Item name
 *         size:
 *           type: string
 *           description: Item size/variant
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *         totalPrice:
 *           type: number
 *           minimum: 0
 * 
 *     Bill:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Bill ID
 *         billNumber:
 *           type: string
 *           description: Unique bill number
 *         orderId:
 *           type: string
 *           description: Associated order ID
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         customerId:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             phone:
 *               type: string
 *             email:
 *               type: string
 *         tableId:
 *           type: object
 *           nullable: true
 *           properties:
 *             _id:
 *               type: string
 *             tableNumber:
 *               type: string
 *             tableName:
 *               type: string
 *         billDate:
 *           type: string
 *           format: date-time
 *         requestedAt:
 *           type: string
 *           format: date-time
 *         finalizedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         subtotal:
 *           type: number
 *           minimum: 0
 *         taxAmount:
 *           type: number
 *           default: 0
 *           minimum: 0
 *         serviceCharge:
 *           type: number
 *           default: 0
 *           minimum: 0
 *         discountAmount:
 *           type: number
 *           default: 0
 *           minimum: 0
 *         totalAmount:
 *           type: number
 *           minimum: 0
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BillItem'
 *         customerEmail:
 *           type: string
 *           nullable: true
 *         customerPhone:
 *           type: string
 *           nullable: true
 *         customerName:
 *           type: string
 *           nullable: true
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, refunded, failed]
 *           default: pending
 *         paymentMethod:
 *           type: string
 *           enum: [cash, card, online, upi, wallet, pending]
 *           default: pending
 *         transactionId:
 *           type: string
 *           nullable: true
 *         paidAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         paymentGateway:
 *           type: string
 *           nullable: true
 *         emailSent:
 *           type: boolean
 *           default: false
 *         emailSentAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         emailError:
 *           type: string
 *           nullable: true
 *         emailRecipient:
 *           type: string
 *           nullable: true
 *         billViewed:
 *           type: boolean
 *           default: false
 *         lastViewedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         viewCount:
 *           type: integer
 *           default: 0
 *         pdfUrl:
 *           type: string
 *           nullable: true
 *         pdfGenerated:
 *           type: boolean
 *           default: false
 *         billStatus:
 *           type: string
 *           enum: [draft, sent, viewed, paid, finalized]
 *           default: draft
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     RequestBillRequest:
 *       type: object
 *       required:
 *         - sessionId
 *       properties:
 *         sessionId:
 *           type: string
 *           description: Customer session ID
 *         email:
 *           type: string
 *           format: email
 *           description: Email to send bill
 *         forceNew:
 *           type: boolean
 *           default: false
 *           description: Force new bill generation
 * 
 *     SendEmailRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email address to send bill
 * 
 *     PaymentRequest:
 *       type: object
 *       required:
 *         - paymentMethod
 *       properties:
 *         paymentMethod:
 *           type: string
 *           enum: [cash, card, online, upi, wallet]
 *           description: Payment method
 *         transactionId:
 *           type: string
 *           description: Transaction reference ID
 *         gateway:
 *           type: string
 *           description: Payment gateway name
 * 
 *     PaymentQRResponse:
 *       type: object
 *       properties:
 *         qrCode:
 *           type: string
 *           description: QR code data URL (base64)
 *         upiId:
 *           type: string
 *           description: UPI ID for payment
 *         amount:
 *           type: number
 *           description: Bill amount
 *         billNumber:
 *           type: string
 * 
 *     BillStatistics:
 *       type: object
 *       properties:
 *         totalBills:
 *           type: integer
 *           description: Total bills generated
 *         pendingBills:
 *           type: integer
 *           description: Bills pending payment
 *         paidBills:
 *           type: integer
 *           description: Bills paid
 *         todayBills:
 *           type: integer
 *           description: Bills generated today
 *         todayRevenue:
 *           type: number
 *           description: Revenue generated today
 *         monthlyRevenue:
 *           type: number
 *           description: Revenue this month
 * 
 *     BillListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Bill'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             pages:
 *               type: integer
 *             total:
 *               type: integer
 * 
 *     BillFilters:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, paid, refunded, failed]
 *           description: Filter by payment status
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