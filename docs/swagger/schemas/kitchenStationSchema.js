/**
 * @swagger
 * components:
 *   schemas:
 *     KitchenStation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Station ID
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           description: Station name
 *           example: "Grill Station"
 *         stationType:
 *           type: string
 *           enum: [grill, fryer, salad, pizza, dessert, beverage, expediter]
 *           description: Type of station
 *           example: "grill"
 *         assignedStaff:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               staff:
 *                 type: string
 *                 description: User ID
 *                 example: "507f1f77bcf86cd799439012"
 *               shiftStart:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-28T09:00:00.000Z"
 *               shiftEnd:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-28T17:00:00.000Z"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 1
 *           example: 3
 *         currentLoad:
 *           type: integer
 *           default: 0
 *           example: 2
 *         status:
 *           type: string
 *           enum: [active, maintenance, closed]
 *           default: active
 *           example: "active"
 *         preparationTimes:
 *           type: object
 *           properties:
 *             min:
 *               type: integer
 *               description: Minimum preparation time in minutes
 *               example: 5
 *             max:
 *               type: integer
 *               description: Maximum preparation time in minutes
 *               example: 30
 *             average:
 *               type: integer
 *               description: Average preparation time in minutes
 *               example: 15
 *         menuItems:
 *           type: array
 *           items:
 *             type: string
 *           description: Assigned menu item IDs
 *           example: ["item1", "item2"]
 *         colorCode:
 *           type: string
 *           default: "#4CAF50"
 *           example: "#FF5722"
 *         displayOrder:
 *           type: integer
 *           default: 0
 *           example: 1
 *         isActive:
 *           type: boolean
 *           default: true
 *           example: true
 *         assignedCategories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               name:
 *                 type: string
 *                 example: "Grilled Items"
 *               description:
 *                 type: string
 *                 example: "All grilled menu items"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *         categoryCount:
 *           type: integer
 *           example: 3
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T10:30:00.000Z"
 *
 *     CreateKitchenStationRequest:
 *       type: object
 *       required:
 *         - name
 *         - stationType
 *       properties:
 *         name:
 *           type: string
 *           description: Station name
 *           example: "Grill Station"
 *         stationType:
 *           type: string
 *           enum: [grill, fryer, salad, pizza, dessert, beverage, expediter]
 *           example: "grill"
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 1
 *           example: 3
 *         colorCode:
 *           type: string
 *           default: "#4CAF50"
 *           example: "#FF5722"
 *         displayOrder:
 *           type: integer
 *           default: 0
 *           example: 1
 *         status:
 *           type: string
 *           enum: [active, maintenance, closed]
 *           default: active
 *           example: "active"
 *         preparationTimes:
 *           type: object
 *           properties:
 *             min:
 *               type: integer
 *               default: 5
 *               example: 5
 *             max:
 *               type: integer
 *               default: 30
 *               example: 25
 *             average:
 *               type: integer
 *               default: 15
 *               example: 15
 *
 *     UpdateKitchenStationRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Station name
 *           example: "Main Grill Station"
 *         stationType:
 *           type: string
 *           enum: [grill, fryer, salad, pizza, dessert, beverage, expediter]
 *           example: "grill"
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           example: 4
 *         colorCode:
 *           type: string
 *           example: "#E91E63"
 *         displayOrder:
 *           type: integer
 *           example: 2
 *         status:
 *           type: string
 *           enum: [active, maintenance, closed]
 *           example: "active"
 *
 *     StationDashboard:
 *       type: object
 *       properties:
 *         station:
 *           $ref: '#/components/schemas/KitchenStation'
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               name:
 *                 type: string
 *                 example: "Grilled Items"
 *         menuItems:
 *           type: object
 *           properties:
 *             count:
 *               type: integer
 *               example: 15
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "507f1f77bcf86cd799439014"
 *                   name:
 *                     type: string
 *                     example: "Grilled Chicken"
 *                   category:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "Grilled Items"
 *                   preparationTime:
 *                     type: integer
 *                     example: 20
 *         currentOrders:
 *           type: object
 *           properties:
 *             count:
 *               type: integer
 *               example: 3
 *             orders:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   orderId:
 *                     type: string
 *                     example: "507f1f77bcf86cd799439015"
 *                   orderNumber:
 *                     type: string
 *                     example: "ORD-2024-001"
 *                   tableNumber:
 *                     type: string
 *                     example: "T05"
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         status:
 *                           type: string
 *                         preparationTime:
 *                           type: integer
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-28T11:30:00.000Z"
 *         loadMetrics:
 *           type: object
 *           properties:
 *             current:
 *               type: integer
 *               example: 2
 *             capacity:
 *               type: integer
 *               example: 3
 *             loadPercentage:
 *               type: integer
 *               minimum: 0
 *               maximum: 100
 *               example: 67
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
 *         assignedCategories:
 *           type: integer
 *           example: 5
 *
 *   responses:
 *     Unauthorized:
 *       description: Not authenticated
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Not authenticated"
 *             error: "No token provided"
 *
 *     Forbidden:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Access denied"
 *             error: "Insufficient permissions"
 *
 *     StationNotFound:
 *       description: Kitchen station not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Kitchen station not found"
 *             error: "Station with id 507f1f77bcf86cd799439011 not found"
 *
 *     CategoryNotFound:
 *       description: Category not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Category not found"
 *             error: "Category with id 507f1f77bcf86cd799439013 not found"
 *
 *     StationNameExists:
 *       description: Station name already exists
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Kitchen station with this name already exists"
 *             error: "Station name 'Grill Station' is already in use"
 *
 *     CannotDeleteWithCategories:
 *       description: Cannot delete station with assigned categories
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Cannot delete kitchen station because categories are assigned to it. Please reassign categories first."
 *             error: "Station has 5 assigned categories"
 *             assignedCategories: 5
 *
 *     CategoryNotAssigned:
 *       description: Category is not assigned to this station
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "This category is not assigned to this station"
 *             error: "Category Appetizers is not assigned to Grill Station"
 *
 *     ServerError:
 *       description: Server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Server error"
 *             error: "Database connection failed"
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   - name: Kitchen Stations Management
 *     description: Kitchen station setup and management
 */
