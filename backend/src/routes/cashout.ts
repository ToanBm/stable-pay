import { Router } from 'express';
import * as cashoutController from '../controllers/cashoutController';

const router = Router();

// POST /api/cashout/request
router.post('/request', cashoutController.requestCashout);

// GET /api/cashout/balance/:address
router.get('/balance/:address', cashoutController.getBalance);

// GET /api/cashout/history/:address
router.get('/history/:address', cashoutController.getCashoutHistory);

// GET /api/cashout/status/:cashoutId
router.get('/status/:cashoutId', cashoutController.getCashoutStatus);

// POST /api/cashout/create-bank-account
router.post('/create-bank-account', cashoutController.createBankAccount);

export default router;

