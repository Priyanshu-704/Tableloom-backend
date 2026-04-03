const { logger } = require("./../utils/logger.js");
const feedbackManager = require('../utils/feedbackManager');
const Feedback = require('../models/Feedback');


exports.submitFeedback = async (req, res) => {
  try {
    
    const result = await feedbackManager.submitFeedback(req.body);

    res.status(201).json({
      success: true,
      message: result.message || 'Thank you for your feedback!',
      data: result.data
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
      data: feedback
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
  try {
    const { sessionId, id } = req.params;

    const feedback = await Feedback.findOne({ _id: id, sessionId });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found for this session",
      });
    }

    if (["resolved", "archived"].includes(feedback.status)) {
      return res.status(400).json({
        success: false,
        message: "Resolved feedback cannot be edited",
      });
    }

    const nextRatings = req.body.ratings || {};
    feedback.ratings = {
      ...feedback.ratings,
      ...nextRatings,
    };
    feedback.comments =
      req.body.comments !== undefined ? req.body.comments : feedback.comments;
    feedback.categories = Array.isArray(req.body.categories)
      ? req.body.categories
      : feedback.categories;
    feedback.highlights = Array.isArray(req.body.highlights)
      ? req.body.highlights
      : feedback.highlights;
    feedback.issues = Array.isArray(req.body.issues)
      ? req.body.issues
      : feedback.issues;
    feedback.wouldRecommend =
      req.body.wouldRecommend !== undefined
        ? req.body.wouldRecommend
        : feedback.wouldRecommend;
    feedback.visitPurpose = req.body.visitPurpose || feedback.visitPurpose;
    feedback.waitTime =
      req.body.waitTime !== undefined ? req.body.waitTime : feedback.waitTime;

    await feedback.save();

    return res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      data: feedback,
    });
  } catch (error) {
    logger.error("Update session feedback failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update feedback",
      error: error.message,
    });
  }
};

exports.deleteSessionFeedback = async (req, res) => {
  try {
    const { sessionId, id } = req.params;

    const feedback = await Feedback.findOneAndDelete({ _id: id, sessionId });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found for this session",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    logger.error("Delete session feedback failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete feedback",
      error: error.message,
    });
  }
};

exports.getFeedbackBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const feedback = await feedbackManager.getFeedbackBySession(sessionId);

   res.status(200).json({
      success: true,
      count: feedback.length,
      data: feedback
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
      data: paginatedFeedback
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
    const { period = '30days' } = req.query;

    const stats = await feedbackManager.getFeedbackStatistics(period);

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
      data: feedback
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
      data: feedback
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
    const { period = '30days' } = req.query;

    const nps = await feedbackManager.getNPS(period);

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
      data: {
        recentFeedback,
        statistics,
        nps,
        trendingTopics
      }
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
