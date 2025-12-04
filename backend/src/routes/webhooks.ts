import { Router } from 'express';
import * as webhookController from '../controllers/webhookController';

const router = Router();

// Stripe webhook route
// Note: Raw body is already parsed in server.ts before this router
router.post('/stripe', webhookController.handleStripeWebhook);

export default router;

