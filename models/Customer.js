const mongoose = require('mongoose');
const tenantScoped = require("../plugins/tenantScoped");

const customerSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  table: {
    type: mongoose.Schema.ObjectId,
    ref: 'Table',
    required: true,
    index: true
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number'],
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ],
    index: true
  },
  sessionStatus: {
    type: String,
    enum: ['active', 'payment_pending', 'completed', 'cancelled', 'timeout', 'payment_processing'],
    default: 'active'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'upi', 'wallet', 'pending', null],
    default: null
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', null],
    default: null
  },
  paymentReference: {
    type: String,
    trim: true
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  currentOrder: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    default: null
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  sessionStart: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionEnd: {
    type: Date,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastBillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  lastBillNumber: String,
  lastBillAmount: Number,
  billGenerated: {
    type: Boolean,
    default: false
  },
  billGeneratedAt: Date,
  billSentToEmail: Boolean,
  billEmailSentAt: Date,
  retainSessionData: {
    type: Boolean,
    default: true  
  },
  retainUntil: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
  },
  isAccessibleForBilling: {
    type: Boolean,
    default: true  
  },
  closedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  closedByName: String,
  closedByRole: String,
  cancelledBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  cancelledByName: String,
  cancelledByRole: String,
  cancellationReason: String,
  cancelledAt: Date,
  cancellationMetadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  activityCount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

customerSchema.plugin(tenantScoped);
customerSchema.index({ tenantId: 1, sessionStart: -1, isActive: 1, sessionStatus: 1 });
customerSchema.index({ tenantId: 1, sessionEnd: -1, sessionStatus: 1, isActive: 1 });
customerSchema.pre('save', function() {
  this.updatedAt = Date.now();
});


customerSchema.pre('save', function() {

  if (this.isActive && this.sessionStatus === 'active') {
    this.lastActivity = new Date();
  }
});

customerSchema.virtual('sessionDuration').get(function() {
  if (!this.sessionEnd) return null;
  return Math.round((this.sessionEnd - this.sessionStart) / 60000); 
});

customerSchema.virtual('hasActiveBill').get(function() {
  return this.billGenerated && this.lastBillId && !this.billGeneratedAt;
});

customerSchema.virtual('isTimedOut').get(function() {
  if (!this.isActive || this.sessionStatus !== 'active') return false;
  
  const timeoutMinutes = 30;
  const timeoutTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  return this.lastActivity < timeoutTime;
});


customerSchema.virtual('isPaymentComplete').get(function() {
  return this.paymentStatus === 'paid' && this.sessionStatus === 'completed';
});

customerSchema.methods.canAccessForBilling = function() {
  const now = new Date();
  
  
  if (this.isActive && 
      (this.sessionStatus === 'active' || this.sessionStatus === 'payment_pending')) {
    return true;
  }
  

  if (this.sessionStatus === 'completed' && 
      this.retainSessionData && 
      this.retainUntil && 
      this.retainUntil > now) {
    return true;
  }

  if (this.isAccessibleForBilling) {
    return true;
  }
  
  return false;
};


customerSchema.methods.getBillingSummary = async function() {
  const Order = mongoose.model('Order');
  
  const orders = await Order.find({
    customer: this._id,
    paymentStatus: { $ne: 'paid' }
  });
  
  let subtotal = 0;
  let taxAmount = 0;
  let serviceCharge = 0;
  let discountAmount = 0;
  let totalAmount = 0;
  let itemCount = 0;
  
  orders.forEach(order => {
    subtotal += order.subtotal || 0;
    taxAmount += order.taxAmount || 0;
    serviceCharge += order.serviceCharge || 0;
    discountAmount += order.discountAmount || 0;
    totalAmount += order.totalAmount || 0;
    itemCount += order.items?.length || 0;
  });
  
  return {
    orderCount: orders.length,
    itemCount,
    subtotal,
    taxAmount,
    serviceCharge,
    discountAmount,
    totalAmount,
    canGenerateBill: orders.length > 0,
    hasPendingPayment: totalAmount > 0
  };
};


customerSchema.methods.markAsPaid = async function(paymentData) {
  this.sessionStatus = 'completed';
  this.sessionEnd = new Date();
  this.paymentMethod = paymentData.method || 'online';
  this.paymentStatus = 'paid';
  this.paymentReference = paymentData.transactionId;
  this.totalAmount = paymentData.amount || this.totalAmount;
  
  if (this.totalAmount) {
    this.totalSpent += this.totalAmount;
  }
  

  this.retainSessionData = true;
  this.retainUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
  this.isAccessibleForBilling = true;
  
  return this.save();
};

customerSchema.statics.findForBilling = function(sessionId) {
  return this.findOne({
    sessionId,
    $or: [
      { 
        isActive: true, 
        sessionStatus: { $in: ['active', 'payment_pending'] } 
      },
      { 
        retainSessionData: true,
        retainUntil: { $gt: new Date() }
      },
      {
        isAccessibleForBilling: true
      }
    ]
  });
};


customerSchema.statics.cleanupOldSessions = async function(days = 7) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.updateMany(
    {
      sessionStatus: 'completed',
      sessionEnd: { $lt: cutoffDate },
      retainSessionData: true
    },
    {
      $set: {
        retainSessionData: false,
        isAccessibleForBilling: false
      },
      $unset: {
        retainUntil: 1
      }
    }
  );
};

customerSchema.index({ sessionStatus: 1 });
customerSchema.index({ sessionStart: -1 });
customerSchema.index({ lastActivity: -1 });
customerSchema.index({ sessionEnd: -1 });
customerSchema.index({ paymentStatus: 1 });
customerSchema.index({ retainSessionData: 1 });
customerSchema.index({ retainUntil: 1 });
customerSchema.index({ isAccessibleForBilling: 1 });
customerSchema.index({ sessionStatus: 1, isActive: 1 });
customerSchema.index({ sessionId: 1, isActive: 1 });
customerSchema.index({ sessionId: 1, retainSessionData: 1 });
customerSchema.index({ sessionId: 1, isAccessibleForBilling: 1 });

module.exports = mongoose.model('Customer', customerSchema);
