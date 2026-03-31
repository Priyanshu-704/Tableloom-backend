/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Customer feedback management system
 */

/**
 * @swagger
 * /feedback:
 *   post:
 *     summary: Submit customer feedback
 *     description: Customer submits feedback for their dining experience
 *     tags: [Feedback]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitFeedbackRequest'
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - validation error or duplicate feedback
 *       500:
 *         description: Server error
 * 
 *   get:
 *     summary: Get all feedback (Admin/Manager only)
 *     description: Get paginated list of all feedback with filtering options
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/statusQueryParam'
 *       - $ref: '#/components/parameters/sentimentQueryParam'
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
 *       - $ref: '#/components/parameters/hasResponseQueryParam'
 *       - $ref: '#/components/parameters/pageQueryParam'
 *       - $ref: '#/components/parameters/limitQueryParam'
 *     responses:
 *       200:
 *         description: List of feedback retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/session/{sessionId}:
 *   get:
 *     summary: Get feedback by session ID
 *     description: Get feedback submitted for a specific customer session
 *     tags: [Feedback]
 *     parameters:
 *       - $ref: '#/components/parameters/sessionIdParam'
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: No feedback found for this session
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/session/{sessionId}/customer-details:
 *   get:
 *     summary: Get customer details for feedback
 *     description: Retrieve customer, order, and table details for feedback submission
 *     tags: [Feedback]
 *     parameters:
 *       - $ref: '#/components/parameters/sessionIdParam'
 *     responses:
 *       200:
 *         description: Customer details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Session not found or expired
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/session/{sessionId}/can-submit:
 *   get:
 *     summary: Check if customer can submit feedback
 *     description: Verify if the customer is eligible to submit feedback for their session
 *     tags: [Feedback]
 *     parameters:
 *       - $ref: '#/components/parameters/sessionIdParam'
 *     responses:
 *       200:
 *         description: Eligibility check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/session/{sessionId}/active:
 *   get:
 *     summary: Get feedback for active session
 *     description: Get any existing feedback for an active customer session
 *     tags: [Feedback]
 *     parameters:
 *       - $ref: '#/components/parameters/sessionIdParam'
 *     responses:
 *       200:
 *         description: Feedback retrieved or none found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Active customer session not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/statistics:
 *   get:
 *     summary: Get feedback statistics
 *     description: Get comprehensive statistics about feedback (Admin/Manager only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/periodQueryParam'
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/dashboard:
 *   get:
 *     summary: Get feedback dashboard
 *     description: Get comprehensive dashboard data for feedback management
 *     tags: [Feedback]
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
 *         description: Forbidden - admin/manager access only
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/trending-topics:
 *   get:
 *     summary: Get trending feedback topics
 *     description: Get most frequently mentioned topics in feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Trending topics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/staff-performance:
 *   get:
 *     summary: Get staff performance from feedback
 *     description: Get performance metrics for staff based on feedback mentions
 *     tags: [Feedback]
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
 *         description: Staff performance data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Missing date parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/nps:
 *   get:
 *     summary: Get Net Promoter Score (NPS)
 *     description: Calculate and retrieve Net Promoter Score from feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/periodQueryParam'
 *     responses:
 *       200:
 *         description: NPS data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/{id}/respond:
 *   put:
 *     summary: Respond to feedback
 *     description: Admin/Manager responds to customer feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/feedbackIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RespondToFeedbackRequest'
 *     responses:
 *       200:
 *         description: Response sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Message is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /feedback/{id}/status:
 *   put:
 *     summary: Update feedback status
 *     description: Update status, priority, and follow-up status of feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/feedbackIdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFeedbackStatusRequest'
 *     responses:
 *       200:
 *         description: Feedback status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/manager access only
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Server error
 */