import express from 'express';
import { subscriptionMiddleware } from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Example: Protect all /api routes with subscription
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

// Example protected route
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Protected routes: /api/*`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

