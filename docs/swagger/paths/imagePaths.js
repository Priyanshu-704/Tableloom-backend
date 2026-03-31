/**
 * @swagger
 * tags:
 *   - name: Images
 *     description: Image serving and file downloads
 *   - name: PDF Downloads
 *     description: Bill PDF downloads
 */

/**
 * @swagger
 * /images/menu-item/{id}:
 *   get:
 *     summary: Get menu item image
 *     tags: [Images]
 *     description: Serve menu item image from storage
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu item ID
 *     responses:
 *       200:
 *         description: Menu item image
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "image/jpeg"
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 102400
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: "public, max-age=86400"
 *       404:
 *         description: Image not found
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Image not found"
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /images/category/{id}:
 *   get:
 *     summary: Get category image
 *     tags: [Images]
 *     description: Serve category image from storage
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category image
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "image/jpeg"
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 102400
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: "public, max-age=86400"
 *       404:
 *         description: Image not found
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Image not found"
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /images/table-qr/{id}:
 *   get:
 *     summary: Get table QR code image
 *     tags: [Images]
 *     description: Serve table QR code image for scanning
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Table ID
 *     responses:
 *       200:
 *         description: Table QR code image
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "image/png"
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 5120
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: "public, max-age=86400"
 *       404:
 *         description: QR code not found
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Image not found"
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /images/bills/{id}/pdf:
 *   get:
 *     summary: Download bill PDF
 *     tags: [PDF Downloads]
 *     description: Download generated bill as PDF file
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill ID
 *     responses:
 *       200:
 *         description: Bill PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'inline; filename="bill-ORD-202412345.pdf"'
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: "application/pdf"
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 102400
 *       404:
 *         description: Bill PDF not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Bill PDF not found"
 *       500:
 *         description: Failed to fetch bill PDF
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch bill PDF"
 */