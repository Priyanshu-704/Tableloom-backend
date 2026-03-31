const mongoose = require('mongoose');
const tenantScoped = require("../plugins/tenantScoped");

const waiterCallSchema = new mongoose.Schema({
  callId: {
    type: String,
    unique: true,
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Customer',
    required: true
  },
  table: {
    type: mongoose.Schema.ObjectId,
    ref: 'Table',
    required: true
  },
  tableNumber: {
    type: String,
    required: true
  },
  tableName: {
    type: String
  },
  location: {
    type: String
  },
  coordinates: {
    type: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'acknowledged', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  callType: {
    type: String,
    enum: ['waiter', 'bill', 'assistance', 'order_help', 'other', 'emergency', 'billing', 'order'],
    default: 'waiter'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent', 'critical'],
    default: 'medium'
  },
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  message: {
    type: String,
    maxlength: 200
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  assignedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  assignedAt: {
    type: Date
  },
  acknowledgedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  startedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  estimatedArrival: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  resolutionNotes: {
    type: String,
    maxlength: 1000
  },
  cancellationReason: {
    type: String,
    maxlength: 500
  },
  cancelledAt: {
    type: Date
  },
  staffName: {
    type: String
  },
  staffRole: {
    type: String
  },
  responseTime: {
    type: Number // in seconds
  },
  resolutionTime: {
    type: Number // in seconds
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

waiterCallSchema.plugin(tenantScoped);

// Update the updatedAt field before saving
waiterCallSchema.pre('save', function() {
  this.updatedAt = Date.now();
});   

// Generate call ID before validation so required check passes.
waiterCallSchema.pre('validate', function() {
  if (this.isNew && !this.callId) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.callId = `CALL-${timestamp}${random}`;
  }
});

// Create indexes for better performance
waiterCallSchema.index({ sessionId: 1 });
waiterCallSchema.index({ table: 1 });
waiterCallSchema.index({ status: 1 });
waiterCallSchema.index({ assignedTo: 1, status: 1 });
waiterCallSchema.index({ createdAt: -1 });
waiterCallSchema.index({ priority: 1, createdAt: 1 });

module.exports = mongoose.model('WaiterCall', waiterCallSchema);
