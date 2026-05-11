CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  meta TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS community_events (
  id SERIAL PRIMARY KEY,
  day_label TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE community_events ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE community_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS post_bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_reactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS event_comments (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_reactions (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

INSERT INTO community_posts (title, meta, body)
SELECT 'Harvest table sign-ups open', 'Town square • 2 hours ago', 'Volunteer cooks and growers are coordinating the Sunday meal with fresh produce from local farms.'
WHERE NOT EXISTS (SELECT 1 FROM community_posts);

INSERT INTO community_posts (title, meta, body)
SELECT 'New neighbor welcome circle', 'Community hall • Today', 'A relaxed intro session for new residents, families, and anyone wanting to meet the people nearby.'
WHERE NOT EXISTS (SELECT 1 FROM community_posts WHERE title = 'New neighbor welcome circle');

INSERT INTO community_posts (title, meta, body)
SELECT 'Tool library update', 'Workshop shed • Yesterday', 'The community tool shelf now includes pruning kits, canvas aprons, and two repaired wheelbarrows.'
WHERE NOT EXISTS (SELECT 1 FROM community_posts WHERE title = 'Tool library update');

INSERT INTO community_events (day_label, title, note, starts_at)
SELECT 'Thu 14', 'Evening market walk', '6:30 PM · Main green', NOW() + INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE title = 'Evening market walk');

INSERT INTO community_events (day_label, title, note, starts_at)
SELECT 'Sat 16', 'Seed swap and coffee', '9:00 AM · Community porch', NOW() + INTERVAL '4 days'
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE title = 'Seed swap and coffee');

INSERT INTO community_events (day_label, title, note, starts_at)
SELECT 'Mon 18', 'Council listening hour', '7:00 PM · Hall table', NOW() + INTERVAL '6 days'
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE title = 'Council listening hour');
