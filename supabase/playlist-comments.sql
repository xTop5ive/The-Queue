-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS playlist_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 500),
  parent_id  uuid REFERENCES playlist_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Index for fast per-playlist lookups
CREATE INDEX IF NOT EXISTS playlist_comments_playlist_id_idx ON playlist_comments(playlist_id);
CREATE INDEX IF NOT EXISTS playlist_comments_parent_id_idx ON playlist_comments(parent_id);

-- Enable Row Level Security
ALTER TABLE playlist_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on public playlists
CREATE POLICY "public can read comments"
  ON playlist_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_comments.playlist_id
        AND playlists.is_public = true
    )
  );

-- Authenticated users can post comments
CREATE POLICY "auth users can insert comments"
  ON playlist_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "users can delete own comments"
  ON playlist_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable Realtime for live comment updates
ALTER PUBLICATION supabase_realtime ADD TABLE playlist_comments;
