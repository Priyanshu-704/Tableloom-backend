/**
 * @swagger
 * tags:
 *   - name: Table Management
 *     description: Restaurant table setup and management
 *   - name: QR Code Management
 *     description: Table QR code generation and management
 */

/**
 * @swagger
 * /tables:
 *   get:
 *     summary: Get all tables with filters (Role-based permissions)
 *     description: |
 *       Returns tables based on user role permissions:
 *       - Admin/Manager: All tables (including inactive)
 *       - Waiter/Chef: Only active tables
 *       - Others: Only active and available tables
 *       
 *       Filters are applied based on query parameters.
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, occupied, billing, reserved, maintenance, cleaning, inactive]
 *         description: Filter by table status
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *           enum: [indoor, outdoor, terrace, private-room, bar, main hall]
 *         description: Filter by location
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Filter active tables only
 *       - in: query
 *         name: capacity
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Filter by exact capacity
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of tables with QR codes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of tables in current page
 *                   example: 10
 *                 total:
 *                   type: integer
 *                   description: Total number of tables matching filters
 *                   example: 50
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Table'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}:
 *   get:
 *     summary: Get table by ID (Staff only)
 *     description: |
 *       Returns detailed table information.
 *       - Admin/Manager: Full details including notes and createdBy
 *       - Others: Limited details (notes and createdBy hidden)
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: Table details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Table'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables:
 *   post:
 *     summary: Create new table with QR code (Requires TABLE_CREATE permission)
 *     description: Creates a new table and generates QR code. QR token expires in 30 days.
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTableRequest'
 *     responses:
 *       201:
 *         description: Table created successfully with QR code
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
 *                   example: "Table created successfully with QR code"
 *       400:
 *         $ref: '#/components/responses/TableNumberExists'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}:
 *   put:
 *     summary: Update table (Requires TABLE_EDIT permission)
 *     description: Updates table details. Table number must be unique.
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTableRequest'
 *     responses:
 *       200:
 *         description: Table updated successfully
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
 *                   example: "Table updated successfully"
 *       400:
 *         $ref: '#/components/responses/TableNumberExists'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}:
 *   delete:
 *     summary: Delete table (Requires TABLE_DELETE permission)
 *     description: |
 *       Deletes table and its QR code file. Cannot delete if:
 *       - Table is occupied or billing
 *       - Table has current order
 *       - Table has active customer session
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: Table deleted successfully
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
 *                   example: "Table deleted successfully"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/OccupiedTableError'
 *                 - $ref: '#/components/responses/ActiveSessionError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}/status:
 *   put:
 *     summary: Update table status (Requires TABLE_UPDATE_STATUS permission)
 *     description: |
 *       Updates table status with validation rules:
 *       - available → [occupied, reserved, maintenance, cleaning]
 *       - occupied → [available, cleaning]
 *       - reserved → [available, occupied]
 *       - maintenance → [available]
 *       - cleaning → [available]
 *       
 *       Changing status to "available" ends all active customer sessions.
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTableStatusRequest'
 *     responses:
 *       200:
 *         description: Table status updated
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
 *                   example: "Table status updated to occupied"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/InvalidStatusTransition'
 *                 - $ref: '#/components/responses/ActiveSessionError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}/toggle-active:
 *   put:
 *     summary: Toggle table active status (Requires TABLE_EDIT permission)
 *     description: Activates or deactivates a table. Inactive tables are not shown to waiters/chefs.
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: Table status toggled
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
 *                   example: "Table activated successfully"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/dashboard/stats:
 *   get:
 *     summary: Get table statistics (Requires TABLE_VIEW_ALL permission)
 *     description: Returns occupancy statistics for active tables only
 *     tags: [Table Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Table occupancy statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TableStatistics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}/qr-download:
 *   get:
 *     summary: Download table QR code PNG file (Requires TABLE_VIEW_ALL permission)
 *     tags: [QR Code Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: QR code PNG file download
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             example: "attachment; filename=\"table-T01-qrcode.png\""
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: QR code not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "QR code not found"
 *               error: "No QR code generated for this table"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}/regenerate-qr:
 *   put:
 *     summary: Regenerate table QR code (Requires TABLE_EDIT permission)
 *     description: |
 *       Deletes old QR code file and generates new one with fresh token.
 *       Cannot regenerate if table is occupied.
 *     tags: [QR Code Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: QR code regenerated successfully
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
 *                   example: "QR code regenerated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/RegenerateQRResponse'
 *       400:
 *         description: Cannot regenerate QR for occupied table
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Cannot regenerate QR code for occupied table"
 *               error: "Table T01 is currently occupied"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}/qr-token-status:
 *   get:
 *     summary: Get QR token status (Requires TABLE_VIEW_ALL permission)
 *     description: Returns QR token validity information
 *     tags: [QR Code Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: QR token status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/QRTokenStatus'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /tables/{id}/table-refresh-token:
 *   post:
 *     summary: Refresh QR token (Requires TABLE_EDIT permission)
 *     description: Generates new QR token with 30-day expiry without regenerating QR image
 *     tags: [QR Code Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TableIdPath'
 *     responses:
 *       200:
 *         description: QR token refreshed successfully
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
 *                   example: "QR token refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokenExpiry:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-12-31T23:59:59.999Z"
 *                     tokenDaysRemaining:
 *                       type: integer
 *                       example: 30
 *                     tokenExpired:
 *                       type: boolean
 *                       example: false
 *                     qrCode:
 *                       type: string
 *                       nullable: true
 *                       example: "http://backend.url/images/table-qr/507f1f77bcf86cd799439011"
 *                     qrUrl:
 *                       type: string
 *                       example: "http://frontend.url/table/507f1f77bcf86cd799439011?token=newToken123"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/TableNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
