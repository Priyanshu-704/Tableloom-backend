/**
 * @swagger
 * tags:
 *   name: Waiter Calls
 *   description: Waiter call management system
 */

/**
 * @swagger
 * /waiter-calls:
 *   post:
 *     summary: Create a new waiter call
 *     description: Customer creates a new call for waiter assistance
 *     tags: [Waiter Calls]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWaiterCallRequest'
 *     responses:
 *       201:
 *         description: Call created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Customer session not found
 *       500:
 *         description: Server error
 * 
 *   get:
 *     summary: Get all calls with filters
 *     description: Get paginated list of all waiter calls with filtering options (Admin/Manager only)
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/statusQueryParam'
 *       - $ref: '#/components/parameters/callTypeQueryParam'
 *       - $ref: '#/components/parameters/priorityQueryParam'
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (YYYY-MM-DD)
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (YYYY-MM-DD)
 *       - name: location
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by table location
 *       - name: staffId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by staff member
 *       - $ref: '#/components/parameters/pageQueryParam'
 *       - $ref: '#/components/parameters/limitQueryParam'
 *     responses:
 *       200:
 *         description: List of calls retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/active:
 *   get:
 *     summary: Get active calls
 *     description: Get all currently active calls (pending, assigned, acknowledged and in_progress)
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active calls retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/pending:
 *   get:
 *     summary: Get pending calls
 *     description: Get all pending waiter calls
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: location
 *         in: query
 *         schema:
 *           type: string
 *       - $ref: '#/components/parameters/callTypeQueryParam'
 *       - $ref: '#/components/parameters/priorityQueryParam'
 *     responses:
 *       200:
 *         description: Pending calls retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/{callId}/acknowledge:
 *   put:
 *     summary: Acknowledge a waiter call
 *     description: Staff member acknowledges a pending waiter call
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/callIdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcknowledgeCallRequest'
 *     responses:
 *       200:
 *         description: Call acknowledged successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - call already acknowledged/completed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Call not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/{callId}/complete:
 *   put:
 *     summary: Complete a waiter call
 *     description: Staff member marks a waiter call as completed
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/callIdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompleteCallRequest'
 *     responses:
 *       200:
 *         description: Call completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - call already completed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Call not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/{callId}/cancel:
 *   put:
 *     summary: Cancel a waiter call
 *     description: Customer cancels their waiter call
 *     tags: [Waiter Calls]
 *     parameters:
 *       - $ref: '#/components/parameters/callIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelCallRequest'
 *     responses:
 *       200:
 *         description: Call cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - cannot cancel completed call
 *       404:
 *         description: Call not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/{callId}/status:
 *   put:
 *     summary: Update call status
 *     description: Update the status of a waiter call
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/callIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCallStatusRequest'
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid status transition
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Call not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/{callId}/assign:
 *   put:
 *     summary: Assign call to staff
 *     description: Manager assigns a waiter call to specific staff member
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/callIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignCallRequest'
 *     responses:
 *       200:
 *         description: Call assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Cannot assign call
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Call or staff not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/dashboard:
 *   get:
 *     summary: Get call dashboard
 *     description: Get dashboard data for waiter calls
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/statistics:
 *   get:
 *     summary: Get call statistics
 *     description: Get statistics for waiter calls
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [today, yesterday, week, month, year]
 *           default: today
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/performance:
 *   get:
 *     summary: Get staff performance
 *     description: Get performance metrics for staff members
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Performance data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Missing date parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/staff/{staffId}:
 *   get:
 *     summary: Get calls by staff member
 *     description: Get all calls handled by a specific staff member
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/staffIdParam'
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [today, yesterday, week, month, year, all]
 *           default: today
 *     responses:
 *       200:
 *         description: Staff calls retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/my-assigned:
 *   get:
 *     summary: Get staff's assigned calls
 *     description: Get calls assigned to the currently logged-in staff member
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assigned calls retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /waiter-calls/available-staff:
 *   get:
 *     summary: Get available staff
 *     description: Get list of staff members available to handle calls
 *     tags: [Waiter Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: location
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available staff retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
