const { logger } = require("./../utils/logger.js");
const notificationManager = require("../utils/notificationManager");
const { sendSuccess, sendError } = require("../utils/httpResponse");

const parsePagination = (page, limit) => {
  const pageNum = Math.max(parseInt(page || 1, 10), 1);
  const limitNum = Math.min(Math.max(parseInt(limit || 20, 10), 1), 100);
  const skip = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, skip };
};

const handleNotificationError = (res, error, fallbackMessage) => {
  logger.error(fallbackMessage, error);

  if (error.message.includes("not found")) {
    return sendError(res, 404, "Notification not found");
  }

  if (error.message.includes("User not found")) {
    return sendError(res, 404, "User not found");
  }

  return sendError(
    res,
    500,
    fallbackMessage,
    process.env.NODE_ENV === "development" ? error.message : undefined
  );
};

exports.getNotifications = async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      search,
      limit = 20,
      page = 1,
      unreadOnly,
      actionRequired,
    } = req.query;
    const { pageNum, limitNum, skip } = parsePagination(page, limit);

    const result = await notificationManager.getUserNotifications(req.user.id, {
      status,
      type,
      priority,
      search,
      limit: limitNum,
      skip,
      unreadOnly: unreadOnly === "true",
      actionRequired: actionRequired === "true",
    });

    return sendSuccess(res, 200, null, result.notifications, {
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: Math.ceil(result.total / limitNum),
      },
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    return handleNotificationError(res, error, "Failed to get notifications");
  }
};

exports.getSessionNotifications = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 20, page = 1, search, unreadOnly } = req.query;
    const { pageNum, limitNum, skip } = parsePagination(page, limit);

    const result = await notificationManager.getSessionNotifications(sessionId, {
      limit: limitNum,
      skip,
      search,
      unreadOnly: unreadOnly === "true",
    });

    return sendSuccess(res, 200, null, result.notifications, {
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: Math.ceil(result.total / limitNum),
      },
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    return handleNotificationError(res, error, "Failed to get notifications");
  }
};

exports.getNotificationStats = async (req, res) => {
  try {
    const { period = "today" } = req.query;
    const stats = await notificationManager.getNotificationStats(req.user.id, period);
    return sendSuccess(res, 200, null, stats);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to get notification statistics");
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await notificationManager.markAsRead(req.params.id, req.user.id);
    return sendSuccess(res, 200, "Notification marked as read", notification);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to mark notification as read");
  }
};

exports.markSessionAsRead = async (req, res) => {
  try {
    const notification = await notificationManager.markSessionNotificationAsRead(
      req.params.id,
      req.params.sessionId
    );
    return sendSuccess(res, 200, "Notification marked as read", notification);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to mark notification as read");
  }
};

exports.markAsAcknowledged = async (req, res) => {
  try {
    const notification = await notificationManager.markAsAcknowledged(req.params.id, req.user.id);
    return sendSuccess(res, 200, "Notification acknowledged", notification);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to acknowledge notification");
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const result = await notificationManager.markAllAsRead(req.user.id);
    return sendSuccess(res, 200, "All notifications marked as read", result);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to mark all notifications as read");
  }
};

exports.markAllSessionAsRead = async (req, res) => {
  try {
    const result = await notificationManager.markAllSessionNotificationsAsRead(
      req.params.sessionId
    );
    return sendSuccess(res, 200, "All notifications marked as read", result);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to mark all notifications as read");
  }
};

exports.dismissNotification = async (req, res) => {
  try {
    const notification = await notificationManager.dismissNotification(req.params.id, req.user.id);
    return sendSuccess(res, 200, "Notification dismissed", notification);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to dismiss notification");
  }
};

exports.clearAllNotifications = async (req, res) => {
  try {
    const result = await notificationManager.clearAllNotifications(req.user.id);
    return sendSuccess(res, 200, "Notifications cleared", result);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to clear notifications");
  }
};

exports.clearAllSessionNotifications = async (req, res) => {
  try {
    const result = await notificationManager.clearAllSessionNotifications(
      req.params.sessionId
    );
    return sendSuccess(res, 200, "Notifications cleared", result);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to clear notifications");
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority, type, expiresAt, important } = req.body;

    if (!title || !message) {
      return sendError(res, 400, "Title and message are required");
    }

    const notification = await notificationManager.createStaffAnnouncement(
      {
        title,
        message,
        priority: priority || "medium",
        type: type || "staff_announcement",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        important: Boolean(important),
      },
      req.user.id
    );

    return sendSuccess(res, 201, "Announcement sent successfully", notification);
  } catch (error) {
    return handleNotificationError(res, error, "Failed to create announcement");
  }
};

exports.cleanupNotifications = async (_req, res) => {
  try {
    const result = await notificationManager.cleanupExpiredNotifications();
    return sendSuccess(
      res,
      200,
      `Cleaned up ${result.deletedCount} expired notifications`,
      result
    );
  } catch (error) {
    return handleNotificationError(res, error, "Failed to cleanup notifications");
  }
};
