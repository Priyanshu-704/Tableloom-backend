const SupportRequest = require("../models/SupportRequest");
const { sendError, sendSuccess } = require("../utils/httpResponse");
const { normalizeTenantId } = require("../utils/tenantContext");

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
  createdBy: request?.createdBy
    ? {
        _id: request.createdBy._id,
        name: request.createdBy.name,
        email: request.createdBy.email,
        role: request.createdBy.role,
      }
    : null,
  updatedBy: request?.updatedBy
    ? {
        _id: request.updatedBy._id,
        name: request.updatedBy.name,
        email: request.updatedBy.email,
        role: request.updatedBy.role,
      }
    : null,
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
  const { status } = req.body || {};

  if (!["open", "in_progress", "resolved"].includes(String(status || ""))) {
    return sendError(res, 400, "Valid status is required");
  }

  const request = await SupportRequest.findById(req.params.id);

  if (!request) {
    return sendError(res, 404, "Support request not found");
  }

  request.status = status;
  request.updatedBy = req.user._id;
  request.resolvedAt = status === "resolved" ? new Date() : null;
  await request.save();
  await request.populate([
    { path: "tenantId", select: "name slug key status" },
    { path: "createdBy", select: "name email role" },
    { path: "updatedBy", select: "name email role" },
  ]);

  return sendSuccess(
    res,
    200,
    `Support request marked as ${String(status).replace(/_/g, " ")}`,
    shapeSupportRequest(request)
  );
};
