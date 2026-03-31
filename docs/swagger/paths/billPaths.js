/**
 * @swagger
 * tags:
 *   - name: Bills
 *     description: Bill generation and management
 *   - name: Bill Payments
 *     description: Bill payment processing
 *   - name: Bill Admin
 *     description: Administrative bill operations
 */

/**
 * @swagger
 * /bills/request:
 *   post:
 *     summary: Request bill for session
 *     tags: [Bills]
 *     description: Generate bill for customer session, optionally send via email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RequestBillRequest'
 *     responses:
 *       201:
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
 *                   example: "Bill generated and sent via email"
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Session ID required or validation error
 *       404:
 *         description: Active session not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/session/{sessionId}:
 *   get:
 *     summary: Get bill by session ID
 *     tags: [Bills]
 *     description: Retrieve bill for a customer session
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer session ID
 *     responses:
 *       200:
 *         description: Bill retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       404:
 *         description: No active bill found for session
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/{billId}:
 *   get:
 *     summary: Get bill by ID
 *     tags: [Bills]
 *     description: Retrieve bill details by bill ID
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     responses:
 *       200:
 *         description: Bill details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       404:
 *         description: Bill not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/{billId}/send-email:
 *   post:
 *     summary: Send bill via email
 *     tags: [Bills]
 *     description: Resend or send bill to email address
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendEmailRequest'
 *     responses:
 *       200:
 *         description: Bill sent to email successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Bill sent to email successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Email address required or validation error
 *       404:
 *         description: Bill not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/{billId}/pay:
 *   post:
 *     summary: Process bill payment
 *     tags: [Bill Payments]
 *     description: Mark bill as paid with payment details
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentRequest'
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Payment processed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Payment method required or validation error
 *       404:
 *         description: Bill not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/{billId}/pdf:
 *   get:
 *     summary: Download bill PDF
 *     tags: [Bills]
 *     description: Download generated bill as PDF file
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="bill_BILL-241214-1234567.pdf"'
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "application/pdf"
 *       404:
 *         description: Bill PDF not found
 *       500:
 *         description: Failed to generate PDF
 */

/**
 * @swagger
 * /bills/{billId}/view:
 *   get:
 *     summary: View bill PDF inline
 *     tags: [Bills]
 *     description: View bill PDF in browser
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     responses:
 *       200:
 *         description: PDF displayed inline
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'inline; filename="bill_BILL-241214-1234567.pdf"'
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "application/pdf"
 *       404:
 *         description: PDF not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/{billId}/payment-qr:
 *   get:
 *     summary: Get payment QR code
 *     tags: [Bill Payments]
 *     description: Generate UPI payment QR code for bill
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     responses:
 *       200:
 *         description: Payment QR code generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentQRResponse'
 *       404:
 *         description: Bill not found
 *       500:
 *         description: Failed to generate QR code
 */

/**
 * @swagger
 * /bills/admin/list:
 *   get:
 *     summary: Get bills list (Admin/Manager only)
 *     tags: [Bill Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/schemas/BillFilters'
 *     responses:
 *       200:
 *         description: List of bills with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BillListResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bills/admin/statistics:
 *   get:
 *     summary: Get bill statistics (Admin/Manager only)
 *     tags: [Bill Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill statistics and revenue
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BillStatistics'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */