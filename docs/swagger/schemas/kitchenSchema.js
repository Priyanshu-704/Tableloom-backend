/**
 * @swagger
 * components:
 *   schemas:
 *     KitchenOrderItem:
 *       type: object
 *       required:
 *         - menuItem
 *         - quantity
 *       properties:
 *         _id:
 *           type: string
 *           description: Kitchen order item ID
 *         menuItem:
 *           type: string
 *           description: Menu item ID
 *         menuItemName:
 *           type: string
 *           description: Menu item name
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         specialInstructions:
 *           type: string
 *           nullable: true
 *         station:
 *           type: string
 *           nullable: true
 *           description: Kitchen station ID
 *         status:
 *           type: string
 *           enum: [pending, accepted, preparing, ready, served, cancelled]
 *           default: pending
 *         assignedTo:
 *           type: string
 *           nullable: true
 *           description: User ID assigned to this item
 *         startTime:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         readyTime:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         timer:
 *           type: integer
 *           description: Timer in seconds
 *         estimatedCompletion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         allergens:
 *           type: array
 *           items:
 *             type: string
 *         modifications:
 *           type: array
 *           items:
 *             type: string
 *         colorCode:
 *           type: string
 *           description: Color code for display
 * 
 *     KitchenOrder:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Kitchen order ID
 *         order:
 *           type: string
 *           description: Main order ID
 *         orderNumber:
 *           type: string
 *           description: Order number
 *         tableNumber:
 *           type: string
 *           description: Table number
 *         customerName:
 *           type: string
 *           nullable: true
 *         priority:
 *           type: string
 *           enum: [low, normal, high, rush, vip]
 *           default: normal
 *         orderType:
 *           type: string
 *           enum: [dine-in, takeaway, delivery]
 *           default: dine-in
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/KitchenOrderItem'
 *         overallStatus:
 *           type: string
 *           enum: [pending, in_progress, ready, completed, cancelled]
 *           default: pending
 *         progress:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           description: Progress percentage
 *         stationAssignments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               station:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *         timers:
 *           type: object
 *           properties:
 *             orderReceived:
 *               type: string
 *               format: date-time
 *             kitchenAccepted:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             startedCooking:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             completedCooking:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             served:
 *               type: string
 *               format: date-time
 *               nullable: true
 *         timeMetrics:
 *           type: object
 *           properties:
 *             acceptTime:
 *               type: integer
 *               description: Seconds from received to accepted
 *             preparationTime:
 *               type: integer
 *               description: Seconds from accepted to completed
 *             totalTime:
 *               type: integer
 *               description: Seconds from received to served
 *         notes:
 *           type: string
 *           nullable: true
 *         isUrgent:
 *           type: boolean
 *           default: false
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     KitchenStation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Station ID
 *         name:
 *           type: string
 *           description: Station name
 *         stationType:
 *           type: string
 *           enum: [preparation, cooking, grilling, frying, baking, dessert, beverage]
 *         colorCode:
 *           type: string
 *           description: Color for UI display
 *         capacity:
 *           type: integer
 *           description: Maximum concurrent items
 *         currentLoad:
 *           type: integer
 *           description: Current items being processed
 *         status:
 *           type: string
 *           enum: [active, busy, maintenance, closed]
 *           default: active
 *         assignedUsers:
 *           type: array
 *           items:
 *             type: string
 *           description: User IDs assigned to this station
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     KitchenAnalytics:
 *       type: object
 *       properties:
 *         dailyAnalytics:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Date (YYYY-MM-DD)
 *               totalOrders:
 *                 type: integer
 *               avgPreparationTime:
 *                 type: number
 *               avgTotalTime:
 *                 type: number
 *               onTimeRate:
 *                 type: number
 *               minPrepTime:
 *                 type: number
 *               maxPrepTime:
 *                 type: number
 *               medianPrepTime:
 *                 type: number
 *         overallStats:
 *           type: object
 *           properties:
 *             totalOrders:
 *               type: integer
 *             avgPreparationTime:
 *               type: number
 *             avgTotalTime:
 *               type: number
 *             overallOnTimeRate:
 *               type: number
 *             quickestDay:
 *               type: object
 *               nullable: true
 *             busiestDay:
 *               type: object
 *               nullable: true
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *             endDate:
 *               type: string
 *               format: date
 *         sortBy:
 *           type: string
 * 
 *     DelayAnalysis:
 *       type: object
 *       properties:
 *         orderNumber:
 *           type: string
 *         tableNumber:
 *           type: string
 *         customerName:
 *           type: string
 *           nullable: true
 *         priority:
 *           type: string
 *         overallStatus:
 *           type: object
 *           properties:
 *             hasDelayedItems:
 *               type: boolean
 *             delayedItemsCount:
 *               type: integer
 *             maxDelayMinutes:
 *               type: number
 *             averageDelayMinutes:
 *               type: number
 *             alertLevel:
 *               type: string
 *               enum: [critical, warning, normal]
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               menuItemName:
 *                 type: string
 *               status:
 *                 type: string
 *               preparationTime:
 *                 type: number
 *                 nullable: true
 *               estimatedCompletion:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               delayStatus:
 *                 type: string
 *               delayColor:
 *                 type: string
 *               delayMinutes:
 *                 type: number
 *               isDelayed:
 *                 type: boolean
 *               station:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *         timers:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 * 
 *     StationStatistics:
 *       type: object
 *       properties:
 *         station:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             stationType:
 *               type: string
 *             currentLoad:
 *               type: integer
 *             capacity:
 *               type: integer
 *             loadPercentage:
 *               type: number
 *         dailyStatistics:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               itemsCompleted:
 *                 type: integer
 *               avgPreparationTime:
 *                 type: number
 *               totalPreparationTime:
 *                 type: number
 *               delayedItems:
 *                 type: integer
 *         overallStats:
 *           type: object
 *           properties:
 *             totalItemsCompleted:
 *               type: integer
 *             avgDailyItems:
 *               type: number
 *             avgPreparationTime:
 *               type: number
 *             delayedRate:
 *               type: number
 *             efficiencyScore:
 *               type: number
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *             endDate:
 *               type: string
 *               format: date
 *             days:
 *               type: integer
 * 
 *     KitchenFilters:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, accepted, preparing, ready, served, cancelled]
 *           description: Filter by item status
 *         sortBy:
 *           type: string
 *           enum: [preparationTime, estimatedCompletion, priority, createdAt, quantity]
 *           default: preparationTime
 *           description: Sort order
 *         priority:
 *           type: string
 *           enum: [vip, high, normal]
 *           description: Filter by priority
 *         includeDelayed:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *           description: Include only delayed orders
 *         days:
 *           type: integer
 *           default: 7
 *           description: Days for analytics
 *         startDate:
 *           type: string
 *           format: date
 *           description: Start date for analytics
 *         endDate:
 *           type: string
 *           format: date
 *           description: End date for analytics
 */