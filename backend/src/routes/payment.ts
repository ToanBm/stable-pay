import { Router } from 'express';
import * as paymentController from '../controllers/paymentController';

const router = Router();

// POST /api/payment/create-intent
router.post('/create-intent', paymentController.createPaymentIntentHandler);

// GET /api/payment/status/:paymentIntentId
router.get('/status/:paymentIntentId', paymentController.getPaymentStatus);

// GET /api/payment/history/:walletAddress
router.get('/history/:walletAddress', paymentController.getPaymentHistory);

// GET /api/payment/offramp-balance
router.get('/offramp-balance', paymentController.getOfframpBalanceHandler);

// GET /api/payment/exchange-rate?currency=USD
router.get('/exchange-rate', paymentController.getExchangeRateHandler);

export default router;

