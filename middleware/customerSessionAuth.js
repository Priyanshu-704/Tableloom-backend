const Customer = require("../models/Customer");
const { AppError } = require("./errorHandler");
const {
  CUSTOMER_SESSION_COOKIE_NAME,
} = require("../utils/cookieOptions");
const {
  getTokenSessionId,
  verifyCustomerSessionToken,
} = require("../utils/authTokens");
const { normalizeTenantId } = require("../utils/tenantContext");

const resolveSessionIdFromRequest = (
  req,
  field = "sessionId",
  sources = ["params", "body", "query"],
) => {
  for (const source of sources) {
    const value = req?.[source]?.[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

const customerSessionIsAccessible = (customer) => {
  if (!customer) {
    return false;
  }

  const activeStatuses = new Set([
    "active",
    "payment_pending",
    "payment_processing",
  ]);

  if (customer.isActive && activeStatuses.has(customer.sessionStatus)) {
    return true;
  }
  return false;
};

const extractCustomerSessionToken = (req) => {
  if (req.cookies?.[CUSTOMER_SESSION_COOKIE_NAME]) {
    return req.cookies[CUSTOMER_SESSION_COOKIE_NAME];
  }

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Customer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  return "";
};

const hydrateCustomerSession = async (req, token) => {
  const decoded = verifyCustomerSessionToken(token);
  const tokenSessionId = getTokenSessionId(decoded);
  if (!tokenSessionId) {
    throw new AppError("Customer session is invalid. Please scan again.", 401);
  }

  const customer = await Customer.findOne({
    sessionId: tokenSessionId,
  }).populate("table", "tableNumber tableName capacity location status");

  if (!customer || !customerSessionIsAccessible(customer)) {
    throw new AppError("Customer session not found or expired.", 401);
  }

  const requestTenantId = normalizeTenantId(req.tenant);
  const customerTenantId = normalizeTenantId(customer.tenantId);
  if (requestTenantId && customerTenantId !== requestTenantId) {
    throw new AppError(
      "Customer session does not belong to this restaurant workspace.",
      403,
    );
  }

  req.customerSession = customer;
  req.customerSessionId = customer.sessionId;
  req.customerSessionToken = token;
};

const protectCustomerSession = ({
  field = "sessionId",
  sources = ["params", "body", "query"],
  optional = false,
} = {}) => {
  return async (req, _res, next) => {
    try {
      const token = extractCustomerSessionToken(req);
      if (!token) {
        if (optional) {
          return next();
        }

        return next(
          new AppError(
            "Customer session is required. Please scan the table again.",
            401,
          ),
        );
      }

      await hydrateCustomerSession(req, token);

      const requestedSessionId = resolveSessionIdFromRequest(req, field, sources);
      if (requestedSessionId && requestedSessionId !== req.customerSessionId) {
        return next(
          new AppError(
            "Customer session does not match the requested resource.",
            403,
          ),
        );
      }

      return next();
    } catch (error) {
      if (optional) {
        return next();
      }

      return next(error);
    }
  };
};

const optionalCustomerSession = (options = {}) =>
  protectCustomerSession({
    ...options,
    optional: true,
  });

module.exports = {
  optionalCustomerSession,
  protectCustomerSession,
};
