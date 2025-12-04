import { Router } from 'express';
import * as payrollController from '../controllers/payrollController';

const router = Router();

// POST /api/payroll/prepare
router.post('/prepare', payrollController.preparePayroll);

// POST /api/payroll/execute
router.post('/execute', payrollController.executePayroll);

// GET /api/payroll/history
router.get('/history', payrollController.getPayrollHistory);

export default router;

