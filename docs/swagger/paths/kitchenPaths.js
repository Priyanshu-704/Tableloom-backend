/**
 * @swagger
 * tags:
 *   - name: Kitchen Orders
 *     description: Kitchen order management and tracking
 *   - name: Kitchen Stations
 *     description: Kitchen station management
 *   - name: Kitchen Analytics
 *     description: Kitchen performance analytics
 *   - name: Delay Management
 *     description: Order delay tracking and management
 */

/**
 * @swagger
 * /kitchen/orders/sorted:
 *   get:
 *     summary: Get sorted kitchen orders (Chef/Manager/Admin only)
 *     tags: [Kitchen Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [preparationTime, estimatedCompletion, priority, createdAt, quantity]
 *           default: preparationTime
 *         description: Sort criteria
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: Filter by station ID
 *     responses:
 *       200:
 *         description: List of sorted kitchen orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sortBy:
 *                   type: string
 *                 station:
 *                   type: object
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KitchenOrder'
 *       400:
 *         description: Invalid sort option or station ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/stations/{stationId}/orders:
 *   get:
 *     summary: Get orders by kitchen station (Chef/Manager/Admin only)
 *     tags: [Kitchen Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, preparing, ready, served, cancelled]
 *           default: pending
 *         description: Filter by item status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [preparationTime, estimatedCompletion, priority, createdAt, quantity]
 *           default: preparationTime
 *         description: Sort criteria
 *     responses:
 *       200:
 *         description: List of orders for station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KitchenOrder'
 *                 station:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     stationType:
 *                       type: string
 *                 status:
 *                   type: string
 *                 sortBy:
 *                   type: string
 *       400:
 *         description: Invalid station ID or status
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/stations/{stationId}/filtered-orders:
 *   get:
 *     summary: Get filtered orders for station (Chef/Manager/Admin only)
 *     tags: [Kitchen Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *       - $ref: '#/components/schemas/KitchenFilters'
 *     responses:
 *       200:
 *         description: Filtered orders for station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     station:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         stationType:
 *                           type: string
 *                         colorCode:
 *                           type: string
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/KitchenOrder'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         sortBy:
 *                           type: string
 *                         priority:
 *                           type: string
 *                         includeDelayed:
 *                           type: boolean
 *                     counts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         vip:
 *                           type: integer
 *                         high:
 *                           type: integer
 *                         normal:
 *                           type: integer
 *                 stationId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/stations/{stationId}/statistics:
 *   get:
 *     summary: Get station statistics (Manager/Admin only)
 *     tags: [Kitchen Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days for statistics
 *     responses:
 *       200:
 *         description: Station statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationStatistics'
 *       400:
 *         description: Invalid station ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/orders/{kitchenOrderId}/items/{itemId}/start:
 *   put:
 *     summary: Start preparing item (Chef/Manager/Admin only)
 *     tags: [Kitchen Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kitchenOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen order ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order item ID
 *     responses:
 *       200:
 *         description: Item preparation started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Item preparation started"
 *                 data:
 *                   $ref: '#/components/schemas/KitchenOrder'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order or item not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/orders/{kitchenOrderId}/items/{itemId}/ready:
 *   put:
 *     summary: Mark item as ready (Chef/Manager/Admin only)
 *     tags: [Kitchen Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kitchenOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen order ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order item ID
 *     responses:
 *       200:
 *         description: Item marked as ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Item marked as ready"
 *                 data:
 *                   $ref: '#/components/schemas/KitchenOrder'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order or item not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/orders/{kitchenOrderId}/items/{itemId}/served:
 *   put:
 *     summary: Mark item as served (Chef/Manager/Admin only)
 *     tags: [Kitchen Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kitchenOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen order ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order item ID
 *     responses:
 *       200:
 *         description: Item marked as served
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Item marked as served"
 *                 data:
 *                   $ref: '#/components/schemas/KitchenOrder'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order or item not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/analytics:
 *   get:
 *     summary: Get kitchen analytics (Manager/Admin only)
 *     tags: [Kitchen Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [avgPreparationTime, _id]
 *           default: avgPreparationTime
 *         description: Sort criteria
 *     responses:
 *       200:
 *         description: Kitchen analytics data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KitchenAnalytics'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/stations/{stationId}/orders/sorted:
 *   get:
 *     summary: Get sorted orders for specific station (Chef/Manager/Admin only)
 *     tags: [Kitchen Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [preparationTime, estimatedCompletion, priority, createdAt, quantity]
 *           default: preparationTime
 *         description: Sort criteria
 *     responses:
 *       200:
 *         description: Sorted orders for station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sortBy:
 *                   type: string
 *                 station:
 *                   type: object
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KitchenOrder'
 *       400:
 *         description: Invalid station ID or sort option
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/delayed:
 *   get:
 *     summary: Get delayed orders summary (Chef/Manager/Admin only)
 *     tags: [Delay Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delayed orders summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/delay-monitor/status:
 *   get:
 *     summary: Get delay monitor runtime status
 *     tags: [Delay Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delay monitor status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isRunning:
 *                       type: boolean
 *                     enabled:
 *                       type: boolean
 *                     intervalMinutes:
 *                       type: integer
 *                     lastCheck:
 *                       type: string
 *                       format: date-time
 *                     lastError:
 *                       type: string
 *                     lastRunSummary:
 *                       type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/check-delayed:
 *   post:
 *     summary: Check for delayed orders (Manager/Admin only)
 *     tags: [Delay Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delayed orders check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KitchenOrder'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/orders/{orderId}/delay-analysis:
 *   get:
 *     summary: Get order delay analysis (Chef/Manager/Admin only)
 *     tags: [Delay Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen order ID
 *     responses:
 *       200:
 *         description: Order delay analysis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DelayAnalysis'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/orders/{orderId}/acknowledge-delay:
 *   post:
 *     summary: Acknowledge order delay (Chef/Manager/Admin only)
 *     tags: [Delay Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notes about the delay
 *     responses:
 *       200:
 *         description: Delay acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Delay acknowledged"
 *                 data:
 *                   $ref: '#/components/schemas/KitchenOrder'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /kitchen/stations/{stationId}/delayed-orders:
 *   get:
 *     summary: Get delayed orders by station (Chef/Manager/Admin only)
 *     tags: [Delay Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *     responses:
 *       200:
 *         description: Delayed orders for station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 stationId:
 *                   type: string
 *                 stationName:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid station ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */
