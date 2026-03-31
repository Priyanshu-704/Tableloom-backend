const { logger } = require("./logger.js");
const multer = require("multer");
require("dotenv").config({ quiet: true });
const AppError = require("./appError");
const {
  isCloudinaryConfigured,
  uploadBuffer,
} = require("./cloudinaryStorage");

const imageFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error("Only jpeg, png, gif, webp images are allowed"));
};

const csvFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv") return cb(null, true);
  cb(new Error("Only CSV files are allowed"));
};

const createImageUploader = () => {
  if (!isCloudinaryConfigured) {
    throw new AppError(
      "Image upload is not available because Cloudinary is not configured on the server.",
      503,
    );
  }

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFilter,
  }).single("image");
};

const uploadCSV = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: csvFilter,
}).single("file");

const handleImageUpload = async (req, res, next) => {
  let uploadImage;

  try {
    uploadImage = createImageUploader();
  } catch (error) {
    return next(error);
  }

  uploadImage(req, res, async function (err) {
    if (err) {
      return next(err);
    }

    if (!req.file) {
      return next();
    }

    try {
      const uploaded = await uploadBuffer({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        folder: "images",
        resourceType: "image",
      });

      req.file.url = uploaded.url;
      req.file.publicId = uploaded.publicId;
      req.file.storageProvider = "cloudinary";
      req.file.resourceType = uploaded.resourceType;

      logger.info("File uploaded to Cloudinary:", uploaded.publicId);
      next();
    } catch (uploadError) {
      logger.error("Error processing uploaded file:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to process image. Please try again.",
      });
    }
  });
};

const handleCSVUpload = (req, res, next) => {
  uploadCSV(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next();
};

module.exports = {
  handleImageUpload,
  handleCSVUpload,
  handleUploadErrors,
  minioClient: null,
  MINIO_BUCKET: null,
  generateMinioUrl: async () => null,
  generatePresignedUrl: async () => null,
};
