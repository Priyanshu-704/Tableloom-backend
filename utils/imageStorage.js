const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const {
  deleteAsset,
  isCloudinaryConfigured,
  uploadBuffer,
} = require("./cloudinaryStorage");
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_IMAGE_FILE_SIZE = 2 * 1024 * 1024;
const THUMBNAIL_SIZE = 200;
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const normalizeFolder = (value = "") =>
  String(value || "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/\/{2,}/g, "/");
const sanitizeFilenameBase = (value = "image") =>
  String(value || "image")
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "image";
const getExtensionForMimeType = (mimetype = "") =>
  String(mimetype).toLowerCase() === "image/png" ? ".png" : ".jpg";
const buildRelativePath = (folder, variant, filename) =>
  path.posix.join("uploads", normalizeFolder(folder), variant, filename);
const buildAbsolutePath = (relativePath = "") =>
  path.join(process.cwd(), String(relativePath || ""));
const buildUniqueFilename = (
  originalname = "image",
  suffix = "",
  mimetype = "",
) =>
  `${sanitizeFilenameBase(originalname)}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${suffix}${getExtensionForMimeType(mimetype)}`;
const ensureLocalDirectory = async (relativePath) => {
  const absolutePath = buildAbsolutePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), {
    recursive: true,
  });
  return absolutePath;
};
const toBuffer = async (pipeline, mimetype = "") => {
  if (String(mimetype).toLowerCase() === "image/png") {
    return pipeline
      .png({
        compressionLevel: 9,
      })
      .toBuffer();
  }
  return pipeline
    .jpeg({
      quality: 84,
      mozjpeg: true,
    })
    .toBuffer();
};
const writeLocalImage = async ({ buffer, folder, variant, filename }) => {
  const relativePath = buildRelativePath(folder, variant, filename);
  const absolutePath = await ensureLocalDirectory(relativePath);
  await fs.writeFile(absolutePath, buffer);
  return relativePath;
};
const createThumbnailBuffer = async ({ buffer, mimetype }) =>
  toBuffer(
    sharp(buffer).rotate().resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: "cover",
      position: "centre",
    }),
    mimetype,
  );
const createOriginalBuffer = async ({ buffer, mimetype }) =>
  toBuffer(sharp(buffer).rotate(), mimetype);
const buildThumbnailOriginalName = (originalname = "image") => {
  const extension = path.extname(originalname || "");
  const basename = path.basename(originalname || "image", extension);
  return `${basename}-thumbnail${extension || getExtensionForMimeType("image/jpeg")}`;
};
const deleteLocalFile = async (relativePath) => {
  if (!relativePath || !String(relativePath).startsWith("uploads/")) {
    return;
  }
  try {
    await fs.unlink(buildAbsolutePath(relativePath));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};
const saveImageVariants = async ({
  buffer,
  originalname = "image",
  mimetype = "image/jpeg",
  folder = "images",
}) => {
  if (!buffer) {
    throw new Error("Missing file buffer for upload");
  }
  const normalizedFolder = normalizeFolder(folder) || "images";
  const [originalBuffer, thumbnailBuffer] = await Promise.all([
    createOriginalBuffer({
      buffer,
      mimetype,
    }),
    createThumbnailBuffer({
      buffer,
      mimetype,
    }),
  ]);
  if (isCloudinaryConfigured) {
    const [imageUpload, thumbnailUpload] = await Promise.all([
      uploadBuffer({
        buffer: originalBuffer,
        originalname,
        mimetype,
        folder: `${normalizedFolder}/originals`,
        resourceType: "image",
      }),
      uploadBuffer({
        buffer: thumbnailBuffer,
        originalname: buildThumbnailOriginalName(originalname),
        mimetype,
        folder: `${normalizedFolder}/thumbnails`,
        resourceType: "image",
      }),
    ]);
    return {
      image: imageUpload.url,
      thumbnail: thumbnailUpload.url,
      imagePublicId: imageUpload.publicId,
      thumbnailPublicId: thumbnailUpload.publicId,
      provider: "cloudinary",
    };
  }
  const originalFileName = buildUniqueFilename(originalname, "", mimetype);
  const thumbnailFileName = buildUniqueFilename(
    originalname,
    "-thumb",
    mimetype,
  );
  const [image, thumbnail] = await Promise.all([
    writeLocalImage({
      buffer: originalBuffer,
      folder: normalizedFolder,
      variant: "originals",
      filename: originalFileName,
    }),
    writeLocalImage({
      buffer: thumbnailBuffer,
      folder: normalizedFolder,
      variant: "thumbnails",
      filename: thumbnailFileName,
    }),
  ]);
  return {
    image,
    thumbnail,
    imagePublicId: image,
    thumbnailPublicId: thumbnail,
    provider: "local",
  };
};
const deleteImageVariants = async ({
  image = null,
  thumbnail = null,
  imagePublicId = null,
  thumbnailPublicId = null,
  provider = null,
}) => {
  const shouldDeleteRemote =
    provider === "cloudinary" ||
    (imagePublicId && !String(imagePublicId).startsWith("uploads/")) ||
    (thumbnailPublicId && !String(thumbnailPublicId).startsWith("uploads/"));
  if (shouldDeleteRemote) {
    await Promise.allSettled([
      imagePublicId ? deleteAsset(imagePublicId, "image") : null,
      thumbnailPublicId ? deleteAsset(thumbnailPublicId, "image") : null,
    ]);
  }
  await Promise.allSettled([
    deleteLocalFile(imagePublicId || image),
    deleteLocalFile(thumbnailPublicId || thumbnail),
  ]);
};
const isRemoteAsset = (value = "") => /^https?:\/\//i.test(String(value || ""));
const isLocalAsset = (value = "") => String(value || "").startsWith("uploads/");
const getStoredAssetReference = (
  record = {},
  {
    variant = "image",
    originalField = "image",
    thumbnailField = "thumbnail",
  } = {},
) => {
  const originalValue = record?.[originalField] || null;
  const thumbnailValue = record?.[thumbnailField] || null;
  if (variant === "thumbnail") {
    return thumbnailValue || originalValue || null;
  }
  return originalValue || thumbnailValue || null;
};
const serveStoredAsset = async (res, storedReference, options = {}) => {
  if (!storedReference) {
    return res.status(404).send("Image not found");
  }
  if (isRemoteAsset(storedReference)) {
    const response = await fetch(storedReference);
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
  }
  if (isLocalAsset(storedReference)) {
    const absolutePath = buildAbsolutePath(storedReference);
    const fileBuffer = await fs.readFile(absolutePath);
    const extension = path.extname(storedReference || "").toLowerCase();
    const contentType =
      options.contentType ||
      (extension === ".png" ? "image/png" : "image/jpeg");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (options.disposition) {
      res.setHeader("Content-Disposition", options.disposition);
    }
    return res.send(fileBuffer);
  }
  return res.status(404).send("Image not found");
};
module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
  THUMBNAIL_SIZE,
  buildAbsolutePath,
  deleteImageVariants,
  getStoredAssetReference,
  isLocalAsset,
  isRemoteAsset,
  saveImageVariants,
  serveStoredAsset,
};
