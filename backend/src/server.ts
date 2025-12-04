import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { initializeDatabase } from './utils/database';
import payrollRoutes from './routes/payroll';
import cashoutRoutes from './routes/cashout';
import employeeRoutes from './routes/employees';
import paymentRoutes from './routes/payment';
import * as webhookController from './controllers/webhookController';

// Load environment variables
dotenv.config();

// Initialize database
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Required when behind reverse proxy (ngrok, load balancer, etc.)
// Only trust first proxy (ngrok) for security
app.set('trust proxy', 1);

// Middleware
// Tạm thời disable CSP để tránh lỗi với Stripe.js và browser extensions
app.use(helmet({
  contentSecurityPolicy: false, // Tắt CSP tạm thời cho development
}));

// CORS configuration - allow Vercel domain and localhost for development
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'https://payonstable.vercel.app',
      'https://*.vercel.app',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check exact match
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check wildcard match for vercel.app
      if (origin.includes('.vercel.app') && allowedOrigins.some(o => o.includes('*.vercel.app'))) {
        return callback(null, true);
      }
      
      // For development, allow all origins (CHANGE IN PRODUCTION)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CORS] Allowing origin: ${origin}`);
        return callback(null, true);
      }
      
      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(morgan('combined'));

// Rate limiting (apply before routes)
app.use('/api/', rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook route needs raw body for Stripe signature verification
// Must be BEFORE express.json() middleware
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookController.handleStripeWebhook);

// GET endpoint for webhook URL (for testing/verification)
app.get('/api/webhooks/stripe', (req, res) => {
  res.json({ 
    message: 'Webhook endpoint is active. This endpoint only accepts POST requests from Stripe.',
    method: 'POST',
    url: '/api/webhooks/stripe'
  });
});

// JSON parsing middleware for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/payroll', payrollRoutes);
app.use('/api/cashout', cashoutRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payment', paymentRoutes);

// Serve test page for VISA payment
app.get('/test-visa-payment', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/test-visa-payment.html'));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server - listen on all interfaces (0.0.0.0) to allow external access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Accessible from: http://localhost:${PORT}`);
  if (process.env.NGROK_URL) {
    console.log(`Ngrok URL: ${process.env.NGROK_URL}`);
  }
});

export default app;

