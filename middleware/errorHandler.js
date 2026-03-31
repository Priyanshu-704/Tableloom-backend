const { logger } = require("./../utils/logger.js");
const AppError = require("../utils/appError");
const { sendError } = require("../utils/httpResponse");

const isProduction = process.env.NODE_ENV === "production";

const formatFieldName = (field = "") =>
  String(field)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const buildDuplicateKeyMessage = (error) => {
  const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];

  if (!duplicateField) {
    return "A record with the same value already exists.";
  }

  return `${formatFieldName(duplicateField)} already exists. Please use a different value.`;
};

const normalizeError = (error) => {
  if (!error) {
    return new AppError("Something went wrong. Please try again.", 500);
  }

  if (error instanceof AppError) {
    return error;
  }

  if (error.type === "entity.parse.failed" || error instanceof SyntaxError) {
    return new AppError("Invalid JSON in request body. Please check the request format.", 400);
  }

  if (error.name === "ValidationError") {
    const validationMessages = Object.values(error.errors || {}).map(
      (fieldError) => fieldError.message
    );

    return new AppError(
      validationMessages[0] || "Validation failed. Please check the submitted data.",
      400,
      { details: validationMessages }
    );
  }

  if (error.name === "CastError") {
    return new AppError(
      `${formatFieldName(error.path)} is invalid. Please provide a valid value.`,
      400
    );
  }

  if (error.code === 11000) {
    return new AppError(buildDuplicateKeyMessage(error), 409);
  }

  if (error.name === "JsonWebTokenError") {
    return new AppError("Your session is invalid. Please log in again.", 401);
  }

  if (error.name === "TokenExpiredError") {
    return new AppError("Your session has expired. Please log in again.", 401);
  }

  if (error.message === "CORS not allowed") {
    return new AppError(
      "This origin is not allowed to access the API. Please contact the administrator.",
      403
    );
  }

  if (typeof error.statusCode === "number") {
    return new AppError(
      error.message || "Request failed. Please try again.",
      error.statusCode,
      {
        code: error.code,
        details: error.details,
      }
    );
  }

  return new AppError(
    error.message || "Something went wrong. Please try again.",
    500
  );
};

const notFoundHandler = (req, _res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404
    )
  );
};

const errorHandler = (error, _req, res, _next) => {
  const normalizedError = normalizeError(error);
  const statusCode = normalizedError.statusCode || 500;
  const details = normalizedError.details;

  if (statusCode >= 500) {
    logger.error("Unhandled API error:", error);
  }

  return sendError(
    res,
    statusCode,
    normalizedError.message,
    !isProduction && statusCode >= 500 ? error.message : undefined,
    {
      statusCode,
      ...(details ? { details } : {}),
      ...(normalizedError.code ? { code: normalizedError.code } : {}),
    }
  );
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
  normalizeError,
};
