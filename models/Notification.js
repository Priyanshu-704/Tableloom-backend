const mongoose = require("mongoose");
const tenantScoped = require("../plugins/tenantScoped");

const notificationActionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      trim: true,
      default: "button",
    },
    action: {
      type: String,
      trim: true,
      default: "",
    },
    color: {
      type: String,
      trim: true,
      default: "secondary",
    },
  },
  {
    _id: false,
  }
);

const notificationSchema = new mongoose.Schema(
  {
    // Basic info
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        "waiter_call", // Customer calls waiter
        "order_ready", // Kitchen items ready
        "order_delayed", // Order delay alert
        "payment_request", // Payment needed
        "payment_received", // Payment confirmed
        "table_assigned", // Table assigned to waiter
        "customer_checkin", // New customer check-in
        "customer_checkout", // Customer leaving
        "inventory_low", // Low stock alert
        "reservation_alert", // Upcoming reservation
        "system_alert", // System notifications
        "staff_announcement", // Staff announcements
        "rating_received", // Customer review
        "shift_change", // Shift notifications
        "task_assigned", // Task assignment
        
      ],
      required: true,
    },

    // Priority levels
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Recipient info
    recipientType: {
      type: String,
      enum: ["user", "role", "table", "station", "all"],
      required: true,
    },

    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "recipientType",
      },
    ],

    // For role-based notifications
    roles: [
      {
        type: String,
        enum: ["admin", "manager", "chef", "waiter", "cashier", "customer"],
      },
    ],

    customerSessionId: {
      type: String,
      index: true,
      trim: true,
      default: null,
    },

    // Sender info
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    senderType: {
      type: String,
      enum: ["system", "user", "customer", "kitchen"],
      default: "system",
    },

    // Related entities
    relatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedModel",
    },

    relatedModel: {
      type: String,
      enum: [
        "Order",
        "WaiterCall",
        "Table",
        "Customer",
        "Reservation",
        "Bill",
        "KitchenOrder",
        "Inventory",
      ],
    },

    // Action details
    actionRequired: {
      type: Boolean,
      default: false,
    },

    actions: {
      type: [notificationActionSchema],
      default: [],
    },

    // Status tracking
    status: {
      type: String,
      enum: ["unread", "read", "acknowledged", "dismissed", "action_taken"],
      default: "unread",
    },

    // Read tracking
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Acknowledgment tracking
    acknowledgedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        acknowledgedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    hiddenFor: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        hiddenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    readBySessions: [
      {
        sessionId: {
          type: String,
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    hiddenForSessions: [
      {
        sessionId: {
          type: String,
          required: true,
        },
        hiddenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Expiry
    expiresAt: {
      type: Date,
      index: { expires: "7d" }, // Auto-delete after 7 days
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.plugin(tenantScoped);

// Indexes for faster queries
notificationSchema.index({ recipients: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ relatedTo: 1, relatedModel: 1 });
notificationSchema.index({ "readBy.user": 1 });
notificationSchema.index({ "hiddenFor.user": 1 });
notificationSchema.index({ customerSessionId: 1, createdAt: -1 });
notificationSchema.index({ "readBySessions.sessionId": 1 });
notificationSchema.index({ "hiddenForSessions.sessionId": 1 });

// Virtual for unread count
notificationSchema.virtual("unreadCount").get(function () {
  return this.readBy.length === 0;
});

// Pre-save middleware
notificationSchema.pre("save", function () {
  this.updatedAt = Date.now();

  // Auto-set expiry if not set
  if (!this.expiresAt) {
    const expiryDays = {
      urgent: 1, // 1 day for urgent
      high: 2, // 2 days for high
      medium: 3, // 3 days for medium
      low: 7, // 7 days for low
    };
    this.expiresAt = new Date(
      Date.now() + expiryDays[this.priority] * 24 * 60 * 60 * 1000
    );
  }
});

// Static methods
notificationSchema.statics.markAsRead = async function (
  notificationId,
  userId
) {
  return this.findByIdAndUpdate(
    notificationId,
    {
      $addToSet: {
        readBy: { user: userId, readAt: Date.now() },
      },
      $set: { status: "read" },
    },
    { new: true }
  );
};

notificationSchema.statics.markAsAcknowledged = async function (
  notificationId,
  userId
) {
  return this.findByIdAndUpdate(
    notificationId,
    {
      $addToSet: {
        acknowledgedBy: { user: userId, acknowledgedAt: Date.now() },
      },
      $set: { status: "acknowledged" },
    },
    { new: true }
  );
};

module.exports = mongoose.model("Notification", notificationSchema);
