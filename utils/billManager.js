const { logger } = require("./logger.js");
const Bill = require("../models/Bill");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const AppSetting = require("../models/AppSetting");
const MenuItem = require("../models/MenuItem");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const notificationManager = require("./notificationManager");
require("dotenv").config({ quiet: true });
const { uploadBuffer, fetchRemoteBuffer } = require("./cloudinaryStorage");
const {
  createTaxSnapshot,
  getTenantTaxSettings,
} = require("./taxCalculator");

const getBaseUrl = () => process.env.BACKEND_URL;

// Initialize email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const uploadBillPDFToCloudinary = async (bill, pdfBuffer) => {
  const filename = `bill-${bill.billNumber}-${Date.now()}.pdf`;
  const uploaded = await uploadBuffer({
    buffer: pdfBuffer,
    originalname: filename,
    mimetype: "application/pdf",
    folder: "bills",
    resourceType: "raw",
  });

  return {
    publicId: uploaded.publicId,
    url: uploaded.url,
    provider: "cloudinary",
  };
};

const getTimeSince = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";

  return Math.floor(seconds) + " seconds ago";
};

// Bill Number Generation
exports.generateBillNumber = async () => {
  const count = await Bill.countDocuments();
  return `BILL-${String(count + 1).padStart(6, "0")}`;
};

const formatMoney = (value = 0, currency = "INR", currencySymbol = null) => {
  const amount = Number(value || 0).toFixed(2);
  if (currencySymbol) {
    return `${currencySymbol}${amount}`;
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch (_error) {
    return `${currency} ${amount}`;
  }
};

const getBillTaxSnapshot = async (orders = []) => {
  const orderSnapshot = orders.find(Boolean);
  if (orderSnapshot?.currency || orderSnapshot?.taxRate !== undefined) {
    return createTaxSnapshot({
      taxRate: orderSnapshot.taxRate,
      serviceCharge: orderSnapshot.serviceChargeRate,
      taxInclusive: orderSnapshot.taxInclusive,
      currency: orderSnapshot.currency,
      currencySymbol: orderSnapshot.currencySymbol,
    });
  }

  const tenantTaxSettings = await getTenantTaxSettings();
  return createTaxSnapshot(tenantTaxSettings);
};

const getPdfBranding = async () => {
  try {
    const settings = await AppSetting.findOne({ key: "app-settings" }).lean();
    return {
      name: settings?.restaurant?.name || "Tableloom Restaurant",
      address: settings?.restaurant?.address || "Address unavailable",
      phone: settings?.restaurant?.phone || "Phone unavailable",
      email: settings?.restaurant?.email || "Email unavailable",
      website: settings?.restaurant?.website || "",
      currency: settings?.taxSettings?.currency || "INR",
    };
  } catch (_error) {
    return {
      name: "Tableloom Restaurant",
      address: "Address unavailable",
      phone: "Phone unavailable",
      email: "Email unavailable",
      website: "",
      currency: "INR",
    };
  }
};

// PDF Generation
exports.generateBillPDF = async (bill) => {
  const branding = await getPdfBranding();
  const billCurrency = bill?.currency || branding.currency;
  const items = Array.isArray(bill?.items) ? [...bill.items] : [];
  const unresolvedMenuItemIds = items
    .filter(
      (item) =>
        (!item?.name ||
          item.name === "Unknown Item" ||
          item.name === "Menu item") &&
        item?.menuItem,
    )
    .map((item) => String(item.menuItem));

  if (unresolvedMenuItemIds.length > 0) {
    const menuItems = await MenuItem.find({
      _id: { $in: unresolvedMenuItemIds },
    })
      .select("name")
      .lean();

    const nameMap = new Map(menuItems.map((item) => [String(item._id), item.name]));
    items.forEach((item) => {
      if (
        (!item?.name || item.name === "Unknown Item" || item.name === "Menu item") &&
        item?.menuItem
      ) {
        item.name = nameMap.get(String(item.menuItem)) || item.name || "Menu item";
      }
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 100;
      const rightEdge = pageWidth - 50;
      let currentY = 50;

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc
        .roundedRect(50, currentY, contentWidth, 78, 18)
        .fillAndStroke("#FFF7ED", "#F59E0B");

      doc.fillColor("#9A3412").font("Helvetica-Bold").fontSize(22);
      doc.text(branding.name, 68, currentY + 18, { width: 270 });
      doc.font("Helvetica").fontSize(10).fillColor("#7C2D12");
      doc.text(branding.address, 68, currentY + 45, { width: 290 });

      doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827");
      doc.text("INVOICE", 370, currentY + 18, { width: 130, align: "right" });
      doc.font("Helvetica").fontSize(10).fillColor("#4B5563");
      doc.text(`Bill No: ${bill.billNumber}`, 350, currentY + 46, {
        width: 150,
        align: "right",
      });

      currentY += 104;

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827");
      doc.text("Customer Details", 50, currentY);
      doc.text("Bill Details", 320, currentY);

      currentY += 18;
      doc.font("Helvetica").fontSize(10).fillColor("#374151");
      doc.text(`Name: ${bill.customerName || "Guest"}`, 50, currentY);
      doc.text(
        `Date: ${new Date(bill.billDate || bill.createdAt).toLocaleDateString()}`,
        320,
        currentY,
      );
      currentY += 16;
      doc.text(`Phone: ${bill.customerPhone || "Not available"}`, 50, currentY);
      doc.text(
        `Time: ${new Date(bill.billDate || bill.createdAt).toLocaleTimeString()}`,
        320,
        currentY,
      );
      currentY += 16;
      doc.text(`Email: ${bill.customerEmail || "Not available"}`, 50, currentY, {
        width: 210,
      });
      doc.text(
        `Table: ${bill.metadata?.get?.("tableNumber") || bill.metadata?.tableNumber || "N/A"}`,
        320,
        currentY,
      );
      currentY += 28;

      doc.roundedRect(50, currentY, contentWidth, 28, 10).fill("#111827");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF");
      doc.text("Item", 62, currentY + 9, { width: 190 });
      doc.text("Size", 255, currentY + 9, { width: 80 });
      doc.text("Qty", 340, currentY + 9, { width: 40, align: "center" });
      doc.text("Rate", 390, currentY + 9, { width: 60, align: "right" });
      doc.text("Amount", 455, currentY + 9, { width: 75, align: "right" });

      currentY += 40;

      items.forEach((item, index) => {
        const rowHeight = 24;
        if (index % 2 === 0) {
          doc.roundedRect(50, currentY - 4, contentWidth, rowHeight, 8).fill("#F9FAFB");
        }

        doc.font("Helvetica").fontSize(10).fillColor("#111827");
        doc.text(item.name || "Menu item", 62, currentY, { width: 180 });
        doc.text(item.size || "-", 255, currentY, { width: 75 });
        doc.text(String(item.quantity || 0), 340, currentY, {
          width: 40,
          align: "center",
        });
        doc.text(formatMoney(item.unitPrice, billCurrency), 390, currentY, {
          width: 60,
          align: "right",
        });
        doc.text(formatMoney(item.totalPrice, billCurrency), 455, currentY, {
          width: 75,
          align: "right",
        });
        currentY += rowHeight;
      });

      currentY += 8;
      doc.moveTo(50, currentY).lineTo(rightEdge, currentY).strokeColor("#E5E7EB").stroke();
      currentY += 18;

      const totalLine = (label, value, options = {}) => {
        const fontName = options.bold ? "Helvetica-Bold" : "Helvetica";
        const fontSize = options.large ? 12 : 10;
        doc.font(fontName).fontSize(fontSize).fillColor("#111827");
        doc.text(label, 350, currentY, { width: 90, align: "right" });
        doc.text(formatMoney(value, billCurrency), 445, currentY, {
          width: 85,
          align: "right",
        });
        currentY += options.large ? 20 : 16;
      };

      totalLine("Subtotal", bill.subtotal || 0);
      if (bill.taxAmount > 0) {
        totalLine(
          bill.taxInclusive
            ? `Tax (${Number(bill.taxRate || 0)}% included)`
            : `Tax (${Number(bill.taxRate || 0)}%)`,
          bill.taxAmount,
        );
      }
      if (bill.serviceCharge > 0) totalLine("Service", bill.serviceCharge);
      if (bill.discountAmount > 0) totalLine("Discount", -Math.abs(bill.discountAmount));

      doc
        .roundedRect(330, currentY - 4, 200, 34, 12)
        .fill("#EFF6FF");
      totalLine("Grand Total", bill.totalAmount || 0, { bold: true, large: true });

      currentY += 8;
      doc.roundedRect(50, currentY, contentWidth, 62, 14).fill("#F8FAFC");
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0F172A");
      doc.text(`Payment Status: ${String(bill.paymentStatus || "pending").toUpperCase()}`, 64, currentY + 14);
      doc.font("Helvetica").fontSize(10).fillColor("#334155");
      doc.text(
        `Method: ${bill.paymentMethod ? String(bill.paymentMethod).toUpperCase() : "PENDING"}`,
        64,
        currentY + 32,
      );
      doc.text(
        bill.paidAt
          ? `Paid At: ${new Date(bill.paidAt).toLocaleString()}`
          : "Awaiting payment confirmation",
        280,
        currentY + 32,
        { width: 230, align: "right" },
      );

      currentY += 92;
      doc.moveTo(50, currentY).lineTo(rightEdge, currentY).strokeColor("#E5E7EB").stroke();
      currentY += 16;
      doc.font("Helvetica").fontSize(9).fillColor("#6B7280");
      doc.text(`Contact: ${branding.phone} • ${branding.email}`, 50, currentY, {
        width: contentWidth,
        align: "center",
      });
      if (branding.website) {
        currentY += 12;
        doc.text(branding.website, 50, currentY, {
          width: contentWidth,
          align: "center",
        });
      }
      currentY += 16;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
      doc.text("Thank you for dining with us.", 50, currentY, {
        width: contentWidth,
        align: "center",
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

exports.generateAndSavePDF = async (bill) => {
  try {
    // Generate PDF buffer
    const pdfBuffer = await exports.generateBillPDF(bill);

    const upload = await uploadBillPDFToCloudinary(bill, pdfBuffer);

    bill.pdfMinioPath = upload.publicId;
    bill.pdfBucket = "raw";
    bill.pdfPublicId = upload.publicId;
    bill.pdfProvider = upload.provider;
    bill.pdfGenerated = true;
    bill.pdfUrl = upload.url;

    await bill.save();

    return upload.publicId;
  } catch (error) {
    bill.pdfGenerated = false;
    bill.pdfError = error.message;
    await bill.save();
    throw error;
  }
};

// Bill Data Processing
const calculateBillTotals = async (orders) => {
  let subtotal = 0;
  let taxAmount = 0;
  let serviceCharge = 0;
  let discountAmount = 0;
  let totalAmount = 0;
  const allItems = [];

  orders.forEach((order) => {
    subtotal += order.subtotal || 0;
    taxAmount += order.taxAmount || 0;
    serviceCharge += order.serviceCharge || 0;
    discountAmount += order.discountAmount || 0;
    totalAmount += order.totalAmount || 0;

    order.items.forEach((item) => {
      allItems.push({
        menuItem: item.menuItem?._id || item.menuItem,
        name: item.menuItem?.name || "Unknown Item",
        size: item.sizeName || item.size?.name || "Regular",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      });
    });
  });

  const taxSnapshot = await getBillTaxSnapshot(orders);

  return {
    subtotal,
    taxAmount,
    serviceCharge,
    discountAmount,
    totalAmount,
    items: allItems,
    ...taxSnapshot,
  };
};

// FIX: Added missing billNumber generation
const createBillDocument = async (
  sessionId,
  customer,
  orders,
  totals,
  customerEmail,
  forceNew = false
) => {
  // Check existing bill
  if (!forceNew) {
    const existingBill = await Bill.findOne({
      sessionId,
      paymentStatus: "pending",
      billStatus: { $in: ["draft", "sent", "viewed"] },
    }).sort({ createdAt: -1 });

    if (existingBill) {
      logger.info(`Existing bill found: ${existingBill.billNumber}`);
      return existingBill;
    }
  }

  // FIX: Generate bill number
  const billNumber = await exports.generateBillNumber();

  // Create new bill
  const bill = await Bill.create({
    billNumber,
    orderId: orders[0]._id,
    sessionId,
    customerId: customer._id,
    tableId: customer.table?._id,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    taxRate: totals.taxRate,
    taxInclusive: totals.taxInclusive,
    serviceCharge: totals.serviceCharge,
    serviceChargeRate: totals.serviceChargeRate,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
    currency: totals.currency,
    currencySymbol: totals.currencySymbol,
    items: totals.items,
    customerEmail: customerEmail || customer.email,
    customerPhone: customer.phone,
    customerName: customer.name,
    billDate: new Date(),
    requestedAt: new Date(),
    paymentStatus: "pending",
    billStatus: customerEmail ? "sent" : "draft",
    metadata: {
      orderCount: orders.length,
      orderNumbers: orders.map((o) => o.orderNumber),
      customerSessionStart: customer.sessionStart,
      tableNumber: customer.table?.tableNumber,
      generatedAt: new Date(),
    },
  });

  logger.info(`Bill created in database: ${bill.billNumber}`);
  return bill;
};

// Email Functions
const createBillEmailHtml = (bill) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; background: #f8f9fa; padding: 20px; border-radius: 5px; }
            .bill-details { margin: 20px 0; }
            .item-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .item-table th, .item-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .totals { background: #f8f9fa; padding: 15px; border-radius: 5px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>RESTAURANT NAME</h1>
                <p>Your Bill / Invoice</p>
            </div>
            
            <div class="bill-details">
                <p><strong>Bill Number:</strong> ${bill.billNumber}</p>
                <p><strong>Date:</strong> ${new Date(bill.billDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${new Date(bill.billDate).toLocaleTimeString()}</p>
                ${bill.customerName ? `<p><strong>Customer:</strong> ${bill.customerName}</p>` : ""}
            </div>
            
            <table class="item-table">
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
                    ${bill.items.map((item) => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.size || "-"}</td>
                            <td>${item.quantity}</td>
                            <td>₹${item.unitPrice.toFixed(2)}</td>
                            <td>₹${item.totalPrice.toFixed(2)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            
            <div class="totals">
                <p><strong>Subtotal:</strong> ${formatMoney(bill.subtotal, bill.currency)}</p>
                ${bill.taxAmount > 0 ? `<p><strong>${bill.taxInclusive ? "Tax (included)" : "Tax"}:</strong> ${formatMoney(bill.taxAmount, bill.currency)}</p>` : ""}
                ${bill.serviceCharge > 0 ? `<p><strong>Service Charge:</strong> ${formatMoney(bill.serviceCharge, bill.currency)}</p>` : ""}
                ${bill.discountAmount > 0 ? `<p><strong>Discount:</strong> -${formatMoney(Math.abs(bill.discountAmount), bill.currency)}</p>` : ""}
                <h3>Total Amount: ${formatMoney(bill.totalAmount, bill.currency)}</h3>
                <p><strong>Payment Status:</strong> ${bill.paymentStatus.toUpperCase()}</p>
            </div>
            
            <div class="footer">
                <p>Thank you for dining with us! Please find the attached PDF bill.</p>
                <p>For any queries, contact us at: info@restaurant.com | +91 9876543210</p>
                <p>GSTIN: XXAAAAA0000A1Z5</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const createPaymentConfirmationEmailHtml = (bill, paymentData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; background: #28a745; color: white; padding: 20px; border-radius: 5px; }
            .payment-details { margin: 20px 0; background: #f8f9fa; padding: 20px; border-radius: 5px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Payment Successful!</h1>
                <p>Thank you for your payment</p>
            </div>
            
            <div class="payment-details">
                <h2>Payment Details</h2>
                <p><strong>Bill Number:</strong> ${bill.billNumber}</p>
                <p><strong>Payment Date:</strong> ${new Date(bill.paidAt).toLocaleString()}</p>
                <p><strong>Payment Method:</strong> ${paymentData.method}</p>
                <p><strong>Transaction ID:</strong> ${paymentData.transactionId}</p>
                <p><strong>Amount Paid:</strong> ${formatMoney(bill.totalAmount, bill.currency)}</p>
                
                <h3 style="color: #28a745;">Payment Status: CONFIRMED ✓</h3>
            </div>
            
            <div class="footer">
                <p>This is a confirmation of your payment receipt.</p>
                <p>For any queries, contact us at: info@restaurant.com | +91 9876543210</p>
                <p>Thank you for dining with us!</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

exports.sendBillEmail = async (bill, pdfBuffer = null) => {
  try {
    if (!bill.customerEmail) {
      throw new Error("Customer email not found");
    }

    let pdfAttachment = pdfBuffer;

    if (!pdfAttachment && bill.pdfUrl) {
      pdfAttachment = await fetchRemoteBuffer(bill.pdfUrl);
    }

    const emailSubject = `Your Bill #${bill.billNumber} - Restaurant Name`;
    const emailHtml = createBillEmailHtml(bill);

    const mailOptions = {
      from: process.env.EMAIL_FROM || "restaurant@example.com",
      to: bill.customerEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments: [
        {
          filename: `bill_${bill.billNumber}.pdf`,
          content: pdfAttachment,
          contentType: "application/pdf",
        },
      ],
    };

    const transporter = createEmailTransporter();
    await transporter.sendMail(mailOptions);

    // Update bill record
    bill.emailSent = true;
    bill.emailSentAt = new Date();
    bill.emailRecipient = bill.customerEmail;
    bill.billStatus = "sent";
    await bill.save();

    logger.info(`Bill email sent to ${bill.customerEmail}`);
    return true;
  } catch (error) {
    logger.error("Email sending failed:", error);
    bill.emailError = error.message;
    await bill.save();
    throw error;
  }
};

// FIX: Make this function available for internal use
const sendPaymentConfirmationEmail = async (bill, paymentData) => {
  try {
    if (!bill.customerEmail) {
      logger.info("No customer email for payment confirmation");
      return false;
    }

    const emailSubject = `Payment Confirmation - Bill #${bill.billNumber}`;
    const emailHtml = createPaymentConfirmationEmailHtml(bill, paymentData);

    const mailOptions = {
      from: process.env.EMAIL_FROM || "restaurant@example.com",
      to: bill.customerEmail,
      subject: emailSubject,
      html: emailHtml,
    };

    const transporter = createEmailTransporter();
    await transporter.sendMail(mailOptions);
    logger.info(`Payment confirmation sent to ${bill.customerEmail}`);
    return true;
  } catch (error) {
    logger.error("Payment confirmation email failed:", error);
    return false;
  }
};


exports.generateBill = async (sessionId, customerEmail = null, forceNew = false) => {
  try {
    logger.info(`Generating bill for session: ${sessionId}`);

    // Get customer session
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] },
    }).populate("table");

    if (!customer) {
      throw new Error("Active customer session not found");
    }

    logger.info(`Customer found: ${customer._id}`);

    // Get all unpaid orders
    const orders = await Order.find({
      customer: customer._id,
      paymentStatus: { $ne: "paid" },
    })
      .populate("items.menuItem", "name description category")
      .populate("items.sizeId", "name code")
      .sort({ orderPlacedAt: 1 });

    if (orders.length === 0) {
      throw new Error("No unpaid orders found for this session");
    }

    logger.info(`Found ${orders.length} orders`);

    // Calculate totals
    const totals = await calculateBillTotals(orders);
    logger.info(`Calculated totals - Subtotal: ${totals.subtotal}, Total: ${totals.totalAmount}`);

    // Create bill document
    const bill = await createBillDocument(sessionId, customer, orders, totals, customerEmail, forceNew);

    // Generate and save PDF - FIX: Use exports.
    await exports.generateAndSavePDF(bill);

    // Send email if provided - FIX: Use the function directly
    if (customerEmail) {
      await exports.sendBillEmail(bill);
    }

    try {
      await notificationManager.createPaymentNotification(
        {
          _id: bill._id,
          billNumber: bill.billNumber,
          tableNumber: customer.table?.tableNumber,
          totalAmount: bill.totalAmount,
          paymentMethod: bill.paymentMethod,
          customerName: bill.customerName,
          customerId: customer._id,
        },
        "request"
      );
    } catch (notifError) {
      logger.error("Failed to create payment notification:", notifError);
    }

    return await enrichBillData(bill);
  } catch (error) {
    logger.error("Bill generation failed:", error);
    throw error;
  }
};

exports.getBillBySession = async (sessionId) => {
  try {
    const bill = await Bill.findOne({
      sessionId,
    }).sort({ createdAt: -1 });

    if (!bill) {
      return null;
    }

    return await enrichBillData(bill);
  } catch (error) {
    throw error;
  }
};

exports.getBillById = async (billId) => {
  try {
    const bill = await Bill.findById(billId);
    if (!bill) {
      throw new Error("Bill not found");
    }
    return await enrichBillData(bill);
  } catch (error) {
    throw error;
  }
};

exports.markBillAsViewed = async (billId, sessionId = null) => {
  try {
    const updateData = {
      billViewed: true,
      lastViewedAt: new Date(),
      $inc: { viewCount: 1 },
    };

    if (sessionId) {
      updateData.sessionId = sessionId;
    }

    const bill = await Bill.findByIdAndUpdate(billId, updateData, { new: true });

    if (!bill) {
      throw new Error("Bill not found");
    }

    return bill;
  } catch (error) {
    throw error;
  }
};

exports.updateBillPayment = async (billId, paymentData) => {
  try {
    const bill = await Bill.findById(billId);
    if (!bill) {
      throw new Error("Bill not found");
    }

    if (bill.paymentStatus === "paid") {
      throw new Error("Bill is already paid");
    }

    // Update payment info
    bill.paymentStatus = "paid";
    bill.paymentMethod = paymentData.method;
    bill.transactionId = paymentData.transactionId;
    bill.paidAt = new Date();
    bill.paymentGateway = paymentData.gateway;
    bill.billStatus = "paid";
    bill.finalizedAt = new Date();

    await bill.save();
    await exports.generateAndSavePDF(bill);

    try {
      await notificationManager.createPaymentNotification(
        {
          _id: bill._id,
          billNumber: bill.billNumber,
          tableNumber: bill.tableNumber,
          totalAmount: bill.totalAmount,
          paymentMethod: bill.paymentMethod,
          customerName: bill.customerName,
          customerId: bill.customerId,
        },
        "received"
      );
    } catch (notifError) {
      logger.error("Failed to create payment received notification:", notifError);
    }

    // Send payment confirmation email - FIX: Use the function
    if (bill.customerEmail) {
      await sendPaymentConfirmationEmail(bill, paymentData);
    }

    return await enrichBillData(bill);
  } catch (error) {
    throw error;
  }
};

exports.resendBillEmail = async (billId, newEmail = null) => {
  try {
    const bill = await Bill.findById(billId);
    if (!bill) {
      throw new Error("Bill not found");
    }

    if (newEmail) {
      bill.customerEmail = newEmail;
    }

    if (!bill.customerEmail) {
      throw new Error("No email address available");
    }

    if (!bill.pdfUrl) {
      throw new Error("Bill PDF not found in storage");
    }

    const pdfBuffer = await fetchRemoteBuffer(bill.pdfUrl);

    // Send email - FIX: Use exports.
    await exports.sendBillEmail(bill, pdfBuffer);

    return bill;
  } catch (error) {
    throw error;
  }
};

const enrichBillData = async (bill) => {
  const billObj = bill.toObject ? bill.toObject() : bill;

  // Add PDF URL if not present
  if (!billObj.pdfUrl && billObj._id) {
    billObj.pdfUrl = `${getBaseUrl()}/images/bills/${billObj._id}/pdf`;
  }

  // Add payment methods available
  billObj.availablePaymentMethods = ["cash", "card", "online", "upi", "wallet"];

  // Add QR code for payment
  billObj.paymentQR = `${getBaseUrl()}/api/bills/${billObj._id}/payment-qr`;

  // Add time since creation
  billObj.timeSinceCreation = getTimeSince(billObj.createdAt);

  return billObj;
};

// Export internal functions if needed
exports.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
