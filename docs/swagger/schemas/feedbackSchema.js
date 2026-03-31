/**
 * @swagger
 * components:
 *   schemas:
 *     Feedback:
 *       type: object
 *       required:
 *         - customer
 *         - order
 *         - sessionId
 *         - ratings.overall
 *       properties:
 *         customer:
 *           type: string
 *           description: Reference to Customer model
 *           example: "5f8d0d55b54764421b7156c5"
 *         order:
 *           type: string
 *           description: Reference to Order model
 *           example: "5f8d0d55b54764421b7156c6"
 *         table:
 *           type: string
 *           description: Reference to Table model
 *         sessionId:
 *           type: string
 *           description: Customer session identifier
 *           example: "session_abc123"
 *         ratings:
 *           type: object
 *           required:
 *             - overall
 *           properties:
 *             overall:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4
 *             food:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 5
 *             service:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4
 *             ambiance:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 5
 *             value:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4
 *         comments:
 *           type: string
 *           maxLength: 1000
 *           example: "Great food and excellent service!"
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *             enum: [
 *               'food_quality', 'service_speed', 'staff_friendliness',
 *               'cleanliness', 'value_for_money', 'atmosphere',
 *               'menu_variety', 'waiting_time', 'order_accuracy'
 *             ]
 *           example: ["food_quality", "staff_friendliness"]
 *         sentiment:
 *           type: string
 *           enum: ['positive', 'neutral', 'negative']
 *           default: 'neutral'
 *         highlights:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Quick service", "Delicious desserts"]
 *         issues:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Long wait time", "Cold food"]
 *         staffMentions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               staff:
 *                 type: string
 *                 description: Reference to User model
 *               comment:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *         menuItemRatings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               menuItem:
 *                 type: string
 *                 description: Reference to MenuItem model
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *         wouldRecommend:
 *           type: boolean
 *           example: true
 *         visitPurpose:
 *           type: string
 *           enum: ['business', 'casual_dining', 'celebration', 'date', 'family', 'quick_meal']
 *         waitTime:
 *           type: number
 *           description: Waiting time in minutes
 *           example: 15
 *         response:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *             respondedBy:
 *               type: string
 *               description: Reference to User model
 *             respondedAt:
 *               type: string
 *               format: date-time
 *         status:
 *           type: string
 *           enum: ['new', 'reviewed', 'action_required', 'resolved', 'archived']
 *           default: 'new'
 *         priority:
 *           type: string
 *           enum: ['low', 'medium', 'high', 'critical']
 *           default: 'medium'
 *         followUpRequired:
 *           type: boolean
 *           default: false
 *         isAnonymous:
 *           type: boolean
 *           default: false
 *         source:
 *           type: string
 *           enum: ['qr_system', 'email', 'website', 'social_media', 'phone']
 *           default: 'qr_system'
 *         metadata:
 *           type: object
 *           properties:
 *             device:
 *               type: string
 *               example: "iPhone"
 *             browser:
 *               type: string
 *               example: "Safari"
 *             ipAddress:
 *               type: string
 *               example: "192.168.1.1"
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
 *     SubmitFeedbackRequest:
 *       type: object
 *       required:
 *         - sessionId
 *         - ratings.overall
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "session_abc123"
 *         ratings:
 *           type: object
 *           required:
 *             - overall
 *           properties:
 *             overall:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4
 *             food:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 5
 *             service:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4
 *             ambiance:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 5
 *             value:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4
 *         comments:
 *           type: string
 *           example: "Excellent service and delicious food!"
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *             enum: [
 *               'food_quality', 'service_speed', 'staff_friendliness',
 *               'cleanliness', 'value_for_money', 'atmosphere',
 *               'menu_variety', 'waiting_time', 'order_accuracy'
 *             ]
 *         highlights:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Great ambiance", "Friendly staff"]
 *         issues:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Long wait for drinks"]
 *         wouldRecommend:
 *           type: boolean
 *           example: true
 *         visitPurpose:
 *           type: string
 *           enum: ['business', 'casual_dining', 'celebration', 'date', 'family', 'quick_meal']
 *         waitTime:
 *           type: number
 *           example: 10
 *         isAnonymous:
 *           type: boolean
 *           default: false
 * 
 *     CustomerDetailsForFeedback:
 *       type: object
 *       properties:
 *         session:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             isActive:
 *               type: boolean
 *         customer:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *         order:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             orderNumber:
 *               type: string
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *         table:
 *           type: object
 *           properties:
 *             tableNumber:
 *               type: string
 *         canSubmit:
 *           type: boolean
 *         message:
 *           type: string
 * 
 *     CanSubmitFeedbackResponse:
 *       type: object
 *       properties:
 *         canSubmit:
 *           type: boolean
 *         message:
 *           type: string
 *         feedbackExists:
 *           type: boolean
 *         order:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             orderNumber:
 *               type: string
 * 
 *     RespondToFeedbackRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           example: "Thank you for your valuable feedback!"
 * 
 *     UpdateFeedbackStatusRequest:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: ['new', 'reviewed', 'action_required', 'resolved', 'archived']
 *           example: "resolved"
 *         priority:
 *           type: string
 *           enum: ['low', 'medium', 'high', 'critical']
 *           example: "low"
 *         followUpRequired:
 *           type: boolean
 *           example: false
 * 
 *     FeedbackStatistics:
 *       type: object
 *       properties:
 *         totalFeedback:
 *           type: number
 *           example: 150
 *         averageRating:
 *           type: number
 *           example: 4.2
 *         sentimentDistribution:
 *           type: object
 *           properties:
 *             positive:
 *               type: number
 *               example: 100
 *             neutral:
 *               type: number
 *               example: 30
 *             negative:
 *               type: number
 *               example: 20
 *         categoryDistribution:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             food_quality: 80
 *             service_speed: 45
 *             staff_friendliness: 60
 *         statusDistribution:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             new: 10
 *             reviewed: 80
 *             resolved: 60
 *         recentTrend:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *               count:
 *                 type: number
 *               averageRating:
 *                 type: number
 * 
 *     NPSData:
 *       type: object
 *       properties:
 *         npsScore:
 *           type: number
 *           example: 45.5
 *         promoters:
 *           type: number
 *           example: 60
 *         passives:
 *           type: number
 *           example: 30
 *         detractors:
 *           type: number
 *           example: 10
 *         promoterPercentage:
 *           type: number
 *           example: 60
 *         detractorPercentage:
 *           type: number
 *           example: 10
 * 
 *     TrendingTopic:
 *       type: object
 *       properties:
 *         category:
 *           type: string
 *         count:
 *           type: number
 *         sentiment:
 *           type: string
 *         averageRating:
 *           type: number
 * 
 *     StaffPerformanceData:
 *       type: object
 *       properties:
 *         staffId:
 *           type: string
 *         staffName:
 *           type: string
 *         mentionedCount:
 *           type: number
 *         averageMentionRating:
 *           type: number
 *         positiveMentions:
 *           type: number
 *         negativeMentions:
 *           type: number
 * 
 *     FeedbackDashboard:
 *       type: object
 *       properties:
 *         recentFeedback:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Feedback'
 *         statistics:
 *           $ref: '#/components/schemas/FeedbackStatistics'
 *         nps:
 *           $ref: '#/components/schemas/NPSData'
 *         trendingTopics:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TrendingTopic'
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
 *     feedbackIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *       description: Feedback ID
 *       example: "5f8d0d55b54764421b7156c8"
 * 
 *     sessionIdParam:
 *       name: sessionId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *       description: Customer session ID
 *       example: "session_abc123"
 * 
 *     statusQueryParam:
 *       name: status
 *       in: query
 *       schema:
 *         type: string
 *         enum: ['new', 'reviewed', 'action_required', 'resolved', 'archived']
 *       description: Filter feedback by status
 * 
 *     sentimentQueryParam:
 *       name: sentiment
 *       in: query
 *       schema:
 *         type: string
 *         enum: ['positive', 'neutral', 'negative']
 *       description: Filter feedback by sentiment
 * 
 *     priorityQueryParam:
 *       name: priority
 *       in: query
 *       schema:
 *         type: string
 *         enum: ['low', 'medium', 'high', 'critical']
 *       description: Filter feedback by priority
 * 
 *     hasResponseQueryParam:
 *       name: hasResponse
 *       in: query
 *       schema:
 *         type: string
 *         enum: ['true', 'false']
 *       description: Filter feedback by response status
 * 
 *     periodQueryParam:
 *       name: period
 *       in: query
 *       schema:
 *         type: string
 *         enum: ['7days', '30days', '90days', 'year', 'all']
 *         default: '30days'
 *       description: Time period for statistics
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