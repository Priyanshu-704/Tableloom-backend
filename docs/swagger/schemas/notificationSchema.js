/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - title
 *         - message
 *         - type
 *         - recipientType
 *       properties:
 *         _id:
 *           type: string
 *           description: Notification ID
 *           example: "5f8d0d55b54764421b7156c5"
 *         title:
 *           type: string
 *           description: Notification title
 *           example: "Waiter Call - Table 5"
 *         message:
 *           type: string
 *           description: Notification message
 *           example: "Customer at Table 5 requires assistance"
 *         type:
 *           type: string
 *           enum: [
 *             "waiter_call", "order_ready", "order_delayed", 
 *             "payment_request", "payment_received", "table_assigned",
 *             "customer_checkin", "customer_checkout", "inventory_low",
 *             "reservation_alert", "system_alert", "staff_announcement",
 *             "rating_received", "shift_change", "task_assigned"
 *           ]
 *           description: Type of notification
 *           example: "waiter_call"
 *         priority:
 *           type: string
 *           enum: ["low", "medium", "high", "urgent"]
 *           default: "medium"
 *           example: "high"
 *         recipientType:
 *           type: string
 *           enum: ["user", "role", "table", "station", "all"]
 *           description: Type of recipient
 *           example: "role"
 *         recipients:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of recipient IDs
 *           example: ["5f8d0d55b54764421b7156c6", "5f8d0d55b54764421b7156c7"]
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *             enum: ["admin", "manager", "chef", "waiter", "cashier", "customer"]
 *           description: Roles that should receive the notification
 *           example: ["waiter", "manager"]
 *         sender:
 *           type: string
 *           description: User who sent the notification
 *           example: "5f8d0d55b54764421b7156c8"
 *         senderType:
 *           type: string
 *           enum: ["system", "user", "customer", "kitchen"]
 *           default: "system"
 *           example: "system"
 *         relatedTo:
 *           type: string
 *           description: Related entity ID
 *           example: "5f8d0d55b54764421b7156c9"
 *         relatedModel:
 *           type: string
 *           enum: ["Order", "WaiterCall", "Table", "Customer", "Reservation", "Bill", "KitchenOrder", "Inventory"]
 *           example: "WaiterCall"
 *         actionRequired:
 *           type: boolean
 *           default: false
 *           example: true
 *         actions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 example: "Acknowledge"
 *               type:
 *                 type: string
 *                 enum: ["button", "link", "acknowledge"]
 *                 example: "button"
 *               action:
 *                 type: string
 *                 example: "/api/waiter-calls/CALL-12345/acknowledge"
 *               color:
 *                 type: string
 *                 example: "primary"
 *         status:
 *           type: string
 *           enum: ["unread", "read", "acknowledged", "dismissed", "action_taken"]
 *           default: "unread"
 *           example: "unread"
 *         readBy:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *               readAt:
 *                 type: string
 *                 format: date-time
 *         acknowledgedBy:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *               acknowledgedAt:
 *                 type: string
 *                 format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Auto-delete after this date
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           example:
 *             tableNumber: "T-5"
 *             customerName: "John Doe"
 *         unreadCount:
 *           type: number
 *           description: Virtual field - count of unread notifications
 *           example: 5
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     NotificationStats:
 *       type: object
 *       properties:
 *         total:
 *           type: number
 *           example: 50
 *         unread:
 *           type: number
 *           example: 5
 *         read:
 *           type: number
 *           example: 35
 *         acknowledged:
 *           type: number
 *           example: 10
 *         byType:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             waiter_call: 20
 *             order_ready: 15
 *             payment_received: 10
 *         byPriority:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             low: 10
 *             medium: 25
 *             high: 10
 *             urgent: 5
 *         byStatus:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             unread: 5
 *             read: 35
 *             acknowledged: 10
 *         recentActivity:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hour:
 *                 type: string
 *               count:
 *                 type: number
 * 
 *     CreateAnnouncementRequest:
 *       type: object
 *       required:
 *         - title
 *         - message
 *       properties:
 *         title:
 *           type: string
 *           example: "Staff Meeting Today"
 *         message:
 *           type: string
 *           example: "There will be a staff meeting at 3 PM in the main hall."
 *         priority:
 *           type: string
 *           enum: ["low", "medium", "high", "urgent"]
 *           default: "medium"
 *           example: "high"
 *         type:
 *           type: string
 *           enum: ["staff_announcement", "system_alert"]
 *           default: "staff_announcement"
 *           example: "staff_announcement"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           example: "2024-12-31T23:59:59Z"
 *         important:
 *           type: boolean
 *           default: false
 *           example: true
 *         recipientType:
 *           type: string
 *           enum: ["role", "all"]
 *           default: "all"
 *           example: "role"
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *             enum: ["admin", "manager", "chef", "waiter", "cashier"]
 *           example: ["waiter", "manager"]
 * 
 *     PaginatedNotifications:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Notification'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: number
 *               example: 1
 *             limit:
 *               type: number
 *               example: 20
 *             total:
 *               type: number
 *               example: 100
 *             pages:
 *               type: number
 *               example: 5
 *         unreadCount:
 *           type: number
 *           example: 15
 * 
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation successful"
 *         data:
 *           type: object
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message"
 *         error:
 *           type: string
 *           example: "Detailed error description"
 * 
 *   parameters:
 *     notificationIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *       description: Notification ID
 *       example: "5f8d0d55b54764421b7156c5"
 * 
 *     statusQueryParam:
 *       name: status
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["unread", "read", "acknowledged", "dismissed", "action_taken"]
 *       description: Filter by notification status
 * 
 *     typeQueryParam:
 *       name: type
 *       in: query
 *       schema:
 *         type: string
 *         enum: [
 *           "waiter_call", "order_ready", "order_delayed", 
 *           "payment_request", "payment_received", "table_assigned",
 *           "customer_checkin", "customer_checkout", "inventory_low",
 *           "reservation_alert", "system_alert", "staff_announcement",
 *           "rating_received", "shift_change", "task_assigned"
 *         ]
 *       description: Filter by notification type
 * 
 *     priorityQueryParam:
 *       name: priority
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["low", "medium", "high", "urgent"]
 *       description: Filter by priority
 * 
 *     pageQueryParam:
 *       name: page
 *       in: query
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number
 * 
 *     limitQueryParam:
 *       name: limit
 *       in: query
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 20
 *       description: Items per page
 * 
 *     unreadOnlyQueryParam:
 *       name: unreadOnly
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["true", "false"]
 *       description: Show only unread notifications
 * 
 *     actionRequiredQueryParam:
 *       name: actionRequired
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["true", "false"]
 *       description: Show only notifications requiring action
 * 
 *     periodQueryParam:
 *       name: period
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["today", "yesterday", "week", "month", "year"]
 *         default: "today"
 *       description: Time period for statistics
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */