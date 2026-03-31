module.exports = {
  orderStatusColors: {
    pending: '#9E9E9E',      // Grey
    confirmed: '#2196F3',    // Blue
    preparing: '#FF9800',    // Orange
    ready: '#4CAF50',        // Green
    served: '#8BC34A',       // Light Green
    completed: '#2E7D32',    // Dark Green
    cancelled: '#F44336'     // Red
  },

  kitchenItemStatusColors: {
    pending: '#BDBDBD',
    accepted: '#03A9F4',
    preparing: '#FF9800',
    ready: '#4CAF50',
    served: '#8BC34A',
    cancelled: '#F44336'
  },

  delayStatusColors: {
    on_time: "#4CAF50",      // Green
    approaching_delay: "#FF9800", // Orange
    delayed: "#F44336",      // Red
    critical_delay: "#D32F2F", // Dark Red
  },
  
  // Time Thresholds (in minutes)
  delayThresholds: {
    approaching_delay: 10,  // Warn when 10 minutes left
    delayed: 0,             // Delayed when past estimated time
    critical_delay: 15,     // Critical when 15+ minutes late
  },
};
