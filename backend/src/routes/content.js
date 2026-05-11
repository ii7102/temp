const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

async function loadCommunityPost(postId, user) {
  const result = await db.query(
    `SELECT
       p.id,
       p.title,
       p.meta,
       p.body,
       p.status,
       p.created_by,
       p.created_at,
       COUNT(DISTINCT b.id)::int AS bookmark_count,
       COUNT(DISTINCT c.id)::int AS comment_count,
       COUNT(DISTINCT CASE WHEN r.reaction = 'like' THEN r.id END)::int AS like_count,
       COUNT(DISTINCT CASE WHEN r.reaction = 'dislike' THEN r.id END)::int AS dislike_count,
      COALESCE(BOOL_OR(br.user_id IS NOT NULL), FALSE) AS bookmarked,
       MAX(CASE WHEN rr.user_id = $2 THEN rr.reaction ELSE NULL END) AS my_reaction
     FROM community_posts p
     LEFT JOIN post_bookmarks b ON b.post_id = p.id
     LEFT JOIN post_comments c ON c.post_id = p.id
     LEFT JOIN post_reactions r ON r.post_id = p.id
     LEFT JOIN post_bookmarks br ON br.post_id = p.id AND br.user_id = $2
     LEFT JOIN post_reactions rr ON rr.post_id = p.id AND rr.user_id = $2
     WHERE p.id = $1
       AND (p.status = 'approved' OR p.created_by = $2 OR $3 = TRUE)
     GROUP BY p.id`,
    [postId, user?.sub || null, Boolean(user?.role === 'admin')]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const commentsResult = await db.query(
    `SELECT c.id, c.body, c.created_at, u.name, u.id AS user_id
     FROM post_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [postId]
  );

  return {
    post: result.rows[0],
    comments: commentsResult.rows,
  };
}

async function loadCommunityEvent(eventId, user) {
  const result = await db.query(
    `SELECT
       e.id,
       e.day_label,
       e.title,
       e.note,
       e.starts_at,
       e.status,
       e.created_by,
       e.created_at,
       COUNT(DISTINCT rsvp.id)::int AS rsvp_count,
       COUNT(DISTINCT c.id)::int AS comment_count,
       COUNT(DISTINCT CASE WHEN rx.reaction = 'like' THEN rx.id END)::int AS like_count,
       COUNT(DISTINCT CASE WHEN rx.reaction = 'dislike' THEN rx.id END)::int AS dislike_count,
       MAX(CASE WHEN rr.user_id = $2 THEN rr.reaction ELSE NULL END) AS my_reaction,
      COALESCE(BOOL_OR(e_rsvp.user_id IS NOT NULL), FALSE) AS rsvped
     FROM community_events e
     LEFT JOIN event_rsvps rsvp ON rsvp.event_id = e.id
     LEFT JOIN event_comments c ON c.event_id = e.id
     LEFT JOIN event_reactions rx ON rx.event_id = e.id
     LEFT JOIN event_reactions rr ON rr.event_id = e.id AND rr.user_id = $2
     LEFT JOIN event_rsvps e_rsvp ON e_rsvp.event_id = e.id AND e_rsvp.user_id = $2
     WHERE e.id = $1
       AND (e.status = 'approved' OR e.created_by = $2 OR $3 = TRUE)
     GROUP BY e.id`,
    [eventId, user?.sub || null, Boolean(user?.role === 'admin')]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const commentsResult = await db.query(
    `SELECT c.id, c.body, c.created_at, u.name, u.id AS user_id
     FROM event_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [eventId]
  );

  return {
    event: result.rows[0],
    comments: commentsResult.rows,
  };
}

router.get('/home', async (req, res, next) => {
  try {
    const [postsResult, eventsResult, membersResult, paymentsResult] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM community_posts'),
      db.query('SELECT COUNT(*)::int AS count FROM community_events'),
      db.query('SELECT COUNT(*)::int AS count FROM users'),
      db.query("SELECT COALESCE(SUM(amount_cents), 0)::int AS total_cents FROM payments WHERE status = 'paid'"),
    ]);

    return res.json({
      highlights: [
        { label: 'Members checking in', value: membersResult.rows[0].count.toLocaleString('en-US') },
        { label: 'This month raised', value: `$${Math.round(paymentsResult.rows[0].total_cents / 100).toLocaleString('en-US')}` },
        { label: 'Open conversations', value: postsResult.rows[0].count.toLocaleString('en-US') },
        { label: 'Upcoming events', value: eventsResult.rows[0].count.toLocaleString('en-US') },
      ],
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/community', async (req, res, next) => {
  try {
    const statusFilter = req.user?.role === 'admin' ? '' : "WHERE p.status = 'approved'";
    const query = `
      SELECT
        p.id,
        p.title,
        p.meta,
        p.body,
        p.status,
        p.created_by,
        p.created_at,
        COUNT(b.id)::int AS bookmark_count
      FROM community_posts p
      LEFT JOIN post_bookmarks b ON b.post_id = p.id
      ${statusFilter}
      GROUP BY p.id
      ORDER BY p.created_at DESC, p.id DESC
    `;
    const result = await db.query(query);

    return res.json({
      posts: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/community', requireAuth, async (req, res, next) => {
  try {
    const { title, meta, body } = req.body;

    if (!title || !meta || !body) {
      return res.status(400).json({ error: 'title, meta, and body are required' });
    }

    const status = req.user.role === 'admin' ? 'approved' : 'pending';
    const result = await db.query(
      'INSERT INTO community_posts (title, meta, body, created_by, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, meta, body, status, created_by, created_at',
      [title.trim(), meta.trim(), body.trim(), req.user.sub, status]
    );

    return res.status(201).json({ post: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/community/:id', requireAuth, async (req, res, next) => {
  try {
    const { title, meta, body } = req.body;
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    if (!title || !meta || !body) {
      return res.status(400).json({ error: 'title, meta, and body are required' });
    }

    const postResult = await db.query('SELECT created_by FROM community_posts WHERE id = $1', [postId]);
    if (postResult.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isAuthorOrAdmin = req.user.role === 'admin' || postResult.rows[0].created_by === req.user.sub;
    if (!isAuthorOrAdmin) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    const result = await db.query(
      'UPDATE community_posts SET title = $1, meta = $2, body = $3 WHERE id = $4 RETURNING id, title, meta, body, status, created_at',
      [title.trim(), meta.trim(), body.trim(), postId]
    );

    return res.json({ post: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/community/:id', requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const postResult = await db.query('SELECT created_by FROM community_posts WHERE id = $1', [postId]);
    if (postResult.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isAuthorOrAdmin = req.user.role === 'admin' || postResult.rows[0].created_by === req.user.sub;
    if (!isAuthorOrAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    const result = await db.query('DELETE FROM community_posts WHERE id = $1', [postId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/community/:id/approve', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const result = await db.query(
      "UPDATE community_posts SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING id, title, status",
      [postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found or not pending' });
    }

    return res.json({ post: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/community/:id/reject', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const result = await db.query(
      "UPDATE community_posts SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING id, title, status",
      [postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found or not pending' });
    }

    return res.json({ post: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const statusFilter = req.user?.role === 'admin' ? '' : "WHERE e.status = 'approved'";
    const query = `
      SELECT
        e.id,
        e.day_label,
        e.title,
        e.note,
        e.starts_at,
        e.status,
        e.created_by,
        e.created_at,
        COUNT(r.id)::int AS rsvp_count
      FROM community_events e
      LEFT JOIN event_rsvps r ON r.event_id = e.id
      ${statusFilter}
      GROUP BY e.id
      ORDER BY e.starts_at ASC, e.id ASC
    `;
    const result = await db.query(query);

    return res.json({
      events: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/events', requireAuth, async (req, res, next) => {
  try {
    const { dayLabel, title, note, startsAt } = req.body;

    if (!dayLabel || !title || !note || !startsAt) {
      return res.status(400).json({ error: 'dayLabel, title, note, and startsAt are required' });
    }

    const status = req.user.role === 'admin' ? 'approved' : 'pending';
    const result = await db.query(
      'INSERT INTO community_events (day_label, title, note, starts_at, created_by, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, day_label, title, note, starts_at, status, created_by, created_at',
      [dayLabel.trim(), title.trim(), note.trim(), startsAt, req.user.sub, status]
    );

    return res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const { dayLabel, title, note, startsAt } = req.body;
    const eventId = Number(req.params.id);

    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    if (!dayLabel || !title || !note || !startsAt) {
      return res.status(400).json({ error: 'dayLabel, title, note, and startsAt are required' });
    }

    const eventResult = await db.query('SELECT created_by FROM community_events WHERE id = $1', [eventId]);
    if (eventResult.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isAuthorOrAdmin = req.user.role === 'admin' || eventResult.rows[0].created_by === req.user.sub;
    if (!isAuthorOrAdmin) {
      return res.status(403).json({ error: 'Not authorized to edit this event' });
    }

    const result = await db.query(
      'UPDATE community_events SET day_label = $1, title = $2, note = $3, starts_at = $4 WHERE id = $5 RETURNING id, day_label, title, note, starts_at, status, created_at',
      [dayLabel.trim(), title.trim(), note.trim(), startsAt, eventId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ event: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);

    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const eventResult = await db.query('SELECT created_by FROM community_events WHERE id = $1', [eventId]);
    if (eventResult.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isAuthorOrAdmin = req.user.role === 'admin' || eventResult.rows[0].created_by === req.user.sub;
    if (!isAuthorOrAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    const result = await db.query('DELETE FROM community_events WHERE id = $1', [eventId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/events/:id/approve', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);

    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const result = await db.query(
      "UPDATE community_events SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING id, title, status",
      [eventId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found or not pending' });
    }

    return res.json({ event: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/events/:id/reject', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);

    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const result = await db.query(
      "UPDATE community_events SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING id, title, status",
      [eventId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found or not pending' });
    }

    return res.json({ event: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/pending', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const [pendingPostsResult, pendingEventsResult] = await Promise.all([
      db.query(
        `SELECT id, title, meta, body, created_by, status, created_at
         FROM community_posts
         WHERE status = 'pending'
         ORDER BY created_at ASC`
      ),
      db.query(
        `SELECT id, day_label, title, note, starts_at, created_by, status, created_at
         FROM community_events
         WHERE status = 'pending'
         ORDER BY created_at ASC`
      ),
    ]);

    return res.json({
      pendingPosts: pendingPostsResult.rows,
      pendingEvents: pendingEventsResult.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const [paymentResult, latestPaymentResult, bookmarkResult, rsvpResult, bookmarkedPostsResult, rsvpEventsResult] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_cents), 0)::int AS total_cents FROM payments WHERE user_id = $1', [
        req.user.sub,
      ]),
      db.query(
        'SELECT amount_cents, currency, status, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.sub]
      ),
      db.query('SELECT COUNT(*)::int AS count FROM post_bookmarks WHERE user_id = $1', [req.user.sub]),
      db.query('SELECT COUNT(*)::int AS count FROM event_rsvps WHERE user_id = $1', [req.user.sub]),
      db.query(
        `SELECT p.id, p.title, p.meta, p.body, p.created_at
         FROM post_bookmarks b
         JOIN community_posts p ON p.id = b.post_id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC`,
        [req.user.sub]
      ),
      db.query(
        `SELECT e.id, e.day_label, e.title, e.note, e.starts_at
         FROM event_rsvps r
         JOIN community_events e ON e.id = r.event_id
         WHERE r.user_id = $1
         ORDER BY r.created_at DESC`,
        [req.user.sub]
      ),
    ]);

    const paymentStats = paymentResult.rows[0];
    const latestPayment = latestPaymentResult.rows[0] || null;

    return res.json({
      summary: {
        title: 'Your village workspace',
        copy: 'A personalized area for member status, quick actions, and the most important community touchpoints in one place.',
      },
      actions: [
        'Check community notices',
        'Review this week\'s events',
        'Make a support contribution',
      ],
      notes: [
        'Your member profile stays synced between sessions.',
        'Support payments are processed securely through Stripe.',
        'Community moderators can later add event and post management here.',
      ],
      roleSections:
        req.user.role === 'admin'
          ? [
              {
                title: 'Admin moderation',
                copy: 'Create and edit community posts, review events, and keep the board current.',
              },
              {
                title: 'Publishing tools',
                copy: 'Use the Community and Events views to manage the live bulletin board from one place.',
              },
            ]
          : [],
      member: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        preferences: req.user.preferences || {},
        supportCount: paymentStats.count,
        supportTotalCents: paymentStats.total_cents,
        latestPayment,
        bookmarkCount: bookmarkResult.rows[0].count,
        rsvpCount: rsvpResult.rows[0].count,
      },
      bookmarkedPosts: bookmarkedPostsResult.rows,
      rsvpEvents: rsvpEventsResult.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.title, p.meta, p.body, p.created_at
       FROM post_bookmarks b
       JOIN community_posts p ON p.id = b.post_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.sub]
    );

    return res.json({ bookmarks: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/community/:id/bookmark', requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const existing = await db.query('SELECT id FROM post_bookmarks WHERE user_id = $1 AND post_id = $2', [req.user.sub, postId]);
    if (existing.rowCount > 0) {
      await db.query('DELETE FROM post_bookmarks WHERE user_id = $1 AND post_id = $2', [req.user.sub, postId]);
      return res.json({ bookmarked: false });
    }

    await db.query('INSERT INTO post_bookmarks (user_id, post_id) VALUES ($1, $2)', [req.user.sub, postId]);
    return res.status(201).json({ bookmarked: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/community/:id', requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const data = await loadCommunityPost(postId, req.user);
    if (!data) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.post('/community/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const { body } = req.body;

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const visiblePost = await loadCommunityPost(postId, req.user);
    if (!visiblePost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const result = await db.query(
      'INSERT INTO post_comments (post_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at',
      [postId, req.user.sub, body.trim()]
    );

    return res.status(201).json({
      comment: {
        ...result.rows[0],
        name: req.user.name,
        user_id: req.user.sub,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/community/:id/reaction', requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const { reaction } = req.body;

    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const visiblePost = await loadCommunityPost(postId, req.user);
    if (!visiblePost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = await db.query('SELECT reaction FROM post_reactions WHERE user_id = $1 AND post_id = $2', [req.user.sub, postId]);

    if (existing.rowCount > 0 && existing.rows[0].reaction === reaction) {
      await db.query('DELETE FROM post_reactions WHERE user_id = $1 AND post_id = $2', [req.user.sub, postId]);
      return res.json({ reaction: null });
    }

    await db.query(
      `INSERT INTO post_reactions (user_id, post_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, post_id) DO UPDATE SET reaction = EXCLUDED.reaction`,
      [req.user.sub, postId, reaction]
    );

    return res.status(201).json({ reaction });
  } catch (error) {
    return next(error);
  }
});

router.get('/rsvps', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT e.id, e.day_label, e.title, e.note, e.starts_at
       FROM event_rsvps r
       JOIN community_events e ON e.id = r.event_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.sub]
    );

    return res.json({ rsvps: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/events/:id/rsvp', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const existing = await db.query('SELECT id FROM event_rsvps WHERE user_id = $1 AND event_id = $2', [req.user.sub, eventId]);
    if (existing.rowCount > 0) {
      await db.query('DELETE FROM event_rsvps WHERE user_id = $1 AND event_id = $2', [req.user.sub, eventId]);
      return res.json({ rsvped: false });
    }

    await db.query('INSERT INTO event_rsvps (user_id, event_id) VALUES ($1, $2)', [req.user.sub, eventId]);
    return res.status(201).json({ rsvped: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const data = await loadCommunityEvent(eventId, req.user);
    if (!data) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.post('/events/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const { body } = req.body;

    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const visibleEvent = await loadCommunityEvent(eventId, req.user);
    if (!visibleEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = await db.query(
      'INSERT INTO event_comments (event_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at',
      [eventId, req.user.sub, body.trim()]
    );

    return res.status(201).json({
      comment: {
        ...result.rows[0],
        name: req.user.name,
        user_id: req.user.sub,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/events/:id/reaction', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const { reaction } = req.body;

    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const visibleEvent = await loadCommunityEvent(eventId, req.user);
    if (!visibleEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const existing = await db.query('SELECT reaction FROM event_reactions WHERE user_id = $1 AND event_id = $2', [req.user.sub, eventId]);

    if (existing.rowCount > 0 && existing.rows[0].reaction === reaction) {
      await db.query('DELETE FROM event_reactions WHERE user_id = $1 AND event_id = $2', [req.user.sub, eventId]);
      return res.json({ reaction: null });
    }

    await db.query(
      `INSERT INTO event_reactions (user_id, event_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, event_id) DO UPDATE SET reaction = EXCLUDED.reaction`,
      [req.user.sub, eventId, reaction]
    );

    return res.status(201).json({ reaction });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;