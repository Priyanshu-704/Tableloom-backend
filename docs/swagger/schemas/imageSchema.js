/**
 * @swagger
 * components:
 *   schemas:
 *     ImageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Image retrieved successfully"
 *       description: Success response for image operations
 * 
 *     ImageErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Image not found"
 *       description: Error response for image operations
 * 
 *     BillPDFResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "PDF downloaded successfully"
 *         data:
 *           type: object
 *           properties:
 *             filename:
 *               type: string
 *               example: "bill-ORD-202412345.pdf"
 *             contentType:
 *               type: string
 *               example: "application/pdf"
 *       description: Success response for PDF download
 */