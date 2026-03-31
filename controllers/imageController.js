const { logger } = require("./../utils/logger.js");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const Table = require("../models/Table");
const Bill = require("../models/Bill");
const redirectToAsset = (res, url) => res.redirect(url);

exports.getMenuItemImage = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).select(
      "image imagePublicId"
    );

    if (!menuItem?.image) {
      return res.status(404).send("Image not found");
    }

    await redirectToAsset(res, menuItem.image);
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

    await redirectToAsset(res, category.image);
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

    await redirectToAsset(res, table.qrCode);
  } catch (error) {
    logger.error("Category image error:", error);
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

    return redirectToAsset(res, bill.pdfUrl);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bill PDF",
    });
  }
};
