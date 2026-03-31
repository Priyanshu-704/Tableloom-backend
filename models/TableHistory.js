const mongoose = require('mongoose');
const tenantScoped = require("../plugins/tenantScoped");

const tableHistorySchema = new mongoose.Schema({
  table: {
    type: mongoose.Schema.ObjectId,
    ref: 'Table',
    required: true
  },
  order: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Customer'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

tableHistorySchema.plugin(tenantScoped);

module.exports = mongoose.model('TableHistory', tableHistorySchema);
