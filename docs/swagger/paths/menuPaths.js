/**
 * @swagger
 * /menu/categories:
 *   get:
 *     summary: Get all categories (Public)
 *     description: |
 *       Returns list of categories with optional filters.
 *       Public endpoint - no authentication required.
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Filter active categories only
 *       - in: query
 *         name: withStation
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Include kitchen station details
 *     responses:
 *       200:
 *         description: List of categories
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
 *                   example: 8
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/categories/{id}:
 *   get:
 *     summary: Get category by ID (Public)
 *     description: Returns detailed category information
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/categories:
 *   post:
 *     summary: Create new category (Requires MENU_CREATE permission)
 *     description: |
 *       Creates a new menu category.
 *       Requires kitchen station to be specified.
 *       Image upload is optional.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - kitchenStation
 *             properties:
 *               name:
 *                 type: string
 *                 description: Category name
 *                 example: "Desserts"
 *               description:
 *                 type: string
 *                 description: Category description
 *                 example: "Sweet treats and desserts"
 *               displayOrder:
 *                 type: integer
 *                 description: Display order
 *                 example: 5
 *               kitchenStation:
 *                 type: string
 *                 description: Kitchen station ID
 *                 example: "507f1f77bcf86cd799439018"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Category image
 *     responses:
 *       201:
 *         description: Category created successfully
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
 *                   example: "Category created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     name:
 *                       type: string
 *                       example: "Desserts"
 *                     kitchenStation:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439018"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/BadRequest'
 *                 - $ref: '#/components/responses/DuplicateName'
 *                 - $ref: '#/components/responses/InvalidStation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/categories/{id}:
 *   put:
 *     summary: Update category (Requires MENU_EDIT permission)
 *     description: Updates category details
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Category name
 *                 example: "Updated Category Name"
 *               description:
 *                 type: string
 *                 description: Category description
 *               displayOrder:
 *                 type: integer
 *                 description: Display order
 *               kitchenStation:
 *                 type: string
 *                 description: Kitchen station ID
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New category image
 *     responses:
 *       200:
 *         description: Category updated successfully
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
 *                   example: "Category updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     name:
 *                       type: string
 *                       example: "Updated Category Name"
 *                     kitchenStation:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439018"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/DuplicateName'
 *                 - $ref: '#/components/responses/InvalidStation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/categories/{id}/status:
 *   put:
 *     summary: Toggle category status (Requires CATEGORY_TOGGLE_STATUS permission)
 *     description: Activates or deactivates a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Category status toggled
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
 *                   example: "Category activated successfully"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/categories/{id}:
 *   delete:
 *     summary: Delete category (Requires MENU_DELETE permission)
 *     description: |
 *       Deletes a category.
 *       Cannot delete if menu items are linked to it.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Category deleted successfully
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
 *                   example: "Category deleted successfully"
 *       400:
 *         $ref: '#/components/responses/CategoryLinkedItems'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/sizes:
 *   get:
 *     summary: Get all sizes (Staff only)
 *     description: Returns list of sizes for menu items
 *     tags: [Sizes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter active sizes only
 *         example: "true"
 *     responses:
 *       200:
 *         description: List of sizes
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
 *                   example: 4
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Size'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/sizes:
 *   post:
 *     summary: Create new size (Staff only)
 *     description: Creates a new size option for menu items
 *     tags: [Sizes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSizeRequest'
 *     responses:
 *       201:
 *         description: Size created successfully
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
 *                   example: "Size created successfully"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/DuplicateName'
 *                 - $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Staff access only
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/sizes/{id}:
 *   put:
 *     summary: Update size (Staff only)
 *     description: Updates size details
 *     tags: [Sizes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Size ID
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Large"
 *               code:
 *                 type: string
 *                 example: "L"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Size updated successfully
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
 *                   example: "Updated Successfully"
 *       400:
 *         $ref: '#/components/responses/DuplicateName'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Staff access only
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/sizes/{id}/toggle-status:
 *   patch:
 *     summary: Toggle size status (Staff only)
 *     description: Activates or deactivates a size
 *     tags: [Sizes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Size ID
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Size status toggled
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
 *                   example: "Size is now Active"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Staff access only
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items:
 *   get:
 *     summary: Get menu items with advanced filters (Public with optional auth)
 *     description: |
 *       Returns paginated menu items with extensive filtering options.
 *       Public endpoint - authentication optional for admin features like costPrice visibility.
 *       Auto-syncs station from category if station is null.
 *     tags: [Menu Items]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query for name, description, ingredients, or tags
 *         example: "chicken"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID filter
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *         example: 5.00
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *         example: 20.00
 *       - in: query
 *         name: dietary
 *         schema:
 *           type: string
 *         description: "Dietary filter (comma-separated: vegetarian,nonVegetarian,vegan,glutenFree)"
 *         example: "vegetarian,glutenFree"
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Tags filter (comma-separated)
 *         example: "spicy,popular"
 *       - in: query
 *         name: availableOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Filter available items only
 *         example: "true"
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Filter active items only
 *         example: "true"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *         example: 20
 *     responses:
 *       200:
 *         description: List of menu items with pagination
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
 *                   description: Number of items in current page
 *                   example: 15
 *                 total:
 *                   type: integer
 *                   description: Total items matching filters
 *                   example: 120
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 8
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MenuItem'
 *       400:
 *         description: Invalid filter parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid filter parameters"
 *               error: "maxPrice must be greater than minPrice"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/seasonal:
 *   get:
 *     summary: Get seasonal menu items (Public)
 *     description: Returns currently available seasonal items based on date ranges
 *     tags: [Menu Items]
 *     responses:
 *       200:
 *         description: List of seasonal items
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
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MenuItem'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/{id}:
 *   get:
 *     summary: Get menu item by ID (Public)
 *     description: Returns detailed menu item information
 *     tags: [Menu Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu item ID
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Menu item details
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
 *                   example: "Item Fetched successfully!"
 *                 data:
 *                   $ref: '#/components/schemas/MenuItem'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items:
 *   post:
 *     summary: Create new menu item
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - station
 *               - prices
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Dal Bati Churma"
 *               description:
 *                 type: string
 *                 example: "Traditional Rajasthani dish"
 *               category:
 *                 type: string
 *                 example: "694a38ef454a71492c8d404b"
 *               station:
 *                 type: string
 *                 example: "6944f8fd0e4dd9b51df04f13"
 *               prices:
 *                 type: string
 *                 example: >
 *                   [
 *                     {
 *                       "sizeId": "694921fdcac1f5464d0c9758",
 *                       "price": 299,
 *                       "costPrice": 180
 *                     }
 *                   ]
 *               ingredients:
 *                 type: string
 *                 example: '["Wheat flour","Ghee","Lentils"]'
 *               allergens:
 *                 type: string
 *                 example: '[]'
 *               tags:
 *                 type: string
 *                 example: '["rajasthani","traditional"]'
 *               nutritionalInfo:
 *                 type: string
 *                 example: '{"calories":450,"protein":12,"carbs":60,"fat":18}'
 *               spiceLevel:
 *                 type: integer
 *                 example: 2
 *               preparationTime:
 *                 type: integer
 *                 example: 25
 *               isVegetarian:
 *                 type: boolean
 *                 example: true
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Menu item created successfully
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
 *                   example: "Menu item created successfully"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/DuplicateName'
 *                 - $ref: '#/components/responses/ValidationError'
 *                 - $ref: '#/components/responses/InvalidSize'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/{id}:
 *   put:
 *     summary: Update menu item (Requires MENU_EDIT permission)
 *     description: Updates menu item details. All fields are optional except name, category, and prices.
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: ObjectId
 *         description: Menu item ID
 *         example: "507f1f77bcf86cd799439015"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - prices
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Paneer Butter Masala"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Creamy paneer curry in tomato gravy"
 *               category:
 *                 type: string
 *                 format: ObjectId
 *                 description: Category ID
 *                 example: "694a38ef454a71492c8d404b"
 *               station:
 *                 type: string
 *                 description: Station/Kitchen name
 *                 example: "Main Kitchen"
 *               prices:
 *                 type: string
 *                 description: JSON array of price objects
 *                 example: '[{"sizeId":"694921fdcac1f5464d0c9758","price":299,"costPrice":180}]'
 *               ingredients:
 *                 type: string
 *                 description: Comma-separated list or JSON array of ingredients
 *                 example: "Paneer,Tomato,Cream,Butter,Spices"
 *               allergens:
 *                 type: string
 *                 description: Comma-separated list or JSON array of allergens
 *                 example: "Dairy,Nuts"
 *               spiceLevel:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 5
 *                 description: 0=No spice, 5=Very spicy
 *                 example: 3
 *               preparationTime:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 180
 *                 description: Preparation time in minutes
 *                 example: 20
 *               isVegetarian:
 *                 type: boolean
 *                 example: true
 *               isNonVegetarian:
 *                 type: boolean
 *                 example: false
 *               isVegan:
 *                 type: boolean
 *                 example: false
 *               isGlutenFree:
 *                 type: boolean
 *                 example: true
 *               displayOrder:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *                 description: Display order in menu (lower number appears first)
 *                 example: 5
 *               tags:
 *                 type: string
 *                 description: Comma-separated list or JSON array of tags
 *                 example: "north-indian,curry,popular"
 *               nutritionalInfo:
 *                 type: string
 *                 description: JSON object containing nutritional information
 *                 example: '{"calories":350,"protein":15,"carbs":20,"fat":25,"fiber":3}'
 *               isAvailable:
 *                 type: boolean
 *                 description: Whether the item is available for ordering
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 description: Whether the item is active in the system
 *                 example: true
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Menu item image file (jpg, png, webp)
 *     responses:
 *       200:
 *         description: Menu item updated successfully
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/DuplicateName'
 *                 - $ref: '#/components/responses/ValidationError'
 *                 - $ref: '#/components/responses/InvalidSize'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/{id}/availability:
 *   put:
 *     summary: Toggle menu item availability (Requires menu_toggle_availability permission)
 *     description: Marks menu item as available or unavailable
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu item ID
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Availability toggled
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
 *                   example: "Menu item available successfully"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/{id}:
 *   delete:
 *     summary: Delete menu item (Requires MENU_DELETE permission)
 *     description: Permanently deletes a menu item
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu item ID
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Menu item deleted
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
 *                   example: "Menu item deleted successfully"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/statistics:
 *   get:
 *     summary: Get menu statistics (Requires MENU_STATS permission)
 *     description: Returns menu statistics including counts and dietary breakdown
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Menu statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MenuStatistics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/bulk/update:
 *   put:
 *     summary: Bulk update menu items (Requires MENU_BULK_OPERATIONS permission)
 *     description: |
 *       Performs bulk operations on menu items:
 *       - updatePrices: Update prices for specific sizes
 *       - updateAvailability: Change availability status
 *       - updateStatus: Change active status
 *       - updateCategories: Move items to different categories
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkUpdateRequest'
 *     responses:
 *       200:
 *         description: Bulk update completed
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
 *                   example: "Bulk updatePrices completed"
 *                 data:
 *                   $ref: '#/components/schemas/BulkImportResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/{id}/price-history:
 *   get:
 *     summary: Get price history for menu item (Requires PRICE_STATS permission)
 *     description: Returns price change history with statistics
 *     tags: [Price History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu item ID
 *         example: "507f1f77bcf86cd799439015"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all, week, month, quarter, year]
 *           default: all
 *         description: Time period filter
 *       - in: query
 *         name: sizeId
 *         schema:
 *           type: string
 *         description: Filter by sizeId 
 *         example: "M"
 *     responses:
 *       200:
 *         description: Price history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PriceHistoryResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/price-changes:
 *   get:
 *     summary: Get all price changes (Requires PRICE_STATS permission)
 *     description: Returns paginated list of all price changes with filters
 *     tags: [Price History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *         example: "2024-12-31"
 *       - in: query
 *         name: changeType
 *         schema:
 *           type: string
 *           enum: [increase, decrease, initial]
 *         description: Filter by change type
 *         example: "increase"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of price changes
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
 *                   example: 15
 *                 total:
 *                   type: integer
 *                   example: 120
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 8
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceHistory'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/export:
 *   get:
 *     summary: Export menu items to CSV (Requires MENU_IMPORT_EXPORT permission)
 *     description: Exports menu items to CSV format with optional filters
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Export specific category
 *       - in: query
 *         name: availableOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "false"
 *         description: Export available items only
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Export active items only
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             example: "attachment; filename=menu-export-1706467200000.csv"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/import/template:
 *   get:
 *     summary: Download CSV import template (Requires MENU_IMPORT_EXPORT permission)
 *     description: Downloads CSV template for bulk menu item import
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             example: "attachment; filename=menu-import-template.csv"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /menu/items/bulk/import:
 *   post:
 *     summary: Bulk import menu items from CSV (Requires MENU_IMPORT_EXPORT permission)
 *     description: Imports menu items from CSV file
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file with menu items
 *     responses:
 *       200:
 *         description: Import completed
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
 *                   example: "Bulk Import Completed"
 *                 data:
 *                   $ref: '#/components/schemas/BulkImportResult'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/responses/BadRequest'
 *                 - $ref: '#/components/responses/CSVImportError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
