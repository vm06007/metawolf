import express from 'express';
import { subscriptionMiddleware } from './index.js';

const app = express();

// Verify-only endpoint (must be BEFORE general /api/* middleware)
// Use exact path matching - Express will strip /api/verify prefix, so use '/' in config
app.use('/api/verify', subscriptionMiddleware(
  process.env.PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000',
  {
    '/': {  // Express strips the /api/verify prefix, so match on '/'
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly',
      description: 'Payment verification'
    }
  },
  undefined, // facilitator
  undefined, // paywall
  { verifyOnly: true } // Options: verify only
));

app.get('/api/verify', (req, res) => {
  // This won't be reached in verify-only mode, but kept for completeness
  res.json({ verified: true });
});

// Example: Protect all /api routes with subscription (after specific routes)
app.use(subscriptionMiddleware(
  process.env.PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000', // Replace with your address
  {
    '/api/*': {
      price: '$10',
      network: 'base-sepolia',
      billingPeriod: 'monthly',
      description: 'API subscription access'
    }
  }
));

// Example protected route (normal mode: verify + route + settle)
app.get('/api/data', (req, res) => {
  res.json({ 
    message: 'This is protected content',
    timestamp: new Date().toISOString()
  });
});

// Health check (not protected)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Export for Vercel serverless functions
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Protected routes: /api/*`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
  });
}
