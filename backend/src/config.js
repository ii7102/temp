require('dotenv').config();

const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripeCurrency: process.env.STRIPE_CURRENCY || 'usd',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@stitchvillage.local').toLowerCase(),
};
