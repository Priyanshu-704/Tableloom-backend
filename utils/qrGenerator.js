const { logger } = require("./logger.js");
const QRCode = require("qrcode");
const crypto = require("crypto");
const {
  uploadBuffer,
  deleteAsset,
} = require("../utils/cloudinaryStorage");
const Table = require('../models/Table');
require("dotenv").config({ quiet: true });

const generateQRCode = async (data, tableNumber) => {
  try {
    const filename = `table-${tableNumber}-${Date.now()}.png`;

    const qrBuffer = await QRCode.toBuffer(data, {
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    const uploaded = await uploadBuffer({
      buffer: qrBuffer,
      originalname: filename,
      mimetype: "image/png",
      folder: "qrcodes",
      resourceType: "image",
    });

    return {
      url: uploaded.url,
      publicId: uploaded.publicId,
      provider: "cloudinary",
    };
  } catch (error) {
    logger.error("QR Code generation failed:", error);
    throw new Error("Failed to generate QR code");
  }
};

const normalizeBaseUrl = (value = "") => String(value || "").replace(/\/+$/, "");

const buildTenantTableQrUrl = ({ tableId, tableNumber, token, tenant } = {}) => {
  const baseUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
  const encodedTableNumber = encodeURIComponent(String(tableNumber || ""));

  if (!baseUrl || !tableId || !token || !encodedTableNumber) {
    return null;
  }

  const tenantSlug = String(tenant?.slug || "").trim().toLowerCase();
  const tenantKey = String(tenant?.key || "").trim().toLowerCase();
  const tenantPrefix = tenantSlug && tenantKey ? `/${tenantSlug}/${tenantKey}` : "";

  return `${baseUrl}${tenantPrefix}/table/${encodedTableNumber}?table=${tableId}&token=${token}`;
};

const generateQRData = (tableId, tableNumber, tenant = null) => {
  const timestamp = Date.now();
  const token = crypto.randomBytes(32).toString('hex');
  const qrUrl = buildTenantTableQrUrl({
    tableId,
    tableNumber,
    token,
    tenant,
  });

  return {
    url: qrUrl,
    token,
    expiry: new Date(timestamp + (30 * 24 * 60 * 60 * 1000))
  };
};


const verifyQRToken = async (tableId, token) => {
  try {
   
    const table = await Table.findById(tableId)
      .select(
        "_id tableNumber tableName capacity location status isActive qrToken qrTokenExpiry",
      )
      .lean();
    
    if (!table) {
      return { isValid: false, message: 'Table not found' };
    }
    

    if (!table.qrToken) {
      return { isValid: false, message: 'No QR token generated for this table' };
    }
    
    if (table.qrToken !== token) {
      return { isValid: false, message: 'Invalid QR token' };
    }
  
    if (table.qrTokenExpiry && new Date() > table.qrTokenExpiry) {
      return { isValid: false, message: 'QR code has expired' };
    }
    
    if (!table.isActive) {
      return { isValid: false, message: 'Table is inactive' };
    }
    
    if (table.status !== 'available') {
      return { isValid: false, message: `Table is currently ${table.status}` };
    }
    
    return { 
      isValid: true, 
      table,
      message: 'QR token verified successfully'
    };
    
  } catch (error) {
    logger.error('Token verification failed:', error);
    return { isValid: false, message: 'Verification failed' };
  }
};

const refreshQRToken = async (tableId, tenant = null) => {
  try {
    const table = await Table.findById(tableId);
    
    if (!table) {
      throw new Error('Table not found');
    }
    
    const qrInfo = generateQRData(tableId, table.tableNumber, tenant);
    
    table.qrToken = qrInfo.token;
    table.qrTokenExpiry = qrInfo.expiry;
    
    const qrUpload = await generateQRCode(qrInfo.url, table.tableNumber);
    
    table.qrCode = qrUpload.url;
    table.qrPublicId = qrUpload.publicId;
    table.qrProvider = qrUpload.provider;
    
    await table.save();
    
    return {
      success: true,
      token: qrInfo.token,
      url: qrInfo.url,
      expiry: qrInfo.expiry
    };
    
  } catch (error) {
    logger.error('Token refresh failed:', error);
    throw error;
  }
};

const deleteQRFile = async (publicId) => {
  try {
    if (!publicId) return;

    await deleteAsset(publicId, "image");
    logger.info("QR deleted from Cloudinary:", publicId);
  } catch (error) {
    logger.error("Error deleting QR from Cloudinary:", error);
  }
};

module.exports = {
  generateQRCode,
  generateQRData,
  buildTenantTableQrUrl,
  deleteQRFile,
  verifyQRToken, 
  refreshQRToken
};
