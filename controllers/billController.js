const { logger } = require("./../utils/logger.js");
const billManager = require("../utils/billManager");
const sessionManager = require("../utils/sessionManager");
const Bill = require("../models/Bill");
const { sendError, sendPaginated, sendSuccess } = require("../utils/httpResponse");
const { getOrSetCache } = require("../utils/responseCache");
require("dotenv").config({ quiet: true });

const BILL_CACHE_PREFIX = "bill:";
const BILL_LIST_CACHE_TTL_MS = 15 * 1000;
const BILL_STATS_CACHE_TTL_MS = 20 * 1000;

const toBillPaymentSummary = (bill = {}) => ({
  id: bill?._id || bill?.id || null,
  billNumber: bill?.billNumber || "",
  totalAmount: Number(bill?.totalAmount || 0),
  paymentStatus: bill?.paymentStatus || "pending",
  pdfUrl: bill?.pdfUrl || "",
});

const toBillAdminItem = (bill = {}) => ({
  _id: bill?._id,
  billNumber: bill?.billNumber || "",
  sessionId: bill?.sessionId || "",
  customerName: bill?.customerName || "",
  customerEmail: bill?.customerEmail || "",
  customerPhone: bill?.customerPhone || "",
  paymentStatus: bill?.paymentStatus || "pending",
  billStatus: bill?.billStatus || "draft",
  paymentMethod: bill?.paymentMethod || "pending",
  paidAt: bill?.paidAt || null,
  totalAmount: Number(bill?.totalAmount || 0),
  createdAt: bill?.createdAt || null,
  tableNumber:
    bill?.tableId?.tableNumber || bill?.metadata?.tableNumber || null,
  itemCount: Array.isArray(bill?.items) ? bill.items.length : 0,
});

exports.requestBill = async (req, res) => {
  try {
    const { sessionId, email, forceNew = false } = req.body;

    if (!sessionId) {
      return sendError(res, 400, "Session ID is required");
    }

    const session = await sessionManager.getCustomerSession(sessionId);
    if (!session) {
      return sendError(res, 404, "Active session not found or expired");
    }

    const bill = await billManager.generateBill(sessionId, email, forceNew);

    return sendSuccess(
      res,
      201,
      email ? "Bill generated and sent via email" : "Bill generated successfully",
      {
        bill: {
          _id: bill?._id,
          billNumber: bill?.billNumber || "",
          pdfUrl: bill?.pdfUrl || "",
        },
      }
    );
  } catch (error) {
    logger.error("Bill request failed:", error);
    return sendError(res, 400, error.message, error);
  }
};

exports.getBillBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const bill = await billManager.getBillBySession(sessionId);

    if (!bill) {
      return sendError(res, 404, "No active bill found for this session");
    }

    if (!bill.billViewed) {
      await billManager.markBillAsViewed(bill._id, sessionId);
    }

    return sendSuccess(res, 200, null, bill);
  } catch (error) {
    logger.error("Get bill failed:", error);
    return sendError(res, 500, "Failed to get bill", error);
  }
};

exports.getBillById = async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await billManager.getBillById(billId);

    return sendSuccess(res, 200, null, bill);
  } catch (error) {
    logger.error("Get bill by ID failed:", error);
    return sendError(res, 404, error.message, error);
  }
};

exports.sendBillEmail = async (req, res) => {
  try {
    const { billId } = req.params;
    const { email } = req.body;

    if (!email) {
      return sendError(res, 400, "Email address is required");
    }

    await billManager.resendBillEmail(billId, email);

    return sendSuccess(res, 200, "Bill sent to email successfully");
  } catch (error) {
    logger.error("Send bill email failed:", error);
    return sendError(res, 400, error.message, error);
  }
};

exports.processPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentMethod, transactionId, gateway } = req.body;

    if (!paymentMethod) {
      return sendError(res, 400, "Payment method is required");
    }

    const paymentData = {
      method: paymentMethod,
      transactionId: transactionId || `payment_${Date.now()}`,
      gateway:
        gateway || (paymentMethod === "online" ? "payment_gateway" : "offline"),
    };

    const result = await sessionManager.markBillAsPaid(
      billId,
      paymentData,
      req.user?._id || null
    );

    return sendSuccess(res, 200, "Payment processed successfully", {
      bill: toBillPaymentSummary(result?.data?.bill || null),
      session: {
        status: result?.data?.customer?.status || "completed",
        paymentMethod: result?.data?.customer?.paymentMethod || paymentMethod,
        paymentStatus: result?.data?.customer?.paymentStatus || "paid",
      },
    });
  } catch (error) {
    logger.error("Payment processing failed:", error);
    return sendError(res, 400, error.message, error);
  }
};

exports.downloadBillPDF = async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await billManager.getBillById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    if (!bill.pdfUrl) {
      await billManager.generateAndSavePDF(bill);
      const refreshedBill = await billManager.getBillById(billId);
      if (!refreshedBill?.pdfUrl) {
        return this.generatePDFOnTheFly(req, res);
      }
      return res.redirect(refreshedBill.pdfUrl);
    }

    return res.redirect(bill.pdfUrl);
  } catch (error) {
    logger.error("PDF download failed:", error);

    try {
      return await this.generatePDFOnTheFly(req, res);
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        message: `Failed to get PDF: ${error.message}`,
      });
    }
  }
};

exports.generatePDFOnTheFly = async (req, res) => {
  try {
    const { billId } = req.params;

    logger.info(`Generating PDF on-the-fly for bill: ${billId}`);

    const bill = await billManager.getBillById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    const pdfBuffer = await billManager.generateBillPDF(bill);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bill_${bill.billNumber}_generated.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", 0);

    logger.info(
      `Sending on-the-fly PDF for bill: ${bill.billNumber}, Size: ${pdfBuffer.length} bytes`,
    );

    res.send(pdfBuffer);
  } catch (error) {
    logger.error("On-the-fly PDF generation failed:", error);

    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill ${bill?.billNumber || "Not Found"}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .bill-info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          .total { font-weight: bold; font-size: 18px; }
          .error { color: red; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>RESTAURANT BILL</h1>
          <p>Bill Number: ${bill?.billNumber || "N/A"}</p>
          <p>Date: ${bill?.billDate ? new Date(bill.billDate).toLocaleDateString() : "N/A"}</p>
        </div>
        <div class="error">
          <p>PDF generation failed. Showing HTML version.</p>
          <p>Error: ${error.message}</p>
        </div>
        ${
          bill
            ? `
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${
              bill.items
                ?.map(
                  (item) => `
              <tr>
                <td>${item.name || "Item"}</td>
                <td>${item.size || "-"}</td>
                <td>${item.quantity}</td>
                <td>₹${item.unitPrice?.toFixed(2) || "0.00"}</td>
                <td>₹${item.totalPrice?.toFixed(2) || "0.00"}</td>
              </tr>
            `,
                )
                .join("") || '<tr><td colspan="5">No items found</td></tr>'
            }
          </tbody>
        </table>
        <div class="total">
          <p>Total Amount: ₹${bill.totalAmount?.toFixed(2) || "0.00"}</p>
          <p>Payment Status: ${bill.paymentStatus || "Pending"}</p>
        </div>
        `
            : "<p>Bill data not available</p>"
        }
      </body>
      </html>
    `);
  }
};

exports.viewBillPDF = async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await billManager.getBillById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    if (!bill.pdfUrl) {
      await billManager.generateAndSavePDF(bill);
      const refreshedBill = await billManager.getBillById(billId);
      if (!refreshedBill?.pdfUrl) {
        return this.generatePDFOnTheFly(req, res);
      }
      return res.redirect(refreshedBill.pdfUrl);
    }

    return res.redirect(bill.pdfUrl);
  } catch (error) {
    logger.error("PDF view failed:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPaymentQR = async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await billManager.getBillById(billId);

    const qr = require("qrcode");
    const upiId = process.env.UPI_ID || "restaurant@upi";
    const paymentUrl = `upi://pay?pa=${upiId}&pn=Restaurant&am=${bill.totalAmount}&tn=Bill ${bill.billNumber}&cu=INR`;

    qr.toDataURL(paymentUrl, (err, qrDataUrl) => {
      if (err) {
        throw err;
      }

      res.status(200).json({
        success: true,
        data: {
          qrCode: qrDataUrl,
          upiId,
          amount: Number(bill.totalAmount || 0),
          billNumber: bill.billNumber,
        },
      });
    });
  } catch (error) {
    logger.error("QR generation failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate payment QR",
    });
  }
};

exports.getBillsAdmin = async (req, res) => {
  try {
    const {
      status,
      billStatus,
      paymentMethod,
      search,
      page = 1,
      limit = 20,
      dateFrom,
      dateTo,
    } = req.query;

    const query = {};
    if (status) {
      query.paymentStatus = status;
    }
    if (billStatus) {
      query.billStatus = billStatus;
    }
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    if (search) {
      query.$or = [
        { billNumber: { $regex: search, $options: "i" } },
        { sessionId: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ];
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `${BILL_CACHE_PREFIX}list:${req.tenantId || "default"}:${JSON.stringify(req.query || {})}`;
    const cached = await getOrSetCache(cacheKey, BILL_LIST_CACHE_TTL_MS, async () => {
      const [bills, total] = await Promise.all([
        Bill.find(query)
          .select("billNumber sessionId customerName customerEmail customerPhone paymentStatus billStatus paymentMethod paidAt totalAmount createdAt tableId items metadata")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("tableId", "tableNumber tableName")
          .lean(),
        Bill.countDocuments(query),
      ]);

      return {
        data: bills.map(toBillAdminItem),
        pagination: {
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
        },
      };
    });

    return sendPaginated(
      res,
      200,
      cached.data,
      cached.pagination
    );
  } catch (error) {
    logger.error("Get bills failed:", error);
    return sendError(res, 500, "Failed to get bills", error);
  }
};

exports.getBillStatistics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cacheKey = `${BILL_CACHE_PREFIX}stats:${req.tenantId || "default"}`;
    const data = await getOrSetCache(cacheKey, BILL_STATS_CACHE_TTL_MS, async () => {
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      );

      const [
        totalBills,
        pendingBills,
        paidBills,
        todayBills,
        todayRevenue,
        monthlyRevenue,
      ] = await Promise.all([
        Bill.countDocuments(),
        Bill.countDocuments({ paymentStatus: "pending" }),
        Bill.countDocuments({ paymentStatus: "paid" }),
        Bill.countDocuments({ createdAt: { $gte: today } }),
        Bill.aggregate([
          {
            $match: {
              paymentStatus: "paid",
              paidAt: { $gte: today },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAmount" },
            },
          },
        ]),
        Bill.aggregate([
          {
            $match: {
              paymentStatus: "paid",
              paidAt: { $gte: monthStart },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAmount" },
            },
          },
        ]),
      ]);

      return {
        totalBills,
        pendingBills,
        paidBills,
        todayBills,
        todayRevenue: todayRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
      };
    });

    return sendSuccess(res, 200, null, data);
  } catch (error) {
    logger.error("Get bill statistics failed:", error);
    return sendError(res, 500, "Failed to get bill statistics", error);
  }
};
