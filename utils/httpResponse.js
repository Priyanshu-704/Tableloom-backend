const isDevelopment = process.env.NODE_ENV === "development";

const sanitizeErrorValue = (error) => {
  if (!error || !isDevelopment) {
    return undefined;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const sendSuccess = (res, statusCode, message, data = null, extra = {}) => {
  const payload = {
    success: true,
    ...(message ? { message } : {}),
    ...(data !== null ? { data } : {}),
    ...extra,
  };

  return res.status(statusCode).json(payload);
};

const sendError = (res, statusCode, message, error = undefined, extra = {}) => {
  const payload = {
    success: false,
    message,
    ...(sanitizeErrorValue(error) ? { error: sanitizeErrorValue(error) } : {}),
    ...extra,
  };

  return res.status(statusCode).json(payload);
};

const sendPaginated = (
  res,
  statusCode,
  data = [],
  pagination = {},
  message = null,
  extra = {}
) =>
  sendSuccess(res, statusCode, message, data, {
    pagination,
    ...extra,
  });

const pickFields = (source = {}, fields = []) =>
  fields.reduce((accumulator, field) => {
    if (source?.[field] !== undefined) {
      accumulator[field] = source[field];
    }
    return accumulator;
  }, {});

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated,
  pickFields,
};
