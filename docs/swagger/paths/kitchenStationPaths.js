/**
 * @swagger
 * /kitchen-stations:
 *   get:
 *     summary: Get all kitchen stations (Chef/Manager/Admin only)
 *     description: |
 *       Returns all kitchen stations sorted by display order and name.
 *       Includes assigned categories and category count.
 *       Permission levels:
 *       - Admin: All stations
 *       - Manager: All stations  
 *       - Chef: All stations
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of kitchen stations with categories
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
 *                   description: Number of stations
 *                   example: 8
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       name:
 *                         type: string
 *                         example: "Grill Station"
 *                       stationType:
 *                         type: string
 *                         example: "grill"
 *                       capacity:
 *                         type: integer
 *                         example: 3
 *                       currentLoad:
 *                         type: integer
 *                         example: 2
 *                       status:
 *                         type: string
 *                         example: "active"
 *                       colorCode:
 *                         type: string
 *                         example: "#FF5722"
 *                       displayOrder:
 *                         type: integer
 *                         example: 1
 *                       assignedCategories:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             description:
 *                               type: string
 *                       categoryCount:
 *                         type: integer
 *                         example: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations/{id}:
 *   get:
 *     summary: Get kitchen station by ID (Chef/Manager/Admin only)
 *     description: Returns detailed station information with assigned categories
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Kitchen station details with assigned categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     name:
 *                       type: string
 *                       example: "Grill Station"
 *                     stationType:
 *                       type: string
 *                       example: "grill"
 *                     capacity:
 *                       type: integer
 *                       example: 3
 *                     currentLoad:
 *                       type: integer
 *                       example: 2
 *                     status:
 *                       type: string
 *                       example: "active"
 *                     assignedCategories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439013"
 *                           name:
 *                             type: string
 *                             example: "Grilled Items"
 *                           description:
 *                             type: string
 *                             example: "All grilled menu items"
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/StationNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations/{id}/dashboard:
 *   get:
 *     summary: Get station dashboard (Chef/Manager/Admin only)
 *     description: |
 *       Returns comprehensive dashboard data for a station including:
 *       - Station details
 *       - Assigned categories
 *       - Menu items (limited to 10)
 *       - Current active orders
 *       - Load metrics (current load vs capacity)
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Station dashboard with metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationDashboard'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/StationNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations:
 *   post:
 *     summary: Create new kitchen station (Manager/Admin only)
 *     description: |
 *       Creates a new kitchen station with the provided details.
 *       Requires unique station name.
 *       Generates default values for missing fields.
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateKitchenStationRequest'
 *     responses:
 *       201:
 *         description: Kitchen station created successfully
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
 *                   example: "Kitchen station created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/KitchenStation'
 *       400:
 *         $ref: '#/components/responses/StationNameExists'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations/{id}:
 *   put:
 *     summary: Update kitchen station (Manager/Admin only)
 *     description: |
 *       Updates kitchen station details.
 *       Validates new station name for uniqueness.
 *       Only updates provided fields.
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateKitchenStationRequest'
 *     responses:
 *       200:
 *         description: Kitchen station updated successfully
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
 *                   example: "Kitchen station updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/KitchenStation'
 *       400:
 *         $ref: '#/components/responses/StationNameExists'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/StationNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations/{id}:
 *   delete:
 *     summary: Delete kitchen station (Admin only)
 *     description: |
 *       Deletes kitchen station if no categories are assigned.
 *       Validation prevents deletion if station has assigned categories.
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Kitchen station deleted successfully
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
 *                   example: "Kitchen station deleted successfully"
 *       400:
 *         $ref: '#/components/responses/CannotDeleteWithCategories'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/StationNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations/{id}/assign-category/{categoryId}:
 *   put:
 *     summary: Assign category to station (Manager/Admin only)
 *     description: Assigns a category to a kitchen station for order routing
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID to assign
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Category assigned to station successfully
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
 *                   example: 'Category "Grilled Items" assigned to "Grill Station" station'
 *                 data:
 *                   type: object
 *                   properties:
 *                     station:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "Grill Station"
 *                         stationType:
 *                           type: string
 *                           example: "grill"
 *                     category:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439013"
 *                         name:
 *                           type: string
 *                           example: "Grilled Items"
 *       400:
 *         description: Category already assigned to this station
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Category is already assigned to this station"
 *               error: "Category Grilled Items is already assigned to Grill Station"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/StationNotFound'
 *                 - $ref: '#/components/responses/CategoryNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /kitchen-stations/{id}/remove-category/{categoryId}:
 *   delete:
 *     summary: Remove category from station (Manager/Admin only)
 *     description: Removes a category assignment from a kitchen station
 *     tags: [Kitchen Stations Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kitchen station ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID to remove
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Category removed from station successfully
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
 *                   example: 'Category "Grilled Items" removed from "Grill Station" station'
 *       400:
 *         $ref: '#/components/responses/CategoryNotAssigned'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/StationNotFound'
 *                 - $ref: '#/components/responses/CategoryNotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */