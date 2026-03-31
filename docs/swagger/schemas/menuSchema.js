/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Category ID
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           description: Category name
 *           example: "Appetizers"
 *         description:
 *           type: string
 *           description: Category description
 *           example: "Starters and small plates"
 *         image:
 *           type: string
 *           nullable: true
 *           description: Category image URL
 *           example: "http://api.example.com/images/category/507f1f77bcf86cd799439011"
 *         kitchenStation:
 *           type: string
 *           nullable: true
 *           description: Associated kitchen station ID
 *           example: "507f1f77bcf86cd799439012"
 *         displayOrder:
 *           type: integer
 *           description: Display order for sorting
 *           example: 1
 *         isActive:
 *           type: boolean
 *           description: Whether category is active
 *           example: true
 *         createdBy:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T11:30:00.000Z"
 * 
 *     Size Id:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Size ID
 *           example: "507f1f77bcf86cd799439013"
 *         name:
 *           type: string
 *           description: Size name (e.g., Small, Medium, Large)
 *           example: "Medium"
 *         code:
 *           type: string
 *           description: Size code (e.g., S, M, L)
 *           example: "M"
 *         isActive:
 *           type: boolean
 *           description: Whether size is active
 *           example: true
 *         createdBy:
 *           type: string
 *           description: User who created the size
 *           example: "507f1f77bcf86cd799439014"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T09:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T09:30:00.000Z"
 * 
 *     MenuItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Menu item ID
 *           example: "507f1f77bcf86cd799439015"
 *         name:
 *           type: string
 *           description: Menu item name
 *           example: "Grilled Chicken Caesar Salad"
 *         description:
 *           type: string
 *           nullable: true
 *           description: Menu item description
 *           example: "Fresh romaine lettuce with grilled chicken, parmesan, and Caesar dressing"
 *         image:
 *           type: string
 *           nullable: true
 *           description: Menu item image URL
 *           example: "http://api.example.com/images/menu-item/507f1f77bcf86cd799439015"
 *         category:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439011"
 *             name:
 *               type: string
 *               example: "Salads"
 *           description: Category details
 *         station:
 *           type: string
 *           description: Kitchen station ID
 *           example: "507f1f77bcf86cd799439016"
 *         prices:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               sizeId:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "507f1f77bcf86cd799439013"
 *                   name:
 *                     type: string
 *                     example: "Medium"
 *                   code:
 *                     type: string
 *                     example: "M"
 *               price:
 *                 type: number
 *                 example: 12.99
 *               costPrice:
 *                 type: number
 *                 nullable: true
 *                 example: 4.50
 *         ingredients:
 *           type: array
 *           items:
 *             type: string
 *           description: List of ingredients
 *           example: ["romaine lettuce", "grilled chicken", "parmesan cheese", "Caesar dressing", "croutons"]
 *         allergens:
 *           type: array
 *           items:
 *             type: string
 *           description: List of allergens
 *           example: ["dairy", "gluten"]
 *         spiceLevel:
 *           type: integer
 *           minimum: 0
 *           maximum: 5
 *           description: Spice level (0-5)
 *           example: 1
 *         preparationTime:
 *           type: integer
 *           description: Preparation time in minutes
 *           example: 15
 *         isVegetarian:
 *           type: boolean
 *           description: Whether item is vegetarian
 *           example: false
 *         isNonVegetarian:
 *           type: boolean
 *           description: Whether item is non-vegetarian
 *           example: true
 *         isVegan:
 *           type: boolean
 *           description: Whether item is vegan
 *           example: false
 *         isGlutenFree:
 *           type: boolean
 *           description: Whether item is gluten-free
 *           example: false
 *         isAvailable:
 *           type: boolean
 *           description: Whether item is available
 *           example: true
 *         isActive:
 *           type: boolean
 *           description: Whether item is active
 *           example: true
 *         displayOrder:
 *           type: integer
 *           description: Display order for sorting
 *           example: 2
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags for filtering
 *           example: ["healthy", "salad", "chicken"]
 *         nutritionalInfo:
 *           type: object
 *           properties:
 *             calories:
 *               type: number
 *               example: 350
 *             protein:
 *               type: number
 *               example: 25
 *             carbs:
 *               type: number
 *               example: 20
 *             fat:
 *               type: number
 *               example: 18
 *         orderCount:
 *           type: integer
 *           description: Total orders count
 *           example: 150
 *         lastOrdered:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-01-28T12:30:00.000Z"
 *         seasonal:
 *           type: object
 *           properties:
 *             isSeasonal:
 *               type: boolean
 *               example: false
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-06-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-08-31"
 *             seasonName:
 *               type: string
 *               example: "Summer Specials"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T08:00:00.000Z"
 *         createdBy:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *           description: User who created the item
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-28T10:30:00.000Z"
 *         updatedBy:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *           description: User who last updated the item
 * 
 *     PriceHistory:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Price history ID
 *           example: "507f1f77bcf86cd799439017"
 *         menuItem:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439015"
 *             name:
 *               type: string
 *               example: "Grilled Chicken Caesar Salad"
 *           description: Menu item details
 *         sizeId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439013"
 *             name:
 *               type: string
 *               example: "Medium"
 *             code:
 *               type: string
 *               example: "M"
 *           description: Size details
 *         oldPrice:
 *           type: number
 *           description: Old price
 *           example: 11.99
 *         newPrice:
 *           type: number
 *           description: New price
 *           example: 12.99
 *         changeType:
 *           type: string
 *           enum: [increase, decrease, initial]
 *           description: Type of price change
 *           example: "increase"
 *         changePercentage:
 *           type: number
 *           description: Percentage change
 *           example: 8.33
 *         changedBy:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439014"
 *             name:
 *               type: string
 *               example: "John Doe"
 *           description: User who changed the price
 *         reason:
 *           type: string
 *           description: Reason for price change
 *           example: "Increased ingredient costs"
 *         changedAt:
 *           type: string
 *           format: date-time
 *           description: When price was changed
 *           example: "2024-01-28T10:15:00.000Z"
 * 
 *     CreateCategoryRequest:
 *       type: object
 *       required:
 *         - name
 *         - kitchenStation
 *       properties:
 *         name:
 *           type: string
 *           description: Category name
 *           example: "Desserts"
 *         description:
 *           type: string
 *           description: Category description
 *           example: "Sweet treats and desserts"
 *         displayOrder:
 *           type: integer
 *           default: 0
 *           description: Display order
 *           example: 5
 *         kitchenStation:
 *           type: string
 *           description: Kitchen station ID
 *           example: "507f1f77bcf86cd799439018"
 * 
 *     CreateSizeRequest:
 *       type: object
 *       required:
 *         - name
 *         - code
 *       properties:
 *         name:
 *           type: string
 *           description: Size name
 *           example: "Family"
 *         code:
 *           type: string
 *           description: Size code
 *           example: "F"
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether size is active
 *           example: true
 * 
 *     CreateMenuItemRequest:
 *       type: object
 *       required:
 *         - name
 *         - category
 *         - prices
 *       properties:
 *         name:
 *           type: string
 *           description: Menu item name
 *           example: "Chocolate Lava Cake"
 *         description:
 *           type: string
 *           description: Menu item description
 *           example: "Warm chocolate cake with molten center, served with vanilla ice cream"
 *         category:
 *           type: string
 *           description: Category ID
 *           example: "507f1f77bcf86cd799439011"
 *         station:
 *           type: string
 *           description: Kitchen station ID
 *           example: "507f1f77bcf86cd799439018"
 *         prices:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - size
 *               - price
 *             properties:
 *               sizeId:
 *                 type: string
 *                 description: Size ID
 *                 example: "507f1f77bcf86cd799439013"
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 8.99
 *               costPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 2.50
 *         ingredients:
 *           type: array
 *           items:
 *             type: string
 *           default: []
 *           example: ["chocolate", "flour", "eggs", "sugar", "butter"]
 *         allergens:
 *           type: array
 *           items:
 *             type: string
 *           default: []
 *           example: ["gluten", "dairy", "eggs"]
 *         spiceLevel:
 *           type: integer
 *           minimum: 0
 *           maximum: 5
 *           default: 0
 *           example: 0
 *         preparationTime:
 *           type: integer
 *           default: 15
 *           description: Preparation time in minutes
 *           example: 10
 *         isVegetarian:
 *           type: boolean
 *           default: false
 *           example: true
 *         isNonVegetarian:
 *           type: boolean
 *           default: false
 *           example: false
 *         isVegan:
 *           type: boolean
 *           default: false
 *           example: false
 *         isGlutenFree:
 *           type: boolean
 *           default: false
 *           example: false
 *         isAvailable:
 *           type: boolean
 *           default: true
 *           example: true
 *         isActive:
 *           type: boolean
 *           default: true
 *           example: true
 *         displayOrder:
 *           type: integer
 *           default: 0
 *           example: 3
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           default: []
 *           example: ["dessert", "chocolate", "cake"]
 *         nutritionalInfo:
 *           type: object
 *           properties:
 *             calories:
 *               type: number
 *               default: 0
 *               example: 450
 *             protein:
 *               type: number
 *               default: 0
 *               example: 6
 *             carbs:
 *               type: number
 *               default: 0
 *               example: 60
 *             fat:
 *               type: number
 *               default: 0
 *               example: 22
 *         seasonal:
 *           type: object
 *           properties:
 *             isSeasonal:
 *               type: boolean
 *               default: false
 *               example: false
 *             startDate:
 *               type: string
 *               format: date
 *               example: "2024-12-01"
 *             endDate:
 *               type: string
 *               format: date
 *               example: "2024-12-31"
 *             seasonName:
 *               type: string
 *               example: "Holiday Specials"
 * 
 *     BulkUpdateRequest:
 *       type: object
 *       required:
 *         - updates
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum: [updatePrices, updateAvailability, updateStatus, updateCategories]
 *           description: Type of bulk operation
 *           example: "updatePrices"
 *         updates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               menuItemId:
 *                 type: string
 *                 description: Menu item ID
 *                 example: "507f1f77bcf86cd799439015"
 *               sizeId:
 *                 type: string
 *                 description: Size ID or code
 *                 example: "507f1f77bcf86cd799439013"
 *               newPrice:
 *                 type: number
 *                 description: New price
 *                 example: 13.99
 *               costPrice:
 *                 type: number
 *                 description: Cost price
 *                 example: 5.00
 *               isAvailable:
 *                 type: boolean
 *                 description: Availability status
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 description: Active status
 *                 example: true
 *               categoryId:
 *                 type: string
 *                 description: New category ID
 *                 example: "507f1f77bcf86cd799439019"
 *               reason:
 *                 type: string
 *                 description: Reason for change
 *                 example: "Seasonal price adjustment"
 * 
 *     MenuStatistics:
 *       type: object
 *       properties:
 *         totalItems:
 *           type: integer
 *           description: Total menu items
 *           example: 120
 *         availableItems:
 *           type: integer
 *           description: Available items count
 *           example: 95
 *         unavailableItems:
 *           type: integer
 *           description: Unavailable items count
 *           example: 25
 *         categoriesCount:
 *           type: integer
 *           description: Total categories count
 *           example: 8
 *         dietary:
 *           type: object
 *           properties:
 *             vegetarian:
 *               type: integer
 *               example: 40
 *             nonVegetarian:
 *               type: integer
 *               example: 70
 *             vegan:
 *               type: integer
 *               example: 15
 *             glutenFree:
 *               type: integer
 *               example: 20
 * 
 *     PriceHistoryResponse:
 *       type: object
 *       properties:
 *         menuItem:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439015"
 *             name:
 *               type: string
 *               example: "Grilled Chicken Caesar Salad"
 *             category:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *                 name:
 *                   type: string
 *                   example: "Salads"
 *             currentPrices:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   price:
 *                     type: number
 *                     example: 12.99
 *                   costPrice:
 *                     type: number
 *                     nullable: true
 *                     example: 4.50
 *                   size:
 *                     type: string
 *                     example: "Medium"
 *         history:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PriceHistory'
 *         historyBySize:
 *           type: object
 *           additionalProperties:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/PriceHistory'
 *         statistics:
 *           type: object
 *           properties:
 *             totalChanges:
 *               type: integer
 *               example: 5
 *             averageChangePercentage:
 *               type: number
 *               example: 6.5
 *             period:
 *               type: string
 *               example: "year"
 *             sizeFilter:
 *               type: string
 *               example: "M"
 * 
 *     MenuFilters:
 *       type: object
 *       properties:
 *         query:
 *           type: string
 *           description: Search query
 *           example: "chicken"
 *         category:
 *           type: string
 *           description: Category ID filter
 *           example: "507f1f77bcf86cd799439011"
 *         minPrice:
 *           type: number
 *           description: Minimum price filter
 *           example: 5.00
 *         maxPrice:
 *           type: number
 *           description: Maximum price filter
 *           example: 20.00
 *         dietary:
 *           type: string
 *           description: Dietary filter (comma-separated)
 *           example: "vegetarian,glutenFree"
 *         tags:
 *           type: string
 *           description: Tags filter (comma-separated)
 *           example: "spicy,popular"
 *         availableOnly:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *           description: Filter available items only
 *           example: "true"
 *         activeOnly:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *           description: Filter active items only
 *           example: "true"
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 * 
 *     CategoryFilters:
 *       type: object
 *       properties:
 *         activeOnly:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *           description: Filter active categories only
 *           example: "true"
 *         withStation:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *           description: Include kitchen station details
 *           example: "true"
 * 
 *     ExportFilters:
 *       type: object
 *       properties:
 *         category:
 *           type: string
 *           description: Export specific category
 *           example: "507f1f77bcf86cd799439011"
 *         availableOnly:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *           example: "true"
 *         activeOnly:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *           example: "true"
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
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *           description: Validation errors
 *         code:
 *           type: string
 *           example: "DUPLICATE_NAME"
 * 
 *     BulkImportResult:
 *       type: object
 *       properties:
 *         created:
 *           type: integer
 *           example: 45
 *         failed:
 *           type: integer
 *           example: 5
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Row 10: Invalid size id", "Row 15: Missing required field 'name'"]
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
 *             error: "No authentication token provided"
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
 *             error: "User lacks required permissions"
 * 
 *     NotFound:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Category not found"
 *             error: "No category found with id 507f1f77bcf86cd799439011"
 * 
 *     BadRequest:
 *       description: Invalid request
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Invalid request parameters"
 *             error: "Missing required field 'name'"
 *             errors: ["name is required"]
 * 
 *     DuplicateName:
 *       description: Resource name already exists
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Category with this name already exists"
 *             error: "Duplicate key error"
 *             code: "DUPLICATE_NAME"
 * 
 *     ValidationError:
 *       description: Validation failed
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Validation error"
 *             error: "Invalid field values"
 *             errors: ["price must be a positive number", "spiceLevel must be between 0 and 5"]
 * 
 *     CategoryLinkedItems:
 *       description: Cannot delete category with linked items
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Cannot delete category because menu items are linked to it"
 *             error: "Category has 15 linked menu items"
 * 
 *     InvalidSize:
 *       description: Invalid size ID provided
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Invalid size ID"
 *             error: "Size with id 507f1f77bcf86cd799439099 not found"
 * 
 *     InvalidStation:
 *       description: Invalid kitchen station
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Kitchen station not found"
 *             error: "Station with id 507f1f77bcf86cd799439099 not found"
 * 
 *     UploadError:
 *       description: File upload failed
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Image upload failed"
 *             error: "No minioPath received from upload middleware"
 * 
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Server error"
 *             error: "Database connection failed"
 * 
 *     CSVImportError:
 *       description: CSV import failed
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "CSV import failed"
 *             error: "Invalid CSV format"
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
 *   - name: Categories
 *     description: Menu categories management
 *   - name: Menu Items
 *     description: Menu items management
 *   - name: Sizes
 *     description: Size management for menu items
 *   - name: Price History
 *     description: Price history tracking
 */