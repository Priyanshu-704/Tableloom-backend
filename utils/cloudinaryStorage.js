const path = require("path");
const cloudinary = require("cloudinary").v2;
require("dotenv").config({ quiet: true });

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "tableloom";

const isCloudinaryConfigured = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const normalizeFolder = (...parts) =>
  parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

const resolveFolder = (folder = "") =>
  normalizeFolder(CLOUDINARY_FOLDER, folder);

const isRemoteUrl = (value = "") => /^https?:\/\//i.test(String(value || ""));

const ensureConfigured = () => {
  if (!isCloudinaryConfigured) {
    const error = new Error("Cloudinary storage is not configured on the server.");
    error.statusCode = 503;
    throw error;
  }
};

const uploadBuffer = async ({
  buffer,
  originalname = "file",
  mimetype = "application/octet-stream",
  folder = "images",
  resourceType = "image",
}) => {
  ensureConfigured();

  if (!buffer) {
    throw new Error("Missing file buffer for upload");
  }

  const folderPath = resolveFolder(folder);
  const filename = path.parse(originalname).name || "file";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        filename_override: filename,
        display_name: originalname,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          publicId: result.public_id,
          url: result.secure_url,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
          originalFilename: result.original_filename || originalname,
          mimetype,
        });
      },
    );

    uploadStream.end(buffer);
  });
};

const deleteAsset = async (publicId, resourceType = "image") => {
  if (!publicId || !isCloudinaryConfigured) {
    return null;
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
};

const fetchRemoteBuffer = async (url) => {
  if (!url) {
    throw new Error("Missing file URL");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  isRemoteUrl,
  uploadBuffer,
  deleteAsset,
  fetchRemoteBuffer,
  resolveFolder,
};
