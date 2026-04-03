const { logger } = require("./logger.js");
const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { getIO } = require('./socketManager');


exports.submitFeedback = async (feedbackData) => {
  try {
    const {
      sessionId,
      ratings,
      comments,
      categories = [],
      wouldRecommend,
      visitPurpose,
      waitTime,
      menuItemRatings = [],
      isAnonymous = false,
      source = 'qr_system'
    } = feedbackData;

    logger.info(`Submitting feedback for session: ${sessionId}`);

    const customer = await Customer.findOne({
      sessionId,
      $or: [
        { isActive: true, sessionStatus: { $in: ["active", "payment_pending"] } },
        { retainSessionData: true }
      ]
    });

    if (!customer) {
      throw new Error('Customer session not found or expired');
    }

    const order = await Order.findOne({
      customer: customer._id,
      // sessionId: sessionId
    })
      .populate('table')
      .sort({ createdAt: -1 }); 

    if (!order) {
      throw new Error('No order found for this session');
    }

    const existingFeedback = await Feedback.findOne({ 
      sessionId,
      customer: customer._id 
    });
    
    if (existingFeedback) {
      logger.info(`Feedback already exists for session: ${sessionId}`);
      
      existingFeedback.ratings = ratings;
      existingFeedback.comments = comments;
      existingFeedback.categories = categories;
      existingFeedback.wouldRecommend = wouldRecommend;
      existingFeedback.visitPurpose = visitPurpose;
      existingFeedback.waitTime = waitTime;
      existingFeedback.menuItemRatings = menuItemRatings;
      existingFeedback.isAnonymous = isAnonymous;
      existingFeedback.source = source;
      existingFeedback.updatedAt = new Date();
      
      await existingFeedback.save();
      
      await existingFeedback.populate('customer', 'name email phone');
      await existingFeedback.populate('order', 'orderNumber totalAmount');
      if (order.table) {
        await existingFeedback.populate('table', 'tableNumber');
      }
      
      return {
        success: true,
        message: 'Feedback updated successfully',
        isUpdated: true,
        data: existingFeedback
      };
    }


    const feedback = await Feedback.create({
      customer: customer._id,
      order: order._id,
      table: order.table?._id,
      sessionId,
      ratings,
      comments,
      categories,
      wouldRecommend,
      visitPurpose,
      waitTime,
      menuItemRatings,
      isAnonymous,
      source
    });

    logger.info(`Feedback created: ${feedback._id}`);


    await feedback.populate('customer', 'name email phone');
    await feedback.populate('order', 'orderNumber totalAmount');
    if (order.table) {
      await feedback.populate('table', 'tableNumber');
    }

    order.hasFeedback = true;
    await order.save();

   
    this.emitNewFeedback(feedback);

    return {
      success: true,
      message: 'Thank you for your feedback!',
      isUpdated: false,
      data: feedback
    };
  } catch (error) {
    logger.error('Submit feedback failed:', error);
    throw error;
  }
};


exports.getFeedbackBySession = async (sessionId) => {
  try {
    logger.info(`Getting feedback for session: ${sessionId}`);
 
    const customer = await Customer.findOne({
      sessionId,
      $or: [
        { isActive: true, sessionStatus: { $in: ["active", "payment_pending"] } },
        { retainSessionData: true }
      ]
    });
    
    if (!customer) {
      logger.info(`Customer not found for session: ${sessionId}`);

      const feedback = await Feedback.find({ sessionId })
        .populate('customer', 'name email phone')
        .populate('order', 'orderNumber orderPlacedAt totalAmount')
        .populate('table', 'tableNumber')
        .sort({ createdAt: -1 });
      
      return feedback;
    }


    const feedback = await Feedback.find({
      customer: customer._id,
      sessionId
    })
      .populate('customer', 'name email phone')
      .populate('order', 'orderNumber orderPlacedAt totalAmount')
      .populate('table', 'tableNumber')
      .sort({ createdAt: -1 });

    logger.info(`Found ${feedback.length} feedback entries for customer: ${customer._id}`);
    
    return feedback;
  } catch (error) {
    logger.error('Get feedback by session failed:', error);
    throw error;
  }
};


exports.getFeedbackForActiveSession = async (sessionId) => {
  try {
    logger.info(`Getting feedback for active session: ${sessionId}`);
    
    const customer = await Customer.findOne({
      sessionId,
      isActive: true,
      sessionStatus: { $in: ["active", "payment_pending"] }
    });

    if (!customer) {
      throw new Error('Active customer session not found');
    }


    const existingFeedback = await Feedback.findOne({
      sessionId,
      customer: customer._id
    })
      .populate('customer', 'name email phone')
      .populate('order', 'orderNumber totalAmount')
      .populate('table', 'tableNumber');

    return existingFeedback;
  } catch (error) {
    logger.error('Get feedback for active session failed:', error);
    throw error;
  }
};


exports.getCustomerDetailsForFeedback = async (sessionId) => {
  try {
    logger.info(`Getting customer details for feedback form - Session: ${sessionId}`);
    
    const customer = await Customer.findOne({
      sessionId,
      $or: [
        { isActive: true, sessionStatus: { $in: ["active", "payment_pending"] } },
        { retainSessionData: true }
      ]
    })
    .populate('table', 'tableNumber tableName')
    .populate('currentOrder', 'orderNumber totalAmount items');

    if (!customer) {
      logger.info(`Customer not found for session: ${sessionId}`);
      return null;
    }


    const orders = await Order.find({
      customer: customer._id,
      sessionId: sessionId
    })
    .populate('items.menuItem', 'name')
    .sort({ orderPlacedAt: -1 });

    return {
      customer: {
        id: customer._id,
        sessionId: customer.sessionId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      },
      table: customer.table,
      orders: orders,
      currentOrder: customer.currentOrder,
      canSubmitFeedback: customer.isActive && 
        (customer.sessionStatus === 'active' || customer.sessionStatus === 'payment_pending')
    };
  } catch (error) {
    logger.error('Get customer details for feedback failed:', error);
    throw error;
  }
};

exports.canSubmitFeedback = async (sessionId) => {
  try {
    const customer = await Customer.findOne({
      sessionId,
      $or: [
        { isActive: true, sessionStatus: { $in: ["active", "payment_pending"] } },
        { retainSessionData: true }
      ]
    });

    if (!customer) {
      return {
        canSubmit: false,
        reason: 'Session not found or expired'
      };
    }


    const existingFeedback = await Feedback.findOne({
      sessionId,
      customer: customer._id
    });

    if (existingFeedback) {
      return {
        canSubmit: false,
        reason: 'Feedback already submitted',
        existingFeedback: existingFeedback._id
      };
    }


    const orderCount = await Order.countDocuments({
      customer: customer._id,
      sessionId: sessionId
    });

    if (orderCount === 0) {
      return {
        canSubmit: false,
        reason: 'No orders found for this session'
      };
    }

    return {
      canSubmit: true,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email
      }
    };
  } catch (error) {
    logger.error('Check feedback submission failed:', error);
    return {
      canSubmit: false,
      reason: error.message
    };
  }
};

exports.getFeedbackStatistics = async (period = '30days') => {
  try {
    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case 'today':
        dateFilter = { createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) } };
        break;
      case '7days':
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
        break;
      case '30days':
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 30)) } };
        break;
      case '90days':
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 90)) } };
        break;
     
    }

    const stats = await Feedback.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalFeedback: { $sum: 1 },
          averageRating: { $avg: '$ratings.overall' },
          averageFoodRating: { $avg: '$ratings.food' },
          averageServiceRating: { $avg: '$ratings.service' },
          averageAmbianceRating: { $avg: '$ratings.ambiance' },
          positiveCount: {
            $sum: { $cond: [{ $gte: ['$ratings.overall', 4] }, 1, 0] }
          },
          neutralCount: {
            $sum: { $cond: [{ $eq: ['$ratings.overall', 3] }, 1, 0] }
          },
          negativeCount: {
            $sum: { $cond: [{ $lte: ['$ratings.overall', 2] }, 1, 0] }
          },
          recommendationRate: {
            $avg: { $cond: ['$wouldRecommend', 1, 0] }
          }
        }
      }
    ]);

    const categoryStats = await Feedback.aggregate([
      { $match: dateFilter },
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);


    const sentimentStats = await Feedback.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$sentiment',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = stats[0] || {
      totalFeedback: 0,
      averageRating: 0,
      averageFoodRating: 0,
      averageServiceRating: 0,
      averageAmbianceRating: 0,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      recommendationRate: 0
    };

    result.period = period;
    result.categoryDistribution = categoryStats;
    result.sentimentDistribution = sentimentStats;
    result.responseRate = await this.getResponseRate(dateFilter);

    return result;
  } catch (error) {
    logger.error('Get feedback statistics failed:', error);
    throw error;
  }
};


exports.getResponseRate = async (dateFilter) => {
  try {
    const responseStats = await Feedback.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          responded: {
            $sum: { $cond: [{ $ne: ['$response', null] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = responseStats[0] || { total: 0, responded: 0 };
    return stats.total > 0 ? (stats.responded / stats.total) * 100 : 0;
  } catch (error) {
    logger.error('Get response rate failed:', error);
    return 0;
  }
};


exports.respondToFeedback = async (feedbackId, responseData, staffId) => {
  try {
    const feedback = await Feedback.findById(feedbackId);
    
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    feedback.response = {
      message: responseData.message,
      respondedBy: staffId,
      respondedAt: new Date()
    };
    feedback.status = 'reviewed';

    await feedback.save();
    await feedback.populate('response.respondedBy', 'name role');

    this.emitFeedbackResponse(feedback);

    return feedback;
  } catch (error) {
    logger.error('Respond to feedback failed:', error);
    throw error;
  }
};


exports.getTrendingTopics = async (limit = 10) => {
  try {
    const topics = await Feedback.aggregate([
      { $match: { comments: { $exists: true, $ne: '' } } },
      { $project: { comments: 1 } },
      { $unwind: { path: '$comments', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          words: {
            $split: [
              { $toLower: { $trim: { input: '$comments' } } },
              ' '
            ]
          }
        }
      },
      { $unwind: '$words' },
      {
        $match: {
          words: {
            $not: { $regex: /^[0-9\W]+$/ }, 
            $nin: ['the', 'and', 'was', 'were', 'for', 'with', 'this', 'that', 'have', 'from']
          }
        }
      },
      {
        $group: {
          _id: '$words',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    return topics;
  } catch (error) {
    logger.error('Get trending topics failed:', error);
    throw error;
  }
};


exports.getStaffPerformance = async (startDate, endDate) => {
  try {
    const dateFilter = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      'staffMentions.0': { $exists: true } 
    };

    const performance = await Feedback.aggregate([
      { $match: dateFilter },
      { $unwind: '$staffMentions' },
      {
        $group: {
          _id: '$staffMentions.staff',
          totalMentions: { $sum: 1 },
          averageRating: { $avg: '$staffMentions.rating' },
          positiveMentions: {
            $sum: { $cond: [{ $gte: ['$staffMentions.rating', 4] }, 1, 0] }
          },
          comments: { $push: '$staffMentions.comment' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      { $unwind: '$staff' },
      {
        $project: {
          staffName: '$staff.name',
          staffRole: '$staff.role',
          totalMentions: 1,
          averageRating: { $round: ['$averageRating', 2] },
          positiveMentions: 1,
          positiveRate: {
            $round: [
              { $multiply: [{ $divide: ['$positiveMentions', '$totalMentions'] }, 100] },
              2
            ]
          },
          sampleComments: { $slice: ['$comments', 3] }
        }
      },
      { $sort: { averageRating: -1 } }
    ]);

    return performance;
  } catch (error) {
    logger.error('Get staff performance failed:', error);
    throw error;
  }
};


exports.getNPS = async (period = '30days') => {
  try {
    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case '7days':
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
        break;
      case '30days':
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 30)) } };
        break;
      case '90days':
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 90)) } };
        break;
    }

    const npsData = await Feedback.aggregate([
      { $match: { ...dateFilter, wouldRecommend: { $exists: true } } },
      {
        $group: {
          _id: null,
          promoters: {
            $sum: { $cond: ['$wouldRecommend', 1, 0] }
          },
          detractors: {
            $sum: { $cond: [{ $not: ['$wouldRecommend'] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      }
    ]);

    const data = npsData[0] || { promoters: 0, detractors: 0, total: 0 };
    const nps = data.total > 0 ? 
      ((data.promoters - data.detractors) / data.total) * 100 : 0;

    return {
      nps: Math.round(nps),
      promoters: data.promoters,
      detractors: data.detractors,
      passives: data.total - data.promoters - data.detractors,
      total: data.total,
      period
    };
  } catch (error) {
    logger.error('Get NPS failed:', error);
    throw error;
  }
};


exports.emitNewFeedback = (feedback) => {
  const io = getIO();
  io.to('management-room').emit('new_feedback_received', feedback);
};

exports.emitFeedbackResponse = (feedback) => {
  const io = getIO();
  io.to('management-room').emit('feedback_response_sent', feedback);
};
