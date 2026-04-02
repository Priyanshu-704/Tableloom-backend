const { logger } = require("./../utils/logger.js");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const Table = require("../models/Table");
const Bill = require("../models/Bill");
const AppSetting = require("../models/AppSetting");

const proxyRemoteAsset = async (res, url, options = {}) => {
  if (!url) {
    return res.status(404).send("Image not found");
  }

  const response = await fetch(url);
  if (!response.ok) {
    return res.status(404).send("Image not found");
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType =
    options.contentType ||
    response.headers.get("content-type") ||
    "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");

  if (options.disposition) {
    res.setHeader("Content-Disposition", options.disposition);
  }

  return res.send(Buffer.from(arrayBuffer));
};

exports.getMenuItemImage = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).select(
      "image imagePublicId"
    );

    if (!menuItem?.image) {
      return res.status(404).send("Image not found");
    }

    await proxyRemoteAsset(res, menuItem.image);
  } catch (error) {
    logger.error("Menu item image error:", error);
    res.status(404).send("Image not found");
  }
};

exports.getCategoryImage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).select(
      "image imagePublicId"
    );

    if (!category?.image) {
      return res.status(404).send("Image not found");
    }

    await proxyRemoteAsset(res, category.image);
  } catch (error) {
    logger.error("Category image error:", error);
    res.status(404).send("Image not found");
  }
};

exports.getTableQRImage = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id).select(
      "qrCode qrPublicId"
    );

    if (!table?.qrCode) {
      return res.status(404).send("Image not found");
    }

    await proxyRemoteAsset(res, table.qrCode, { contentType: "image/png" });
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
    }).select("restaurant.logo");

    const logoUrl = settings?.restaurant?.logo;
    if (!logoUrl || String(logoUrl).startsWith("/")) {
      return res.status(404).send("Image not found");
    }

    await proxyRemoteAsset(res, logoUrl);
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

    return proxyRemoteAsset(res, bill.pdfUrl, {
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
