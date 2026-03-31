/**
 * @swagger
 * components:
 *   schemas:
 *     WaiterCall:
 *       type: object
 *       required:
 *         - callId
 *         - sessionId
 *         - customer
 *         - table
 *         - tableNumber
 *       properties:
 *         callId:
 *           type: string
 *           description: Unique call identifier
 *           example: "CALL-123456789"
 *         sessionId:
 *           type: string
 *           description: Customer session identifier
 *           example: "session_abc123"
 *         customer:
 *           type: string
 *           description: Reference to Customer model
 *           example: "5f8d0d55b54764421b7156c5"
 *         table:
 *           type: string
 *           description: Reference to Table model
 *           example: "5f8d0d55b54764421b7156c6"
 *         tableNumber:
 *           type: string
 *           description: Table number
 *           example: "T-12"
 *         status:
 *           type: string
 *           enum: [pending, assigned, acknowledged, in_progress, completed, cancelled]
 *           default: pending
 *           description: Current status of the call
 *         callType:
 *           type: string
 *           enum: [waiter, bill, assistance, order_help, other, emergency, billing, order]
 *           default: waiter
 *           description: Type of call
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent, critical]
 *           default: medium
 *           description: Priority level
 *         message:
 *           type: string
 *           maxLength: 200
 *           description: Optional message from customer
 *           example: "Need extra napkins"
 *         acknowledgedBy:
 *           type: string
 *           description: Staff member who acknowledged the call
 *           example: "5f8d0d55b54764421b7156c7"
 *         acknowledgedAt:
 *           type: string
 *           format: date-time
 *           description: When the call was acknowledged
 *         completedBy:
 *           type: string
 *           description: Staff member who completed the call
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the call was completed
 *         responseTime:
 *           type: number
 *           description: Time taken to acknowledge (seconds)
 *         resolutionTime:
 *           type: number
 *           description: Time taken to complete (seconds)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the call was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the call was last updated
 * 
 *     CreateWaiterCallRequest:
 *       type: object
 *       required:
 *         - sessionId
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "session_abc123"
 *         callType:
 *           type: string
 *           enum: [waiter, bill, assistance, order_help, other, emergency, billing, order]
 *           default: waiter
 *           example: "waiter"
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent, critical]
 *           default: medium
 *           example: "medium"
 *         message:
 *           type: string
 *           maxLength: 200
 *           example: "Need water refill"
 *         coordinates:
 *           type: object
 *           properties:
 *             x:
 *               type: number
 *             y:
 *               type: number
 * 
 *     AcknowledgeCallRequest:
 *       type: object
 *       properties:
 *         estimatedTime:
 *           type: number
 *           description: Estimated time to respond (minutes)
 *           example: 5
 * 
 *     CompleteCallRequest:
 *       type: object
 *       properties:
 *         resolutionNotes:
 *           type: string
 *           description: Notes about how the call was resolved
 *           example: "Provided water refill and took dessert order"
 * 
 *     CancelCallRequest:
 *       type: object
 *       required:
 *         - sessionId
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "session_abc123"
 *         reason:
 *           type: string
 *           example: "Changed mind"
 * 
 *     UpdateCallStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, assigned, acknowledged, in_progress, completed, cancelled]
 *           example: "acknowledged"
 *         notes:
 *           type: string
 *           example: "Being handled by staff"
 * 
 *     AssignCallRequest:
 *       type: object
 *       required:
 *         - staffId
 *       properties:
 *         staffId:
 *           type: string
 *           example: "5f8d0d55b54764421b7156c7"
 * 
 *     CallStatistics:
 *       type: object
 *       properties:
 *         totalCalls:
 *           type: number
 *           example: 150
 *         pendingCalls:
 *           type: number
 *           example: 5
 *         acknowledgedCalls:
 *           type: number
 *           example: 3
 *         completedCalls:
 *           type: number
 *           example: 142
 *         averageResponseTime:
 *           type: number
 *           example: 120.5
 *         averageResolutionTime:
 *           type: number
 *           example: 300.2
 *         callsByType:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             waiter: 100
 *             bill: 30
 *             assistance: 15
 *             order_help: 5
 *         callsByPriority:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             low: 20
 *             medium: 100
 *             high: 25
 *             urgent: 5
 * 
 *     StaffPerformance:
 *       type: object
 *       properties:
 *         staffId:
 *           type: string
 *         staffName:
 *           type: string
 *         totalCallsHandled:
 *           type: number
 *         avgResponseTime:
 *           type: number
 *         avgResolutionTime:
 *           type: number
 *         callsByStatus:
 *           type: object
 *         satisfactionScore:
 *           type: number
 * 
 *     CallDashboard:
 *       type: object
 *       properties:
 *         activeCalls:
 *           type: number
 *           example: 8
 *         pendingCalls:
 *           type: number
 *           example: 5
 *         acknowledgedCalls:
 *           type: number
 *           example: 3
 *         todayCalls:
 *           type: number
 *           example: 25
 *         avgResponseTimeToday:
 *           type: number
 *           example: 150.5
 *         topStaff:
 *           type: array
 *           items:
 *             type: object
 *         recentCalls:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WaiterCall'
 * 
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation successful"
 *         data:
 *           type: object
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
 * 
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         count:
 *           type: number
 *           example: 10
 *         total:
 *           type: number
 *           example: 100
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: number
 *               example: 1
 *             pages:
 *               type: number
 *               example: 10
 *         data:
 *           type: array
 *           items:
 *             type: object
 * 
 *   parameters:
 *     callIdParam:
 *       name: callId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *       description: Waiter call ID
 *       example: "CALL-123456789"
 * 
 *     staffIdParam:
 *       name: staffId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *       description: Staff member ID
 *       example: "5f8d0d55b54764421b7156c7"
 * 
 *     statusQueryParam:
 *       name: status
 *       in: query
 *       schema:
 *         type: string
 *         enum: [pending, assigned, acknowledged, in_progress, completed, cancelled]
 *       description: Filter by status
 * 
 *     callTypeQueryParam:
 *       name: callType
 *       in: query
 *       schema:
 *         type: string
 *         enum: [waiter, bill, assistance, order_help, other, emergency, billing, order]
 *       description: Filter by call type
 * 
 *     priorityQueryParam:
 *       name: priority
 *       in: query
 *       schema:
 *         type: string
 *         enum: [low, medium, high, urgent, critical]
 *       description: Filter by priority
 * 
 *     pageQueryParam:
 *       name: page
 *       in: query
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number
 * 
 *     limitQueryParam:
 *       name: limit
 *       in: query
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 20
 *       description: Items per page
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
