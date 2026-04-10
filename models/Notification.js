const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");
const notificationActionSchema = new mongoose.Schema({
  label: {
    type: String,
    trim: true,
    default: ""
  },
  type: {
    type: String,
    trim: true,
    default: "button"
  },
  action: {
    type: String,
    trim: true,
    default: ""
  },
  color: {
    type: String,
    trim: true,
    default: "secondary"
  }
}, {
  _id: false
});
const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ["waiter_call", "order_ready", "order_delayed", "payment_request", "payment_received", "table_assigned", "customer_checkin", "customer_checkout", "inventory_low", "reservation_alert", "system_alert", "staff_announcement", "rating_received", "shift_change", "task_assigned"],
    required: true
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium"
  },
  recipientType: {
    type: String,
    enum: ["user", "role", "table", "station", "all"],
    required: true
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: "recipientType"
  }],
  roles: [{
    type: String,
    enum: ["super_admin", "admin", "manager", "chef", "waiter", "cashier", "customer"]
  }],
  customerSessionId: {
    type: String,
    index: true,
    trim: true,
    default: null
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  senderType: {
    type: String,
    enum: ["system", "user", "customer", "kitchen"],
    default: "system"
  },
  relatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "relatedModel"
  },
  relatedModel: {
    type: String,
    enum: ["Order", "WaiterCall", "Table", "Customer", "Reservation", "Bill", "KitchenOrder", "Inventory"]
  },
  actionRequired: {
    type: Boolean,
    default: false
  },
  actions: {
    type: [notificationActionSchema],
    default: []
  },
  status: {
    type: String,
    enum: ["unread", "read", "acknowledged", "dismissed", "action_taken"],
    default: "unread"
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  acknowledgedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now
    }
  }],
  hiddenFor: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    hiddenAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBySessions: [{
    sessionId: {
      type: String,
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  hiddenForSessions: [{
    sessionId: {
      type: String,
      required: true
    },
    hiddenAt: {
      type: Date,
      default: Date.now
    }
  }],
  expiresAt: {
    type: Date,
    index: {
      expires: "7d"
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true
  },
  toObject: {
    virtuals: true
  }
});
notificationSchema.plugin(tenantScoped);
notificationSchema.index({
  recipients: 1,
  status: 1,
  createdAt: -1
});
notificationSchema.index({
  type: 1,
  createdAt: -1
});
notificationSchema.index({
  relatedTo: 1,
  relatedModel: 1
});
notificationSchema.index({
  "readBy.user": 1
});
notificationSchema.index({
  "hiddenFor.user": 1
});
notificationSchema.index({
  customerSessionId: 1,
  createdAt: -1
});
notificationSchema.index({
  "readBySessions.sessionId": 1
});
notificationSchema.index({
  "hiddenForSessions.sessionId": 1
});
notificationSchema.virtual("unreadCount").get(function () {
  return this.readBy.length === 0;
});
notificationSchema.pre("save", function () {
  this.updatedAt = Date.now();
  if (!this.expiresAt) {
    const expiryDays = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 7
    };
    this.expiresAt = new Date(Date.now() + expiryDays[this.priority] * 24 * 60 * 60 * 1000);
  }
});
notificationSchema.statics.markAsRead = async function (notificationId, userId) {
  return this.findByIdAndUpdate(notificationId, {
    $addToSet: {
      readBy: {
        user: userId,
        readAt: Date.now()
      }
    },
    $set: {
      status: "read"
    }
  }, {
    new: true
  });
};
notificationSchema.statics.markAsAcknowledged = async function (notificationId, userId) {
  return this.findByIdAndUpdate(notificationId, {
    $addToSet: {
      acknowledgedBy: {
        user: userId,
        acknowledgedAt: Date.now()
      }
    },
    $set: {
      status: "acknowledged"
    }
  }, {
    new: true
  });
};
module.exports = mongoose.model("Notification", notificationSchema);
