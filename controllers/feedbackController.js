const { logger } = require("./../utils/logger.js");
const Feedback = require("../models/Feedback");
const feedbackManager = require('../utils/feedbackManager');

const shapeFeedbackCustomer = (customer = null) =>
  customer
    ? {
        _id: customer._id,
        name: customer.name || "",
      }
    : null;

const shapeFeedbackOrder = (order = null) =>
  order
    ? {
        _id: order._id,
        orderNumber: order.orderNumber || "",
      }
    : null;

const shapeFeedbackTable = (table = null) =>
  table
    ? {
        _id: table._id,
        tableNumber: table.tableNumber || null,
      }
    : null;

const shapeFeedbackEntry = (feedback = {}) => {
  const tags = [
    ...(Array.isArray(feedback?.categories) ? feedback.categories : []),
    ...(Array.isArray(feedback?.highlights) ? feedback.highlights : []),
    ...(Array.isArray(feedback?.issues) ? feedback.issues : []),
  ].filter(Boolean);

  return {
    _id: feedback?._id,
    ratings: feedback?.ratings || {},
    comments: feedback?.comments || "",
    categories: Array.isArray(feedback?.categories) ? feedback.categories : [],
    tags,
    sentiment: feedback?.sentiment || "neutral",
    status: feedback?.status || "new",
    priority: feedback?.priority || "medium",
    followUpRequired: Boolean(feedback?.followUpRequired),
    customer: shapeFeedbackCustomer(feedback?.customer),
    order: shapeFeedbackOrder(feedback?.order),
    table: shapeFeedbackTable(feedback?.table),
    createdAt: feedback?.createdAt || null,
  };
};

const shapeFeedbackDashboard = (dashboard = {}) => ({
  statistics: dashboard?.statistics || {},
  nps: dashboard?.nps || {},
  trendingTopics: Array.isArray(dashboard?.trendingTopics)
    ? dashboard.trendingTopics.map((entry, index) => ({
        _id: entry?._id || entry?.topic || `topic-${index}`,
      }))
    : [],
  recentFeedback: Array.isArray(dashboard?.recentFeedback)
    ? dashboard.recentFeedback.map((entry) => ({
        _id: entry?._id,
      }))
    : [],
});


exports.submitFeedback = async (req, res) => {
  try {
    
    const result = await feedbackManager.submitFeedback(req.body);

    res.status(201).json({
      success: true,
      message: result.message || 'Thank you for your feedback!',
      data: shapeFeedbackEntry(result.data)
    });
  } catch (error) {
    logger.error(error);

    if (error.message.includes('Customer session not found') ||
        error.message.includes('No order found') ||
        error.message.includes('Feedback already submitted')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};


exports.getCustomerDetailsForFeedback = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const customerDetails = await feedbackManager.getCustomerDetailsForFeedback(sessionId);
    
    if (!customerDetails) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }
    
   res.status(200).json({
      success: true,
      data: customerDetails
    });
    
  } catch (error) {
    logger.error('Get customer details failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.canSubmitFeedback = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const result = await feedbackManager.canSubmitFeedback(sessionId);
    
   res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Check feedback submission failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.getFeedbackForActiveSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const feedback = await feedbackManager.getFeedbackForActiveSession(sessionId);
    
    if (!feedback) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No feedback found for this session'
      });
    }
    
   res.status(200).json({
      success: true,
      data: feedback ? shapeFeedbackEntry(feedback) : null
    });
    
  } catch (error) {
    logger.error('Get feedback for active session failed:', error);
    
    if (error.message.includes('Active customer session not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateSessionFeedback = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Submitted feedback cannot be edited",
  });
};

exports.deleteSessionFeedback = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Submitted feedback cannot be deleted",
  });
};

exports.getFeedbackBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const feedback = await feedbackManager.getFeedbackBySession(sessionId);

   res.status(200).json({
      success: true,
      count: feedback.length,
      data: feedback.map((entry) => shapeFeedbackEntry(entry))
    });
  } catch (error) {
    logger.error(error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback',
      error: error.message
    });
  }
};


exports.getAllFeedback = async (req, res) => {
  try {
    const { 
      status, 
      sentiment, 
      priority,
      startDate, 
      endDate,
      hasResponse,
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (sentiment) {
      query.sentiment = sentiment;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (hasResponse === 'true') {
      query.response = { $ne: null };
    } else if (hasResponse === 'false') {
      query.response = null;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let feedbackQuery = Feedback.find(query)
      .populate('customer', 'name email phone')
      .populate('order', 'orderNumber totalAmount orderPlacedAt')
      .populate('table', 'tableNumber')
      .populate('response.respondedBy', 'name role')
      .populate('staffMentions.staff', 'name role')
      .populate('menuItemRatings.menuItem', 'name category')
      .sort({ createdAt: -1 });

    if (!search) {
      feedbackQuery = feedbackQuery.skip(skip).limit(limitNum);
    }

    let feedback = await feedbackQuery;

    if (search) {
      const keyword = search.trim().toLowerCase();
      feedback = feedback.filter((entry) => {
        const topics = [
          ...(entry.categories || []),
          ...(entry.highlights || []),
          ...(entry.issues || []),
        ]
          .join(" ")
          .toLowerCase();

        return (
          String(entry.customer?.name || "").toLowerCase().includes(keyword) ||
          String(entry.comments || "").toLowerCase().includes(keyword) ||
          String(entry.order?.orderNumber || "").toLowerCase().includes(keyword) ||
          String(entry.table?.tableNumber || "").toLowerCase().includes(keyword) ||
          topics.includes(keyword)
        );
      });
    }

    const total = search ? feedback.length : await Feedback.countDocuments(query);
    const paginatedFeedback = search
      ? feedback.slice(skip, skip + limitNum)
      : feedback;

   res.status(200).json({
      success: true,
      count: paginatedFeedback.length,
      total,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      },
      data: paginatedFeedback.map((entry) => shapeFeedbackEntry(entry))
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback',
      error: error.message
    });
  }
};


exports.getFeedbackStatistics = async (req, res) => {
  try {
    const stats = await feedbackManager.getFeedbackStatistics(req.query || {});

   res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback statistics',
      error: error.message
    });
  }
};


exports.respondToFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Response message is required'
      });
    }

    const feedback = await feedbackManager.respondToFeedback(
      id, 
      { message }, 
      req.user.id
    );

   res.status(200).json({
      success: true,
      message: 'Response sent successfully',
      data: shapeFeedbackEntry(feedback)
    });
  } catch (error) {
    logger.error(error);
    
    if (error.message.includes('Feedback not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to respond to feedback',
      error: error.message
    });
  }
};


exports.updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, followUpRequired } = req.body;

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      {
        status,
        priority,
        followUpRequired
      },
      { new: true, runValidators: true }
    )
      .populate('customer', 'name email phone')
      .populate('order', 'orderNumber')
      .populate('response.respondedBy', 'name role');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

   res.status(200).json({
      success: true,
      message: 'Feedback status updated successfully',
      data: shapeFeedbackEntry(feedback)
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback status',
      error: error.message
    });
  }
};


exports.getTrendingTopics = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topics = await feedbackManager.getTrendingTopics(parseInt(limit));

   res.status(200).json({
      success: true,
      data: topics
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending topics',
      error: error.message
    });
  }
};


exports.getStaffPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const performance = await feedbackManager.getStaffPerformance(startDate, endDate);

   res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to get staff performance',
      error: error.message
    });
  }
};

exports.getNPS = async (req, res) => {
  try {
    const nps = await feedbackManager.getNPS(req.query || {});

   res.status(200).json({
      success: true,
      data: nps
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to get NPS',
      error: error.message
    });
  }
};


exports.getFeedbackDashboard = async (req, res) => {
  try {
    const [
      recentFeedback,
      statistics,
      nps,
      trendingTopics
    ] = await Promise.all([
      
      Feedback.find()
        .populate('customer', 'name email phone')
        .populate('order', 'orderNumber')
        .populate('table', 'tableNumber')
        .sort({ createdAt: -1 })
        .limit(10),
     
      feedbackManager.getFeedbackStatistics('30days'),
     
      feedbackManager.getNPS('30days'),
  
      feedbackManager.getTrendingTopics(5)
    ]);

   res.status(200).json({
      success: true,
      data: shapeFeedbackDashboard({
        recentFeedback,
        statistics,
        nps,
        trendingTopics
      })
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback dashboard',
      error: error.message
    });
  }
};
