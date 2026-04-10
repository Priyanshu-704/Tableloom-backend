const mongoose = require('mongoose');
const tenantScoped = require("../plugins/tenantScoped");
const kitchenOrderSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  tableNumber: {
    type: String,
    required: true
  },
  customerName: {
    type: String
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'rush', 'vip'],
    default: 'normal'
  },
  orderType: {
    type: String,
    enum: ['dine-in', 'takeaway', 'delivery'],
    default: 'dine-in'
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    menuItemName: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    specialInstructions: String,
    station: {
      type: mongoose.Schema.ObjectId,
      ref: 'KitchenStation'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'pending'
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    stationName: String,
    startTime: Date,
    readyTime: Date,
    timer: Number,
    preparationTime: {
      type: Number,
      min: 1
    },
    estimatedCompletion: Date,
    allergens: [String],
    modifications: [String],
    colorCode: String,
    delayStatus: {
      type: String,
      default: "on_time"
    },
    delayColor: String,
    delayMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    lastDelayCheck: Date
  }],
  overallStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'ready', 'completed', 'cancelled'],
    default: 'pending'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  stationAssignments: [{
    station: {
      type: mongoose.Schema.ObjectId,
      ref: 'KitchenStation'
    },
    items: [{
      type: mongoose.Schema.ObjectId
    }],
    status: String
  }],
  timers: {
    orderReceived: {
      type: Date,
      default: Date.now
    },
    kitchenAccepted: Date,
    startedCooking: Date,
    completedCooking: Date,
    served: Date
  },
  timeMetrics: {
    acceptTime: Number,
    preparationTime: Number,
    totalTime: Number
  },
  notes: {
    type: String,
    maxlength: 500
  },
  isUrgent: {
    type: Boolean,
    default: false
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
kitchenOrderSchema.plugin(tenantScoped);
kitchenOrderSchema.pre('save', function () {
  this.updatedAt = Date.now();
  if (this.items && this.items.length > 0) {
    const completedItems = this.items.filter(item => ['ready', 'served'].includes(item.status)).length;
    this.progress = Math.round(completedItems / this.items.length * 100);
  }
  if (this.items && this.items.length > 0) {
    if (this.items.every(item => item.status === 'served')) {
      this.overallStatus = 'completed';
    } else if (this.items.some(item => item.status === 'ready')) {
      this.overallStatus = 'ready';
    } else if (this.items.some(item => ['accepted', 'preparing'].includes(item.status))) {
      this.overallStatus = 'in_progress';
    }
  }
});
kitchenOrderSchema.index({
  order: 1
});
kitchenOrderSchema.index({
  overallStatus: 1
});
kitchenOrderSchema.index({
  priority: 1,
  createdAt: 1
});
kitchenOrderSchema.index({
  'items.status': 1
});
kitchenOrderSchema.index({
  createdAt: -1
});
module.exports = mongoose.model('KitchenOrder', kitchenOrderSchema);
