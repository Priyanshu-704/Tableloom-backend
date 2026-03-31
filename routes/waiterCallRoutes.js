const express = require('express');
const router = express.Router();
const {
  createWaiterCall,
  acknowledgeCall,
  completeCall,
  cancelCall,
  getPendingCalls,
  getAllCalls,
  getCallStatistics,
  getStaffPerformance,
  getActiveCalls,
  getSessionActiveCalls,
  getCallDashboard,
  updateCallStatus,
  assignCallToStaff,
  getCallsByStaff,
  getMyAssignedCalls,
  getAvailableStaff
} = require('../controllers/waiterCallController');
const { protect, hasPermission } = require('../middleware/auth');

router.post('/', createWaiterCall);
router.put('/:callId/cancel', cancelCall);
router.get('/session/:sessionId/active', getSessionActiveCalls);

router.use(protect);

router.get('/active', hasPermission('WAITER_CALL_VIEW_ALL'), getActiveCalls);
router.get('/pending', hasPermission('WAITER_CALL_VIEW_ALL'), getPendingCalls);
router.get('/my-assigned', hasPermission('WAITER_CALL_VIEW_ALL'), getMyAssignedCalls);
router.put('/:callId/acknowledge', hasPermission('WAITER_CALL_ACKNOWLEDGE'), acknowledgeCall);
router.put('/:callId/complete', hasPermission('WAITER_CALL_COMPLETE'), completeCall);
router.put('/:callId/status', hasPermission('WAITER_CALL_COMPLETE'), updateCallStatus);

router.get('/', hasPermission('WAITER_CALL_VIEW_ALL'), getAllCalls);
router.get('/dashboard', hasPermission('WAITER_CALL_VIEW_ALL'), getCallDashboard);
router.get('/statistics', hasPermission('WAITER_CALL_STATISTICS'), getCallStatistics);
router.get('/performance', hasPermission('WAITER_CALL_STATISTICS'), getStaffPerformance);
router.get('/available-staff', hasPermission('WAITER_CALL_VIEW_ALL'), getAvailableStaff);
router.put('/:callId/assign', hasPermission('WAITER_CALL_VIEW_ALL'), assignCallToStaff);
router.get('/staff/:staffId', hasPermission('WAITER_CALL_VIEW_ALL'), getCallsByStaff);

module.exports = router;
