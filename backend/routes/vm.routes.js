const express = require('express');

const vmController = require('../controllers/vm.controller');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/active', asyncHandler(vmController.listActiveVms));
router.post('/create', asyncHandler(vmController.createVm));
router.post('/:id/exec', asyncHandler(vmController.execInVm));
router.delete('/:id', asyncHandler(vmController.deleteVm));

module.exports = router;
