-- Push notification subscriptions for Web Push API
-- Stores browser push endpoints so server can send notifications
-- even when the PWA is closed / minimized

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Each browser endpoint is unique per user (upsert-safe)
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint
  ON push_subscriptions (user_id, endpoint);

-- Index for fast lookup when sending to a specific waiter
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id
  ON push_subscriptions (user_id);

-- RLS: users can manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
