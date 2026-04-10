module.exports = {
  orderStatusColors: {
    pending: '#9E9E9E',
    confirmed: '#2196F3',
    preparing: '#FF9800',
    ready: '#4CAF50',
    served: '#8BC34A',
    completed: '#2E7D32',
    cancelled: '#F44336'
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
    on_time: "#4CAF50",
    approaching_delay: "#FF9800",
    delayed: "#F44336",
    critical_delay: "#D32F2F"
  },
  delayThresholds: {
    approaching_delay: 10,
    delayed: 0,
    critical_delay: 15
  }
};
