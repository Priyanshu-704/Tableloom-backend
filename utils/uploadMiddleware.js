const {
  logger
} = require("./logger.js");
const multer = require("multer");
require("dotenv").config({
  quiet: true
});
const {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
  saveImageVariants
} = require("./imageStorage");
const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new Error("Only JPG, JPEG, and PNG images are allowed"));
};
const csvFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv") return cb(null, true);
  cb(new Error("Only CSV files are allowed"));
};
const createImageUploader = () => multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE
  },
  fileFilter: imageFilter
}).single("image");
const uploadCSV = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: csvFilter
}).single("file");
const createImageUploadHandler = ({
  folder = "images"
} = {}) => {
  const uploadImage = createImageUploader();
  return async (req, res, next) => {
    uploadImage(req, res, async function (err) {
      if (err) {
        return next(err);
      }
      if (!req.file) {
        return next();
      }
      try {
        const uploaded = await saveImageVariants({
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          folder
        });
        req.file.url = uploaded.image;
        req.file.thumbnailUrl = uploaded.thumbnail;
        req.file.publicId = uploaded.imagePublicId;
        req.file.thumbnailPublicId = uploaded.thumbnailPublicId;
        req.file.image = uploaded.image;
        req.file.thumbnail = uploaded.thumbnail;
        req.file.storageProvider = uploaded.provider;
        req.file.resourceType = "image";
        logger.info("Image processed successfully", {
          provider: uploaded.provider,
          original: uploaded.imagePublicId,
          thumbnail: uploaded.thumbnailPublicId
        });
        next();
      } catch (uploadError) {
        logger.error("Error processing uploaded file:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to process image. Please try again."
        });
      }
    });
  };
};
const handleImageUpload = createImageUploadHandler();
const handleCSVUpload = (req, res, next) => {
  uploadCSV(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB."
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
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
        message: "File too large. Maximum size is 2MB."
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};
module.exports = {
  createImageUploadHandler,
  handleImageUpload,
  handleCSVUpload,
  handleUploadErrors,
  minioClient: null,
  MINIO_BUCKET: null,
  generateMinioUrl: async () => null,
  generatePresignedUrl: async () => null
};
