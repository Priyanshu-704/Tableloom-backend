const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const REPORT_TTL_MS = 1000 * 60 * 60 * 6;
const REPORT_OUTPUT_DIR = path.join(os.tmpdir(), "quickbite-generated-reports");
const reportRegistry = new Map();

const ensureOutputDir = () => {
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }
};

const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatCurrency = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numberValue(value));

const formatMinutes = (secondsOrMinutes) => {
  const value = numberValue(secondsOrMinutes);
  const minutes = value > 60 ? value / 60 : value;
  return `${Math.round(minutes)} min`;
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toLocaleString() : date.toLocaleString();
};

const sanitizeFileSegment = (value, fallback = "report") =>
  String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildAnalyticsSummaryCards = (dataset = {}, currency = "INR") => [
  {
    label: "Revenue",
    value: formatCurrency(
      dataset?.orders?.todayRevenue || dataset?.sessions?.revenue || 0,
      currency
    ),
  },
  {
    label: "Orders",
    value: numberValue(dataset?.orders?.todayOrders || dataset?.orders?.totalOrders || 0).toLocaleString(),
  },
  {
    label: "Completed Sessions",
    value: numberValue(dataset?.sessions?.completedSessions || 0).toLocaleString(),
  },
  {
    label: "NPS Score",
    value: Math.round(numberValue(dataset?.feedback?.nps?.score || dataset?.feedback?.nps?.nps || 0)).toString(),
  },
];

const buildAnalyticsOrderStatusRows = (dataset = {}) =>
  Object.entries(dataset?.orders?.statusCounts || {}).map(([status, count]) => ({
    label: String(status || "").replace(/_/g, " "),
    value: numberValue(count),
  }));

const buildAnalyticsPopularItemsRows = (dataset = {}, currency = "INR") =>
  (dataset?.orders?.popularItems || []).map((item) => ({
    label: `${item?.name || "Menu item"}${item?.size ? ` (${item.size})` : ""}`,
    value: `${numberValue(item?.totalQuantity).toLocaleString()} items`,
    secondary: formatCurrency(item?.totalRevenue || 0, currency),
    quantity: numberValue(item?.totalQuantity),
  }));

const buildAnalyticsOperationsRows = (dataset = {}) => [
  {
    metric: "Average session time",
    value: formatMinutes(dataset?.sessions?.averageSessionTime || 0),
  },
  {
    metric: "Kitchen preparation time",
    value: formatMinutes(dataset?.kitchen?.overallStats?.avgPreparationTime || 0),
  },
  {
    metric: "Kitchen total time",
    value: formatMinutes(dataset?.kitchen?.overallStats?.avgTotalTime || 0),
  },
  {
    metric: "Occupancy rate",
    value: `${numberValue(dataset?.tables?.occupancyRate || 0).toFixed(1)}%`,
  },
  {
    metric: "Waiter calls",
    value: numberValue(dataset?.waiterCalls?.totalCalls || 0).toLocaleString(),
  },
  {
    metric: "Pending waiter calls",
    value: numberValue(
      dataset?.waiterCalls?.statistics?.pendingCalls ??
        dataset?.waiterCalls?.pendingCalls ??
        0
    ).toLocaleString(),
  },
];

const buildAnalyticsWaiterStatusRows = (dataset = {}) =>
  (dataset?.waiterCalls?.byStatus || []).map((row) => ({
    status: row?.status || "unknown",
    count: numberValue(row?.count || 0).toLocaleString(),
    averageTime: formatMinutes(row?.avgResponseTime || row?.avgResolutionTime || 0),
  }));

const buildFinanceSummaryCards = (dataset = {}, currency = "INR") => [
  {
    label: "Total Revenue",
    value: formatCurrency(dataset?.summary?.totalRevenue || 0, currency),
  },
  {
    label: "Paid Orders",
    value: numberValue(dataset?.summary?.totalPaidOrders || 0).toLocaleString(),
  },
  {
    label: "Average Order Value",
    value: formatCurrency(dataset?.summary?.averageOrderValue || 0, currency),
  },
  {
    label: "Session Revenue",
    value: formatCurrency(dataset?.summary?.totalSessionRevenue || 0, currency),
  },
];

const buildFinanceDailyRevenueRows = (dataset = {}, currency = "INR") =>
  (dataset?.dailyRevenue || []).map((row) => ({
    label: row?.day || "Day",
    value: formatCurrency(row?.revenue || 0, currency),
    secondary: `${numberValue(row?.orders || 0).toLocaleString()} orders`,
    quantity: numberValue(row?.revenue || 0),
  }));

const buildFinancePaymentMethodRows = (dataset = {}, currency = "INR") =>
  (dataset?.paymentMethods || []).map((row) => ({
    metric: String(row?.method || "unknown").replace(/_/g, " "),
    value: `${formatCurrency(row?.revenue || 0, currency)} | ${numberValue(row?.orders || 0).toLocaleString()} orders`,
  }));

const buildFinanceOrderTypeRows = (dataset = {}, currency = "INR") =>
  (dataset?.orderTypes || []).map((row) => ({
    metric: String(row?.orderType || "unknown").replace(/_/g, " "),
    value: `${formatCurrency(row?.revenue || 0, currency)} | ${numberValue(row?.orders || 0).toLocaleString()} orders`,
  }));

const buildFinanceBreakdownRows = (dataset = {}, currency = "INR") => [
  {
    metric: "Subtotal",
    value: formatCurrency(dataset?.summary?.subtotal || 0, currency),
  },
  {
    metric: "Tax Collected",
    value: formatCurrency(dataset?.summary?.taxAmount || 0, currency),
  },
  {
    metric: "Service Charge",
    value: formatCurrency(dataset?.summary?.serviceCharge || 0, currency),
  },
  {
    metric: "Discounts",
    value: formatCurrency(dataset?.summary?.discountAmount || 0, currency),
  },
  {
    metric: "Average Session Revenue",
    value: formatCurrency(dataset?.summary?.averageSessionRevenue || 0, currency),
  },
  {
    metric: "Completed Sessions",
    value: numberValue(dataset?.summary?.completedSessions || 0).toLocaleString(),
  },
];

const ensurePageSpace = (doc, currentY, requiredHeight = 90) => {
  const bottomBoundary = doc.page.height - doc.page.margins.bottom;
  if (currentY + requiredHeight <= bottomBoundary) {
    return currentY;
  }
  doc.addPage();
  return doc.page.margins.top;
};

const renderSectionTitle = (doc, title, currentY) => {
  const nextY = ensurePageSpace(doc, currentY, 36);
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#111827")
    .text(title, doc.page.margins.left, nextY);
  return nextY + 24;
};

const renderSummaryCards = (doc, cards = [], currentY) => {
  const nextY = ensurePageSpace(doc, currentY, 110);
  const startX = doc.page.margins.left;
  const cardGap = 10;
  const cardWidth =
    (doc.page.width - doc.page.margins.left - doc.page.margins.right - cardGap * 3) / 4;
  const cardHeight = 76;

  cards.forEach((card, index) => {
    const x = startX + index * (cardWidth + cardGap);
    doc.roundedRect(x, nextY, cardWidth, cardHeight, 14).fillAndStroke("#f8fafc", "#dbeafe");
    doc
      .fillColor("#475569")
      .font("Helvetica")
      .fontSize(10)
      .text(card.label, x + 12, nextY + 12, { width: cardWidth - 24 });
    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(card.value, x + 12, nextY + 34, { width: cardWidth - 24 });
  });

  return nextY + cardHeight + 18;
};

const renderBarChart = (doc, title, rows = [], currentY, options = {}) => {
  let y = renderSectionTitle(doc, title, currentY);
  if (!rows.length) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No data available", doc.page.margins.left, y);
    return y + 20;
  }

  const maxValue = Math.max(...rows.map((row) => numberValue(row.quantity ?? row.value)), 1);
  rows.forEach((row) => {
    y = ensurePageSpace(doc, y, 38);
    const label = row.label || row.metric || "Item";
    const numericValue = numberValue(row.quantity ?? row.value);
    const width = Math.max(18, (numericValue / maxValue) * (options.chartWidth || 220));
    doc.font("Helvetica").fontSize(10).fillColor("#111827").text(label, doc.page.margins.left, y, {
      width: 170,
    });
    doc.roundedRect(doc.page.margins.left + 180, y + 2, options.chartWidth || 220, 10, 999).fill("#e2e8f0");
    doc.roundedRect(doc.page.margins.left + 180, y + 2, width, 10, 999).fill(options.barColor || "#0f766e");
    doc
      .fillColor("#475569")
      .font("Helvetica")
      .fontSize(10)
      .text(row.secondary ? `${row.value} | ${row.secondary}` : row.value, doc.page.margins.left + 410, y - 2, {
        width: 120,
        align: "right",
      });
    y += 24;
  });

  return y + 4;
};

const renderTwoColumnTable = (doc, title, rows = [], currentY) => {
  let y = renderSectionTitle(doc, title, currentY);
  const tableX = doc.page.margins.left;
  const valueX = tableX + 300;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  y = ensurePageSpace(doc, y, 30);
  doc.roundedRect(tableX, y, tableWidth, 26, 10).fill("#eff6ff");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text("Metric", tableX + 12, y + 8);
  doc.text("Value", valueX, y + 8);
  y += 34;

  if (!rows.length) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No data available", tableX, y);
    return y + 20;
  }

  rows.forEach((row, index) => {
    y = ensurePageSpace(doc, y, 24);
    if (index % 2 === 0) {
      doc.roundedRect(tableX, y - 4, tableWidth, 22, 8).fill("#f8fafc");
    }
    doc.font("Helvetica").fontSize(10).fillColor("#111827").text(row.metric || row.status || row.label, tableX + 12, y);
    doc.text(row.value || row.count || row.averageTime || "-", valueX, y, {
      width: tableWidth - (valueX - tableX) - 12,
      align: "left",
    });
    y += 22;
  });

  return y + 8;
};

const buildExcelMarkup = ({
  reportType,
  reportTitle,
  restaurantName,
  generatedAt,
  dateRangeLabel,
  currency,
  dataset,
}) => {
  const isFinance = reportType === "finance";
  const summaryCards = isFinance
    ? buildFinanceSummaryCards(dataset, currency)
    : buildAnalyticsSummaryCards(dataset, currency);
  const chartRows = isFinance
    ? buildFinanceDailyRevenueRows(dataset, currency)
    : buildAnalyticsPopularItemsRows(dataset, currency);
  const firstTableRows = isFinance
    ? buildFinancePaymentMethodRows(dataset, currency)
    : buildAnalyticsOrderStatusRows(dataset).map((row) => ({
        metric: row.label,
        value: row.value.toLocaleString(),
      }));
  const secondTableRows = isFinance
    ? buildFinanceOrderTypeRows(dataset, currency)
    : buildAnalyticsOperationsRows(dataset);
  const thirdTableRows = isFinance
    ? buildFinanceBreakdownRows(dataset, currency)
    : buildAnalyticsWaiterStatusRows(dataset).map((row) => ({
        metric: `${row.status} (${row.count})`,
        value: row.averageTime,
      }));
  const maxChartValue = Math.max(...chartRows.map((row) => row.quantity), 1);
  const chartTitle = isFinance ? "Daily Revenue Chart" : "Popular Items Chart";
  const firstTableTitle = isFinance ? "Payment Method Revenue" : "Order Status Summary";
  const secondTableTitle = isFinance ? "Order Type Revenue" : "Operations Summary";
  const thirdTableTitle = isFinance ? "Revenue Breakdown" : "Waiter Call Status";

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <meta name="ProgId" content="Excel.Sheet" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          .header { border: 1px solid #dbeafe; border-radius: 18px; padding: 24px; background: linear-gradient(135deg, #eff6ff, #ffffff); }
          .cards { width: 100%; margin-top: 20px; border-collapse: separate; border-spacing: 12px 0; }
          .card { border: 1px solid #e5e7eb; border-radius: 16px; background: #f8fafc; padding: 16px; }
          .card-label { color: #64748b; font-size: 12px; }
          .card-value { font-size: 24px; font-weight: bold; color: #0f172a; margin-top: 6px; }
          .section-title { margin-top: 28px; font-size: 18px; font-weight: bold; color: #0f172a; }
          table.report { width: 100%; border-collapse: collapse; margin-top: 12px; }
          table.report th, table.report td { border: 1px solid #dbe4f0; padding: 10px 12px; text-align: left; }
          table.report th { background: #eff6ff; }
          .chart-row { margin-top: 10px; }
          .chart-label { display: inline-block; width: 260px; }
          .chart-track { display: inline-block; width: 280px; height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden; vertical-align: middle; }
          .chart-bar { display: inline-block; height: 12px; background: #0f766e; border-radius: 999px; }
          .chart-value { display: inline-block; width: 180px; margin-left: 12px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(reportTitle)}</h1>
          <p><strong>Restaurant:</strong> ${escapeHtml(restaurantName)}</p>
          <p><strong>Report Period:</strong> ${escapeHtml(dateRangeLabel)}</p>
          <p><strong>Generated On:</strong> ${escapeHtml(formatDateTime(generatedAt))}</p>
        </div>

        <table class="cards">
          <tr>
            ${summaryCards
              .map(
                (card) => `
                  <td class="card">
                    <div class="card-label">${escapeHtml(card.label)}</div>
                    <div class="card-value">${escapeHtml(card.value)}</div>
                  </td>
                `
              )
              .join("")}
          </tr>
        </table>

        <div class="section-title">${escapeHtml(chartTitle)}</div>
        ${chartRows.length
          ? chartRows
              .map((row) => {
                const width = Math.max(8, Math.round((row.quantity / maxChartValue) * 100));
                return `
                  <div class="chart-row">
                    <span class="chart-label">${escapeHtml(row.label)}</span>
                    <span class="chart-track"><span class="chart-bar" style="width:${width}%"></span></span>
                    <span class="chart-value">${escapeHtml(row.secondary ? `${row.value} | ${row.secondary}` : row.value)}</span>
                  </div>
                `;
              })
              .join("")
          : `<p>No chart data found for the selected period.</p>`}

        <div class="section-title">${escapeHtml(firstTableTitle)}</div>
        <table class="report">
          <thead>
            <tr><th>Metric</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${
              firstTableRows.length
                ? firstTableRows
                    .map(
                      (row) => `<tr><td>${escapeHtml(row.metric)}</td><td>${escapeHtml(row.value)}</td></tr>`
                    )
                    .join("")
                : `<tr><td colspan="2">No data available</td></tr>`
            }
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(secondTableTitle)}</div>
        <table class="report">
          <thead>
            <tr><th>Metric</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${
              secondTableRows.length
                ? secondTableRows
                    .map(
                      (row) => `<tr><td>${escapeHtml(row.metric)}</td><td>${escapeHtml(row.value)}</td></tr>`
                    )
                    .join("")
                : `<tr><td colspan="2">No data available</td></tr>`
            }
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(thirdTableTitle)}</div>
        <table class="report">
          <thead>
            <tr><th>Metric</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${
              thirdTableRows.length
                ? thirdTableRows
                    .map(
                      (row) => `<tr><td>${escapeHtml(row.metric)}</td><td>${escapeHtml(row.value)}</td></tr>`
                    )
                    .join("")
                : `<tr><td colspan="2">No data available</td></tr>`
            }
          </tbody>
        </table>
      </body>
    </html>
  `;
};

const buildPdfBuffer = ({
  reportType,
  reportTitle,
  restaurantName,
  generatedAt,
  dateRangeLabel,
  currency,
  dataset,
}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    const isFinance = reportType === "finance";

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.roundedRect(40, 40, doc.page.width - 80, 94, 18).fillAndStroke("#eff6ff", "#dbeafe");
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(22).text(reportTitle, 56, 58);
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    doc.text(`Restaurant: ${restaurantName}`, 56, 88);
    doc.text(`Report Period: ${dateRangeLabel}`, 56, 104);
    doc.text(`Generated On: ${formatDateTime(generatedAt)}`, 56, 120);

    let y = 156;
    y = renderSummaryCards(
      doc,
      isFinance ? buildFinanceSummaryCards(dataset, currency) : buildAnalyticsSummaryCards(dataset, currency),
      y
    );

    if (isFinance) {
      y = renderBarChart(doc, "Daily Revenue", buildFinanceDailyRevenueRows(dataset, currency), y, {
        barColor: "#0f766e",
        chartWidth: 200,
      });
      y = renderTwoColumnTable(doc, "Payment Method Revenue", buildFinancePaymentMethodRows(dataset, currency), y);
      y = renderTwoColumnTable(doc, "Order Type Revenue", buildFinanceOrderTypeRows(dataset, currency), y);
      renderTwoColumnTable(doc, "Revenue Breakdown", buildFinanceBreakdownRows(dataset, currency), y);
    } else {
      y = renderBarChart(doc, "Popular Items", buildAnalyticsPopularItemsRows(dataset, currency), y, {
        barColor: "#0f766e",
        chartWidth: 200,
      });
      y = renderBarChart(
        doc,
        "Order Status Chart",
        buildAnalyticsOrderStatusRows(dataset).map((row) => ({
          label: row.label,
          value: row.value.toLocaleString(),
          quantity: row.value,
        })),
        y,
        { barColor: "#2563eb", chartWidth: 200 }
      );
      y = renderTwoColumnTable(doc, "Operations Summary", buildAnalyticsOperationsRows(dataset), y);
      renderTwoColumnTable(
        doc,
        "Waiter Call Status",
        buildAnalyticsWaiterStatusRows(dataset).map((row) => ({
          metric: `${row.status} (${row.count})`,
          value: row.averageTime,
        })),
        y
      );
    }

    doc.end();
  });

const cleanupExpiredReports = () => {
  const now = Date.now();
  for (const [reportId, reportMeta] of reportRegistry.entries()) {
    if (now - reportMeta.createdAt <= REPORT_TTL_MS) {
      continue;
    }

    if (fs.existsSync(reportMeta.filePath)) {
      fs.unlinkSync(reportMeta.filePath);
    }
    reportRegistry.delete(reportId);
  }
};

const registerReportFile = ({ tenantId, format, filePath, filename, contentType }) => {
  cleanupExpiredReports();
  const reportId = crypto.randomBytes(16).toString("hex");
  reportRegistry.set(reportId, {
    tenantId: String(tenantId || ""),
    format,
    filePath,
    filename,
    contentType,
    createdAt: Date.now(),
  });
  return reportId;
};

const generateAnalyticsReport = async ({
  tenantId,
  reportType = "analytics",
  format,
  reportTitle,
  restaurantName,
  generatedAt,
  dateRangeLabel,
  currency,
  dataset,
}) => {
  ensureOutputDir();
  cleanupExpiredReports();

  const safeTitle = sanitizeFileSegment(
    reportTitle,
    reportType === "finance" ? "finance-report" : "analytics-report"
  );
  const safeDate = sanitizeFileSegment(dateRangeLabel, "period");
  const extension = format === "excel" ? "xls" : "pdf";
  const filename = `${safeTitle}-${safeDate}.${extension}`;
  const filePath = path.join(
    REPORT_OUTPUT_DIR,
    `${sanitizeFileSegment(tenantId || "tenant")}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString("hex")}.${extension}`
  );

  if (format === "excel") {
    const workbookMarkup = buildExcelMarkup({
      reportType,
      reportTitle,
      restaurantName,
      generatedAt,
      dateRangeLabel,
      currency,
      dataset,
    });
    fs.writeFileSync(filePath, workbookMarkup, "utf8");
    return {
      reportId: registerReportFile({
        tenantId,
        format,
        filePath,
        filename,
        contentType: "application/vnd.ms-excel",
      }),
      filename,
      format,
      reportType,
    };
  }

  const pdfBuffer = await buildPdfBuffer({
    reportType,
    reportTitle,
    restaurantName,
    generatedAt,
    dateRangeLabel,
    currency,
    dataset,
  });
  fs.writeFileSync(filePath, pdfBuffer);
  return {
    reportId: registerReportFile({
      tenantId,
      format,
      filePath,
      filename,
      contentType: "application/pdf",
    }),
    filename,
    format,
    reportType,
  };
};

const getGeneratedReport = (reportId) => {
  cleanupExpiredReports();
  return reportRegistry.get(reportId) || null;
};

module.exports = {
  generateAnalyticsReport,
  getGeneratedReport,
};
