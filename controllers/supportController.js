const SupportRequest = require("../models/SupportRequest");
const { sendError, sendSuccess } = require("../utils/httpResponse");
const { normalizeTenantId } = require("../utils/tenantContext");

const shapeUser = (user = null) =>
  user
    ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    : null;

const shapeSupportRequest = (request = {}) => ({
  _id: request?._id,
  tenantId: request?.tenantId?._id || request?.tenantId || null,
  tenant:
    request?.tenantId && typeof request.tenantId === "object"
      ? {
          _id: request.tenantId._id,
          name: request.tenantId.name,
          slug: request.tenantId.slug,
          key: request.tenantId.key,
          status: request.tenantId.status,
        }
      : null,
  category: request?.category || "other",
  subject: request?.subject || "",
  message: request?.message || "",
  status: request?.status || "open",
  createdAt: request?.createdAt || null,
  updatedAt: request?.updatedAt || null,
  resolvedAt: request?.resolvedAt || null,
  responseMessage: request?.responseMessage || "",
  respondedAt: request?.respondedAt || null,
  createdBy: shapeUser(request?.createdBy),
  updatedBy: shapeUser(request?.updatedBy),
  respondedBy: shapeUser(request?.respondedBy),
});

exports.createSupportRequest = async (req, res) => {
  const tenantId = normalizeTenantId(req.tenant) || normalizeTenantId(req.user?.tenantId);
  const { category = "other", subject, message } = req.body || {};

  if (!tenantId) {
    return sendError(res, 400, "Tenant workspace is required to contact super admin");
  }

  if (!String(subject || "").trim()) {
    return sendError(res, 400, "Subject is required");
  }

  if (!String(message || "").trim()) {
    return sendError(res, 400, "Message is required");
  }

  const request = await SupportRequest.create({
    tenantId,
    category,
    subject: String(subject).trim(),
    message: String(message).trim(),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await request.populate([
    { path: "createdBy", select: "name email role" },
    { path: "updatedBy", select: "name email role" },
    { path: "respondedBy", select: "name email role" },
    { path: "tenantId", select: "name slug key status" },
  ]);

  return sendSuccess(
    res,
    201,
    "Support request sent to super admin successfully",
    shapeSupportRequest(request)
  );
};

exports.getSupportRequests = async (req, res) => {
  const { status = "all", tenantId: requestedTenantId } = req.query || {};
  const query = {};

  if (status !== "all") {
    query.status = status;
  }

  if (req.user?.role === "super_admin") {
    if (requestedTenantId) {
      query.tenantId = requestedTenantId;
    }
  } else {
    query.tenantId = normalizeTenantId(req.user?.tenantId);
  }

  const requests = await SupportRequest.find(query)
    .populate("tenantId", "name slug key status")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("respondedBy", "name email role")
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(
    res,
    200,
    null,
    requests.map((request) => shapeSupportRequest(request)),
    {
      count: requests.length,
    }
  );
};

exports.updateSupportRequestStatus = async (req, res) => {
  const { status, responseMessage } = req.body || {};
  const hasStatus = typeof status === "string" && String(status).trim().length > 0;
  const hasResponseMessageField = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "responseMessage"
  );

  const request = await SupportRequest.findById(req.params.id);

  if (!request) {
    return sendError(res, 404, "Support request not found");
  }

  if (hasStatus) {
    if (!["open", "in_progress", "resolved"].includes(String(status || ""))) {
      return sendError(res, 400, "Valid status is required");
    }
    request.status = status;
    request.resolvedAt = status === "resolved" ? new Date() : null;
  }

  if (hasResponseMessageField) {
    const normalizedResponse = String(responseMessage || "").trim();
    request.responseMessage = normalizedResponse;
    request.respondedAt = normalizedResponse ? new Date() : null;
    request.respondedBy = normalizedResponse ? req.user._id : null;
  }

  if (!hasStatus && !hasResponseMessageField) {
    return sendError(res, 400, "Status or response message is required");
  }

  request.updatedBy = req.user._id;
  await request.save();
  await request.populate([
    { path: "tenantId", select: "name slug key status" },
    { path: "createdBy", select: "name email role" },
    { path: "updatedBy", select: "name email role" },
    { path: "respondedBy", select: "name email role" },
  ]);

  return sendSuccess(
    res,
    200,
    hasResponseMessageField
      ? "Support request updated successfully"
      : `Support request marked as ${String(status).replace(/_/g, " ")}`,
    shapeSupportRequest(request)
  );
};
