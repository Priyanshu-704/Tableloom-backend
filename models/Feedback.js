const mongoose = require('mongoose');
const tenantScoped = require("../plugins/tenantScoped");

const feedbackSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Customer',
    required: true 
  },
  order: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: true
  },
  table: {
    type: mongoose.Schema.ObjectId,
    ref: 'Table'
  },
  sessionId: {
    type: String,
    required: true
  },
  ratings: {
    overall: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    food: {
      type: Number,
      min: 1,
      max: 5
    },
    service: {
      type: Number,
      min: 1,
      max: 5
    },
    ambiance: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  comments: {
    type: String,
    maxlength: 1000
  },
  categories: [{
    type: String,
    enum: [
      'food_quality', 'service_speed', 'staff_friendliness', 
      'cleanliness', 'value_for_money', 'atmosphere',
      'menu_variety', 'waiting_time', 'order_accuracy'
    ]
  }],
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
  },
  highlights: [{
    type: String,
    maxlength: 100
  }],
  issues: [{
    type: String,
    maxlength: 100
  }],
  staffMentions: [{
    staff: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    comment: String,
    rating: Number
  }],
  menuItemRatings: [{
    menuItem: {
      type: mongoose.Schema.ObjectId,
      ref: 'MenuItem'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String
  }],
  wouldRecommend: {
    type: Boolean
  },
  visitPurpose: {
    type: String,
    enum: ['business', 'casual_dining', 'celebration', 'date', 'family', 'quick_meal']
  },
  waitTime: {
    type: Number // in minutes
  },
  response: {
    message: String,
    respondedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'action_required', 'resolved', 'archived'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  source: {
    type: String,
    enum: ['qr_system', 'email', 'website', 'social_media', 'phone'],
    default: 'qr_system'
  },
  metadata: {
    device: String,
    browser: String,
    ipAddress: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

feedbackSchema.plugin(tenantScoped);

// Update the updatedAt field before saving
feedbackSchema.pre('save', function() {
  this.updatedAt = Date.now();
  
  // Auto-detect sentiment based on ratings and comments
  if (this.isModified('ratings') || this.isModified('comments')) {
    this.detectSentiment();
  }
  
  // Auto-assign priority
  if (this.isModified('ratings') || this.isModified('comments')) {
    this.assignPriority();
  }
});

// Method to detect sentiment
feedbackSchema.methods.detectSentiment = function() {
  const overallRating = this.ratings.overall;
  
  if (overallRating >= 4) {
    this.sentiment = 'positive';
  } else if (overallRating <= 2) {
    this.sentiment = 'negative';
  } else {
    this.sentiment = 'neutral';
  }
  
  // Additional sentiment analysis based on comments
  if (this.comments) {
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'good', 'love', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'poor'];
    
    const comment = this.comments.toLowerCase();
    const positiveCount = positiveWords.filter(word => comment.includes(word)).length;
    const negativeCount = negativeWords.filter(word => comment.includes(word)).length;
    
    if (negativeCount > positiveCount) {
      this.sentiment = 'negative';
    } else if (positiveCount > negativeCount) {
      this.sentiment = 'positive';
    }
  }
};

// Method to assign priority
feedbackSchema.methods.assignPriority = function() {
  if (this.ratings.overall <= 2 || this.sentiment === 'negative') {
    this.priority = 'high';
    this.followUpRequired = true;
  } else if (this.ratings.overall === 3) {
    this.priority = 'medium';
  } else {
    this.priority = 'low';
  }
};

// Create indexes for better performance
feedbackSchema.index({ order: 1 });
feedbackSchema.index({ customer: 1 });
feedbackSchema.index({ sessionId: 1 });
feedbackSchema.index({ sentiment: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ priority: 1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ 'ratings.overall': 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
