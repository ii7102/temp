const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { frontendUrl } = require('./config');
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const stripeRoutes = require('./routes/stripe');

const app = express();

app.use(helmet());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(morgan('dev'));

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    return next();
  }

  return jsonParser(req, res, next);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/stripe', stripeRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
