const { logger } = require("./../utils/logger.js");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const Table = require("../models/Table");
const Bill = require("../models/Bill");
const AppSetting = require("../models/AppSetting");
const {
  getStoredAssetReference,
  serveStoredAsset,
} = require("../utils/imageStorage");
const {
  buildQRCodeBuffer,
  buildTenantTableQrUrl,
} = require("../utils/qrGenerator");
const getRequestedVariant = (req) =>
  req.query?.variant === "thumbnail" ? "thumbnail" : "image";
const canAccessBill = (req, bill = {}) => {
  if (req.user?._id) {
    return true;
  }

  return (
    Boolean(req.customerSessionId) &&
    String(bill?.sessionId || "") === String(req.customerSessionId)
  );
};
exports.getMenuItemImage = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).select(
      "image thumbnail imagePublicId thumbnailPublicId",
    );
    const storedReference = getStoredAssetReference(menuItem, {
      variant: getRequestedVariant(req),
    });
    if (!storedReference) {
      return res.status(404).send("Image not found");
    }
    await serveStoredAsset(res, storedReference);
  } catch (error) {
    logger.error("Menu item image error:", error);
    res.status(404).send("Image not found");
  }
};
exports.getCategoryImage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).select(
      "image thumbnail imagePublicId thumbnailPublicId",
    );
    const storedReference = getStoredAssetReference(category, {
      variant: getRequestedVariant(req),
    });
    if (!storedReference) {
      return res.status(404).send("Image not found");
    }
    await serveStoredAsset(res, storedReference);
  } catch (error) {
    logger.error("Table QR image error:", error);
    res.status(404).send("Image not found");
  }
};
exports.getTableQRImage = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id).select(
      "tableNumber qrCode qrPublicId qrToken",
    );
    if (!table) {
      return res.status(404).send("Image not found");
    }
    if (table.qrToken) {
      const qrUrl = buildTenantTableQrUrl({
        tableId: table._id,
        tableNumber: table.tableNumber,
        token: table.qrToken,
        tenant: req.tenant,
        branch: req.branch,
      });
      if (!qrUrl) {
        return res.status(404).send("Image not found");
      }
      const qrBuffer = await buildQRCodeBuffer(qrUrl);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(qrBuffer);
    }
    if (!table.qrCode) {
      return res.status(404).send("Image not found");
    }
    await serveStoredAsset(res, table.qrCode, {
      contentType: "image/png",
    });
  } catch (error) {
    logger.error("Category image error:", error);
    res.status(404).send("Image not found");
  }
};
exports.getRestaurantLogo = async (req, res) => {
  try {
    const settings = await AppSetting.findOne({
      tenantId: req.tenant?._id,
      key: "app-settings",
    }).select("restaurant.logo restaurant.logoThumbnail");
    const logoUrl = getStoredAssetReference(settings?.restaurant, {
      variant: getRequestedVariant(req),
      originalField: "logo",
      thumbnailField: "logoThumbnail",
    });
    if (!logoUrl || String(settings?.restaurant?.logo || "").startsWith("/")) {
      return res.status(404).send("Image not found");
    }
    await serveStoredAsset(res, logoUrl);
  } catch (error) {
    logger.error("Restaurant logo error:", error);
    res.status(404).send("Image not found");
  }
};
exports.downloadBillPDF = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill || !bill.pdfUrl) {
      return res.status(404).json({
        success: false,
        message: "Bill PDF not found",
      });
    }
    if (!canAccessBill(req, bill)) {
      return res.status(req.customerSessionId || req.user?._id ? 403 : 401).json({
        success: false,
        message: "You are not authorized to access this bill",
      });
    }
    return serveStoredAsset(res, bill.pdfUrl, {
      contentType: "application/pdf",
      disposition: `attachment; filename="bill-${bill.billNumber || bill._id}.pdf"`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bill PDF",
    });
  }
};
