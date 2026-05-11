const express = require('express');
const Stripe = require('stripe');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { frontendUrl, stripeCurrency, stripeSecretKey, stripeWebhookSecret } = require('../config');

const router = express.Router();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

router.post('/checkout-session', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const amountCents = Number(req.body.amountCents);
    const title = req.body.title || 'Village Support';
    const quantity = Number(req.body.quantity || 1);

    if (!Number.isInteger(amountCents) || amountCents < 100) {
      return res.status(400).json({ error: 'amountCents must be an integer >= 100' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'pay',
      success_url: `${frontendUrl}/?paid=1`,
      cancel_url: `${frontendUrl}/?canceled=1`,
      customer_email: req.user.email,
      line_items: [
        {
          quantity,
          price_data: {
            currency: stripeCurrency,
            unit_amount: amountCents,
            product_data: {
              name: title,
              description: 'Support the village with a one-time payment',
            },
          },
        },
      ],
      metadata: {
        userId: req.user.sub,
        title,
      },
    });

    await db.query(
      'INSERT INTO payments (user_id, stripe_session_id, amount_cents, currency, status) VALUES ($1, $2, $3, $4, $5)',
      [Number(req.user.sub), session.id, amountCents, stripeCurrency, session.payment_status || 'pending']
    );

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    return next(error);
  }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, stripe_session_id, amount_cents, currency, status, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 10',
      [req.user.sub]
    );

    return res.json({
      payments: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(204).send();
  }

  const signature = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await db.query('UPDATE payments SET status = $1 WHERE stripe_session_id = $2', ['paid', session.id]);
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(400).json({ error: `Webhook error: ${error.message}` });
  }
});

module.exports = router;
