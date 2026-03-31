/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerSession:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Customer session ID
 *         sessionId:
 *           type: string
 *           description: Unique session identifier
 *         table:
 *           type: string
 *           description: Table ID
 *         tableDetails:
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
 *         name:
 *           type: string
 *           description: Customer name
 *         phone:
 *           type: string
 *           description: Customer phone number
 *         email:
 *           type: string
 *           format: email
 *           description: Customer email
 *         sessionStatus:
 *           type: string
 *           enum: [active, payment_pending, completed, cancelled, timeout, payment_processing]
 *           description: Session status
 *         paymentMethod:
 *           type: string
 *           enum: [cash, card, online, upi, wallet, pending, null]
 *           nullable: true
 *           description: Payment method used
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded, null]
 *           nullable: true
 *           description: Payment status
 *         paymentReference:
 *           type: string
 *           description: Payment transaction reference
 *         totalAmount:
 *           type: number
 *           description: Total amount for the session
 *         currentOrder:
 *           type: string
 *           description: Current order ID
 *         totalOrders:
 *           type: integer
 *           description: Total orders in this session
 *         totalSpent:
 *           type: number
 *           description: Total amount spent
 *         sessionStart:
 *           type: string
 *           format: date-time
 *           description: Session start time
 *         sessionEnd:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Session end time
 *         lastActivity:
 *           type: string
 *           format: date-time
 *           description: Last activity timestamp
 *         lastBillId:
 *           type: string
 *           description: Last bill ID
 *         lastBillNumber:
 *           type: string
 *           description: Last bill number
 *         lastBillAmount:
 *           type: number
 *           description: Last bill amount
 *         billGenerated:
 *           type: boolean
 *           description: Whether bill is generated
 *         billGeneratedAt:
 *           type: string
 *           format: date-time
 *           description: When bill was generated
 *         retainSessionData:
 *           type: boolean
 *           description: Whether session data is retained
 *         retainUntil:
 *           type: string
 *           format: date-time
 *           description: Until when session data is retained
 *         isAccessibleForBilling:
 *           type: boolean
 *           description: Whether accessible for billing
 *         closedBy:
 *           type: string
 *           description: Staff who closed the session
 *         closedByName:
 *           type: string
 *           description: Name of staff who closed
 *         closedByRole:
 *           type: string
 *           description: Role of staff who closed
 *         cancelledBy:
 *           type: string
 *           description: Staff who cancelled the session
 *         cancelledByName:
 *           type: string
 *           description: Name of staff who cancelled
 *         cancelledByRole:
 *           type: string
 *           description: Role of staff who cancelled
 *         cancellationReason:
 *           type: string
 *           description: Reason for cancellation
 *         notes:
 *           type: string
 *           description: Session notes
 *         isActive:
 *           type: boolean
 *           description: Whether session is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Update timestamp
 * 
 *     CreateSessionRequest:
 *       type: object
 *       required:
 *         - tableId
 *         - token
 *         - customerData
 *       properties:
 *         tableId:
 *           type: string
 *           description: Table ID
 *         token:
 *           type: string
 *           description: Table QR token
 *         customerData:
 *           type: object
 *           required:
 *             - name
 *             - email
 *             - phone
 *           properties:
 *             name:
 *               type: string
 *               description: Customer name
 *             phone:
 *               type: string
 *               description: Customer phone number
 *             email:
 *               type: string
 *               format: email
 *               description: Customer email
 * 
 *     PaymentData:
 *       type: object
 *       required:
 *         - paymentData
 *       properties:
 *         paymentData:
 *           type: object
 *           required:
 *             - transactionId
 *           properties:
 *             paymentMethod:
 *               type: string
 *               enum: [cash, card, online, upi, wallet, credit_card]
 *               description: Payment method
 *               example: credit_card
 *             transactionId:
 *               type: string
 *               description: Transaction reference ID
 *               example: txn_123456789
 *             amount:
 *               type: number
 *               description: Payment amount
 *               example: 75.5
 
 *
 *     CompleteSessionOfflineRequest:
 *       type: object
 *       properties:
 *         notes:
 *           type: string
 *           description: Notes for the session

 * 
 *     CancelSessionRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           description: Reason for cancellation

 * 
 *     ExtendSessionRequest:
 *       type: object
 *       required:
 *         - minutes
 *       properties:
 *         minutes:
 *           type: integer
 *           minimum: 1
 *           maximum: 240
 *           default: 30
 *           description: Minutes to extend session

 * 
 *     BillRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email to send bill
 *         forceNew:
 *           type: boolean
 *           default: false
 *           description: Force new bill generation
 * 
 *     MarkBillPaidRequest:
 *       type: object
 *       required:
 *         - paymentMethod
 *         - transactionId
 *       properties:
 *         paymentMethod:
 *           type: string
 *           enum: [cash, card, online, upi, wallet]
 *           description: Payment method used
 *         transactionId:
 *           type: string
 *           description: Transaction reference ID
 *         staffId:
 *           type: string
 *           description: Staff ID who processed payment
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: Error message
 *         errorType:
 *           type: string
 *           enum: [validation_error, session_not_found, user_not_found, permission_denied, server_error, already_cancelled, invalid_operation, inactive_session, security_error]
 *           description: Type of error
 *         statusCode:
 *           type: integer
 *           example: 400
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When error occurred
 * 
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           description: Success message
 *         data:
 *           type: object
 *           description: Response data
 * 
 *     SessionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Session created successfully"
 *         data:
 *           type: object
 *           properties:
 *             sessionId:
 *               type: string
 *             sessionStatus:
 *               type: string
 *             table:
 *               type: string
 *             isExistingSession:
 *               type: boolean
 * 
 *     SessionsListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             pages:
 *               type: integer
 *               example: 5
 *             hasNext:
 *               type: boolean
 *               example: true
 *             hasPrev:
 *               type: boolean
 *               example: false
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CustomerSession'
 * 
 *     SessionAnalytics:
 *       type: object
 *       properties:
 *         period:
 *           type: string
 *           example: "today"
 *         totalSessions:
 *           type: integer
 *           example: 25
 *         activeSessions:
 *           type: integer
 *           example: 10
 *         completedSessions:
 *           type: integer
 *           example: 15
 *         averageSessionTime:
 *           type: number
 *           format: float
 *           example: 45.5
 *         revenue:
 *           type: number
 *           example: 12500
 *         sessionsByHour:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hour:
 *                 type: integer
 *               count:
 *                 type: integer
 * 
 *     SessionWithBill:
 *       type: object
 *       properties:
 *         session:
 *           $ref: '#/components/schemas/CustomerSession'
 *         bill:
 *           type: object
 *           nullable: true
 *           description: Bill details if generated
 *         orders:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               orderNumber:
 *                 type: string
 *               items:
 *                 type: array
 *               status:
 *                 type: string
 *               totalAmount:
 *                 type: number
 *         summary:
 *           type: object
 *           properties:
 *             orderCount:
 *               type: integer
 *             itemsCount:
 *               type: integer
 *             subtotal:
 *               type: number
 *             taxAmount:
 *               type: number
 *             serviceCharge:
 *               type: number
 *             discountAmount:
 *               type: number
 *             totalAmount:
 *               type: number
 *         hasActiveBill:
 *           type: boolean
 *         canRequestBill:
 *           type: boolean
 *         canCompleteSession:
 *           type: boolean
 * 
 *     BillSummaryResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             session:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 table:
 *                   type: object
 *                   properties:
 *                     tableNumber:
 *                       type: string
 *                     tableName:
 *                       type: string
 *             summary:
 *               type: object
 *               properties:
 *                 orderCount:
 *                   type: integer
 *                 itemCount:
 *                   type: integer
 *                 subtotal:
 *                   type: number
 *                 taxAmount:
 *                   type: number
 *                 serviceCharge:
 *                   type: number
 *                 discountAmount:
 *                   type: number
 *                 totalAmount:
 *                   type: number
 *             existingBill:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: string
 *                 billNumber:
 *                   type: string
 *                 totalAmount:
 *                   type: number
 *                 status:
 *                   type: string
 *                 paymentStatus:
 *                   type: string
 *             canGenerateBill:
 *               type: boolean
 * 
 *     TimeoutSessionsRequest:
 *       type: object
 *       properties:
 *         timeoutMinutes:
 *           type: integer
 *           minimum: 1
 *           maximum: 1440
 *           default: 30
 *           description: Inactivity timeout in minutes
 * 
 *     SessionFilters:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: Page number
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *           description: Items per page
 *         mode:
 *           type: string
 *           enum: [all, active, inactive]
 *           default: all
 *           description: Filter mode
 *         status:
 *           type: string
 *           enum: [active, payment_pending, completed, cancelled, timeout]
 *           description: Filter by session status
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Filter by start date (ISO format)
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Filter by end date (ISO format)
 *         tableId:
 *           type: string
 *           description: Filter by table ID
 *         name:
 *           type: string
 *           description: Filter by customer name (partial match)
 *         phone:
 *           type: string
 *           description: Filter by phone number (partial match)
 *         email:
 *           type: string
 *           format: email
 *           description: Filter by email (exact match)
 *         minAmount:
 *           type: number
 *           minimum: 0
 *           description: Filter by minimum total amount
 *         maxAmount:
 *           type: number
 *           minimum: 0
 *           description: Filter by maximum total amount
 *         paymentMethod:
 *           type: string
 *           enum: [cash, card, online, upi, wallet]
 *           description: Filter by payment method
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed]
 *           description: Filter by payment status
 *         sortBy:
 *           type: string
 *           enum: [sessionStart, lastActivity, createdAt, totalAmount, totalSpent, name]
 *           default: sessionStart
 *           description: Field to sort by
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *           description: Sort order
 *         search:
 *           type: string
 *           description: Search across name, email, phone, sessionId
 * 
 *     TimeoutResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Timed out 5 sessions, 0 failed"
 *         data:
 *           type: object
 *           properties:
 *             totalProcessed:
 *               type: integer
 *             successful:
 *               type: integer
 *             failed:
 *               type: integer
 *             details:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   sessionId:
 *                     type: string
 *                   table:
 *                     type: string
 *                   success:
 *                     type: boolean
 *                   message:
 *                     type: string
 *                   error:
 *                     type: string
 * 
 *     ExtendedSessionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Session extended successfully"
 *         data:
 *           type: object
 *           properties:
 *             sessionId:
 *               type: string
 *             extendedMinutes:
 *               type: integer
 *             newExpiry:
 *               type: string
 *               format: date-time
 *             lastActivity:
 *               type: string
 *               format: date-time
 * 
 *     CancelSessionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Session cancelled successfully"
 *         data:
 *           type: object
 *           properties:
 *             session:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 startTime:
 *                   type: string
 *                   format: date-time
 *                 endTime:
 *                   type: string
 *                   format: date-time
 *                 cancellationReason:
 *                   type: string
 *                 cancelledBy:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                 cancellationTime:
 *                   type: string
 *                   format: date-time
 *             customer:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *             ordersCancelled:
 *               type: integer
 *             timestamp:
 *               type: string
 *               format: date-time
 * 
 *   parameters:
 *     SessionIdPathParam:
 *       in: path
 *       name: sessionId
 *       required: true
 *       schema:
 *         type: string
 *       description: Customer session ID
 *     
 *     TableIdPathParam:
 *       in: path
 *       name: tableId
 *       required: true
 *       schema:
 *         type: string
 *       description: Table ID
 *     
 *     BillIdPathParam:
 *       in: path
 *       name: billId
 *       required: true
 *       schema:
 *         type: string
 *       description: Bill ID
 *     
 *     PageQueryParam:
 *       in: query
 *       name: page
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number
 *     
 *     LimitQueryParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 50
 *       description: Items per page
 *     
 *     TimeoutMinutesQueryParam:
 *       in: query
 *       name: timeoutMinutes
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 1440
 *         default: 30
 *       description: Inactivity timeout in minutes
 * 
 *   responses:
 *     UnauthorizedError:
 *       description: Not authenticated or invalid token
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Authentication required"
 *               errorType: "authentication_error"
 *               statusCode: 401
 *     
 *     ForbiddenError:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "You don't have permission to perform this action"
 *               errorType: "permission_denied"
 *               statusCode: 403
 *     
 *     NotFoundError:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Session not found"
 *               errorType: "session_not_found"
 *               statusCode: 404
 *     
 *     ValidationError:
 *       description: Invalid request parameters
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid email format"
 *               errorType: "validation_error"
 *               statusCode: 400
 *     
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Internal server error"
 *               errorType: "server_error"
 *               statusCode: 500
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 * tags:
 *   - name: Customer Sessions
 *     description: Customer session management and operations
 */