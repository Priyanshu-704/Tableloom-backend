/**
 * @swagger
 * /customers/session/scan:
 *   post:
 *     summary: Create customer session by scanning QR code
 *     tags: [Customer Sessions]
 *     description: |
 *       Create or retrieve existing session using QR code scan.
 *
 *       **Validation Rules:**
 *       - Table must exist and be active
 *       - QR token must be valid and not expired
 *       - Table must not be occupied (unless session exists)
 *       - Customer name, email, and phone are required
 *       - Email must be valid format
 *       - Phone must be valid Indian format (10 digits starting with 6-9)
 *
 *       **Business Logic:**
 *       - If active session exists for table, returns existing session
 *       - Checks for timed out sessions before creating new one
 *       - Updates table status to "occupied"
 *       - Generates unique session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSessionRequest'
 *     responses:
 *       201:
 *         description: New session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       200:
 *         description: Existing active session found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionResponse'
 *       400:
 *         description: Invalid QR code or table occupied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               examples:
 *                 InvalidToken:
 *                   value:
 *                     success: false
 *                     message: "Invalid or expired QR code"
 *                     errorType: "validation_error"
 *                     statusCode: 400
 *                 TableOccupied:
 *                   value:
 *                     success: false
 *                     message: "Table is currently occupied"
 *                     errorType: "validation_error"
 *                     statusCode: 400
 *                 InvalidCustomerData:
 *                   value:
 *                     success: false
 *                     message: "Invalid email format"
 *                     errorType: "validation_error"
 *                     statusCode: 400
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}:
 *   get:
 *     summary: Get customer session details
 *     tags: [Customer Sessions]
 *     description: |
 *       Get detailed information about a customer session.
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     responses:
 *       200:
 *         description: Session details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/CustomerSession'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}/complete-online:
 *   put:
 *     summary: Complete session with online payment
 *     tags: [Customer Sessions]
 *     description: |
 *       Process online payment and complete the session.
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentData'
 *     responses:
 *       200:
 *         description: Session completed with online payment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment successful and session completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     session:
 *                       type: object
 *                     customer:
 *                       type: object
 *                     bill:
 *                       type: object
 *                       nullable: true
 *                     billDownloadUrl:
 *                       type: string
 *                       nullable: true
 *                     table:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid payment data or session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}/logout:
 *   put:
 *     summary: Customer logout from session
 *     tags: [Customer Sessions]
 *     description: |
 *       Allows customer to logout from their session.
 *
 *       **Restrictions:**
 *       - Cannot logout if there are unpaid orders
 *       - Session must be active
 *       - Updates table status to "available"
 *
 *       **Note:** For payment completion, use complete-online or complete-offline endpoints
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *                 data:
 *                   $ref: '#/components/schemas/CustomerSession'
 *       400:
 *         description: Cannot logout with unpaid orders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               example:
 *                 success: false
 *                 message: "You have an unpaid order. Please complete payment first."
 *                 errorType: "validation_error"
 *                 statusCode: 400
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}/generate-bill-before-payment:
 *   post:
 *     summary: Generate bill before payment
 *     tags: [Customer Sessions]
 *     description: |
 *       Generates a bill for the session before payment processing.
 *
 *       **Features:**
 *       - Creates bill with all unpaid orders
 *       - Generates PDF of the bill
 *       - Returns bill details for payment
 *       - If bill already exists, returns existing bill
 *
 *       **Use Case:** Call this before redirecting to payment gateway
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     responses:
 *       200:
 *         description: Bill generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     billNumber:
 *                       type: string
 *                     totalAmount:
 *                       type: number
 *                     billId:
 *                       type: string
 *                     pdfUrl:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: No unpaid orders found or session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

// /**
//  * @swagger
//  * /customers/session/{sessionId}/with-bill:
//  *   get:
//  *     summary: Get session with bill details
//  *     tags: [Customer Sessions]
//  *     description: |
//  *       Get complete session information including bill details.
//  *
//  *       **Response Includes:**
//  *       - Session details
//  *       - Active bill (if exists)
//  *       - All unpaid orders
//  *       - Bill summary (totals, taxes, etc.)
//  *       - Flags for available actions
//  *     parameters:
//  *       - $ref: '#/components/parameters/SessionIdPathParam'
//  *     responses:
//  *       200:
//  *         description: Session with bill details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/SessionWithBill'
//  *       404:
//  *         $ref: '#/components/responses/NotFoundError'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */

/**
 * @swagger
 * /customers/session/{sessionId}/bill-summary:
 *   get:
 *     summary: Get session bill summary
 *     tags: [Customer Sessions]
 *     description: |
 *       Get summary of bill for the session.
 *
 *       **Useful for:** Displaying bill summary before payment
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     responses:
 *       200:
 *         description: Bill summary retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BillSummaryResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

// ==================== STAFF ONLY ENDPOINTS ====================

/**
 * @swagger
 * /customers/session/{sessionId}/complete-offline:
 *   put:
 *     summary: Complete session with offline payment (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Process offline payment (cash/card) and complete session.
 *
 *       **Permissions Required:** SESSION_COMPLETE_OFFLINE
 *
 *       **Flow:**
 *       1. Validates staff permissions
 *       2. Processes any pending bill
 *       3. Updates session payment status
 *       4. Sends payment confirmation email
 *       5. Updates table status
 *       6. Marks orders as paid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompleteSessionOfflineRequest'
 *     responses:
 *       200:
 *         description: Session completed with offline payment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Payment processed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     session:
 *                       type: object
 *                     customer:
 *                       type: object
 *                     staff:
 *                       type: object
 *                     bill:
 *                       type: object
 *                       nullable: true
 *                     table:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     notes:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}/cancel:
 *   put:
 *     summary: Cancel session (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Cancel a customer session.
 *
 *       **Permissions Required:** SESSION_CANCEL
 *
 *       **Effects:**
 *       - Updates session status to "cancelled"
 *       - Cancels all active orders
 *       - Updates table status to "available"
 *       - Records cancellation reason and staff info
 *
 *       **Validation:**
 *       - Cannot cancel already completed sessions
 *       - Cannot cancel already cancelled sessions
 *       - Reason cannot exceed 500 characters
 *       - Blocks potentially harmful content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelSessionRequest'
 *     responses:
 *       200:
 *         description: Session cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CancelSessionResponse'
 *       400:
 *         description: Invalid cancellation request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               examples:
 *                 AlreadyCancelled:
 *                   value:
 *                     success: false
 *                     message: "Session is already cancelled"
 *                     errorType: "already_cancelled"
 *                     statusCode: 400
 *                 CompletedSession:
 *                   value:
 *                     success: false
 *                     message: "Cannot cancel a completed session"
 *                     errorType: "invalid_operation"
 *                     statusCode: 400
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}/extend:
 *   put:
 *     summary: Extend session duration (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Extend session timeout duration.
 *
 *       **Permissions Required:** SESSION_UPDATE
 *
 *       **Limits:**
 *       - Minimum: 1 minute
 *       - Maximum: 240 minutes (4 hours)
 *       - Default: 30 minutes
 *
 *       **Note:** This extends the lastActivity timestamp, not sessionEnd
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SessionIdPathParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtendSessionRequest'
 *     responses:
 *       200:
 *         description: Session extended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtendedSessionResponse'
 *       400:
 *         description: Invalid extension request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/{sessionId}/bill/{billId}/mark-paid:
 *   post:
 *     summary: Mark bill as paid (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Manually mark a bill as paid.
 *
 *       **Permissions Required:** admin, manager, or staff role
 *
 *       **Use Case:** When payment is processed outside the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BillIdPathParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarkBillPaidRequest'
 *     responses:
 *       200:
 *         description: Bill marked as paid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bill marked as paid successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bill:
 *                       type: object
 *                     customer:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/session/table/{tableId}:
 *   get:
 *     summary: Get session by table ID (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Get active session for a specific table.
 *
 *       **Permissions Required:** SESSION_VIEW_ALL
 *
 *       **Returns:** Active session if exists, null otherwise
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPathParam'
 *     responses:
 *       200:
 *         description: Session found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/CustomerSession'
 *       404:
 *         description: No active session for this table
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               example:
 *                 success: false
 *                 message: "No active session found for this table"
 *                 errorType: "session_not_found"
 *                 statusCode: 404
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/analytics:
 *   get:
 *     summary: Get session analytics (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Get session analytics for a specific period.
 *
 *       **Permissions Required:** SESSION_STATISTICS
 *
 *       **Available Periods:** today, week, month
 *
 *       **Metrics:**
 *       - Total sessions
 *       - Active sessions
 *       - Completed sessions
 *       - Average session time
 *       - Revenue
 *       - Sessions by hour
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *           default: today
 *         description: Time period for analytics
 *     responses:
 *       200:
 *         description: Analytics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SessionAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /customers/sessions:
 *   get:
 *     summary: Get all sessions with filters (Staff only)
 *     tags: [Customer Sessions]
 *     description: |
 *       Get paginated list of sessions with advanced filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageQueryParam'
 *       - $ref: '#/components/parameters/LimitQueryParam'
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         description: Filter sessions by activity state.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, payment_pending, completed, cancelled, timeout, payment_processing]
 *         description: Filter by session status.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter for session creation (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter for session creation (ISO format)
 *       - in: query
 *         name: tableId
 *         schema:
 *           type: string
 *         description: Filter by specific table ID
 *     responses:
 *       200:
 *         description: Sessions list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionsListResponse'
 *             example:
 *               success: true
 *               pagination:
 *                 page: 1
 *                 limit: 50
 *                 pages: 5
 *                 total: 245
 *                 hasNext: true
 *                 hasPrev: false
 *               filters:
 *                 mode: "active"
 *                 status: "active"
 *                 tableId: null
 *                 startDate: "2024-01-01T00:00:00.000Z"
 *                 endDate: "2024-01-31T23:59:59.999Z"
 *               data:
 *                 - _id: "65a1b2c3d4e5f67890123456"
 *                   sessionId: "sess_abc123def456_1234567890"
 *                   sessionStatus: "active"
 *                   isActive: true
 *                   name: "John Doe"
 *                   email: "john@example.com"
 *                   phone: "+1234567890"
 *                   lastActivity: "2024-01-15T14:30:00.000Z"
 *                   sessionStart: "2024-01-15T13:00:00.000Z"
 *                   table:
 *                     _id: "65a1b2c3d4e5f67890123457"
 *                     tableNumber: "T01"
 *                     tableName: "Window Table"
 *                     capacity: 4
 *                     location: "Main Hall"
 *                   currentOrder:
 *                     _id: "65a1b2c3d4e5f67890123458"
 *                     orderNumber: "ORD-001"
 *                     status: "preparing"
 *                     totalAmount: 125.50
 *                   sessionDuration: 90
 *                   isTimedOut: false
 *       400:
 *         description: Bad Request - Invalid parameters or incompatible filters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               InvalidModeStatus:
 *                 value:
 *                   success: false
 *                   message: "Status 'completed' is not valid for active mode. Valid statuses are: active, payment_pending"
 *               InvalidTableId:
 *                 value:
 *                   success: false
 *                   message: "Invalid tableId format"
 *               InvalidDate:
 *                 value:
 *                   success: false
 *                   message: "Invalid startDate format"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

// /**
//  * @swagger
//  * /customers/sessions/inactive:
//  *   get:
//  *     summary: Get inactive sessions (Staff only)
//  *     tags: [Customer Sessions]
//  *     description: |
//  *       Get sessions that have exceeded inactivity timeout.
//  *
//  *       **Permissions Required:** SESSION_VIEW_ALL
//  *
//  *       **Default Timeout:** 30 minutes
//  *
//  *       **Note:** These sessions are eligible for automatic timeout
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - $ref: '#/components/parameters/TimeoutMinutesQueryParam'
//  *     responses:
//  *       200:
//  *         description: List of inactive sessions
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 count:
//  *                   type: integer
//  *                 timeoutMinutes:
//  *                   type: integer
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/CustomerSession'
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  *       403:
//  *         $ref: '#/components/responses/ForbiddenError'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */

// /**
//  * @swagger
//  * /customers/sessions/timeout:
//  *   post:
//  *     summary: Timeout inactive sessions (Staff only)
//  *     tags: [Customer Sessions]
//  *     description: |
//  *       Manually timeout sessions that have exceeded inactivity threshold.
//  *
//  *       **Permissions Required:** SESSION_UPDATE
//  *
//  *       **Effects:**
//  *       - Updates session status to "timeout"
//  *       - Updates table status to "cleaning"
//  *       - Records timeout reason
//  *
//  *       **Returns:** Summary of processed sessions
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/TimeoutSessionsRequest'
//  *     responses:
//  *       200:
//  *         description: Sessions timed out
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/TimeoutResponse'
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  *       403:
//  *         $ref: '#/components/responses/ForbiddenError'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */

// /**
//  * @swagger
//  * /customers/session/{sessionId}/request-bill:
//  *   post:
//  *     summary: Request bill for session
//  *     tags: [Customer Sessions]
//  *     description: |
//  *       Request generation of a bill for the session.
//  *
//  *       **Features:**
//  *       - Generates bill with all unpaid orders
//  *       - Optionally sends bill via email
//  *       - Can force regeneration of bill
//  *       - Updates customer email if provided
//  *
//  *       **Use Cases:**
//  *       - Customer requests bill via app
//  *       - Staff generates bill for customer
//  *       - Send bill to customer email
//  *     parameters:
//  *       - $ref: '#/components/parameters/SessionIdPathParam'
//  *     requestBody:
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/BillRequest'
//  *     responses:
//  *       200:
//  *         description: Bill requested successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Bill generated successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     bill:
//  *                       type: object
//  *                     session:
//  *                       $ref: '#/components/schemas/CustomerSession'
//  *       400:
//  *         description: Cannot generate bill
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  *               example:
//  *                 success: false
//  *                 message: "Active customer session not found"
//  *                 errorType: "session_not_found"
//  *                 statusCode: 400
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */

// /**
//  * @swagger
//  * /customers/sessions/active:
//  *   get:
//  *     summary: Get all active sessions (Staff only)
//  *     tags: [Customer Sessions]
//  *     description: |
//  *       Get paginated list of all active sessions.
//  *
//  *       **Permissions Required:** SESSION_VIEW_ALL
//  *
//  *       **Note:** This endpoint is deprecated in favor of `/customers/sessions?mode=active`
//  *       but maintained for backward compatibility.
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - $ref: '#/components/parameters/PageQueryParam'
//  *       - $ref: '#/components/parameters/LimitQueryParam'
//  *     responses:
//  *       200:
//  *         description: List of active sessions
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/SessionsListResponse'
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  *       403:
//  *         $ref: '#/components/responses/ForbiddenError'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */

// /**
//  * @swagger
//  * /customers/session/table/{tableId}:
//  *   get:
//  *     summary: Get session by table ID (Staff only)
//  *     tags: [Customer Sessions]
//  *     description: |
//  *       Get active session for a specific table.
//  *
//  *       **Permissions Required:** SESSION_VIEW_ALL
//  *
//  *       **Returns:** Active session if exists, null otherwise
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - $ref: '#/components/parameters/TableIdPathParam'
//  *     responses:
//  *       200:
//  *         description: Session found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/CustomerSession'
//  *       404:
//  *         description: No active session for this table
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  *               example:
//  *                 success: false
//  *                 message: "No active session found for this table"
//  *                 errorType: "session_not_found"
//  *                 statusCode: 404
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  *       403:
//  *         $ref: '#/components/responses/ForbiddenError'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
