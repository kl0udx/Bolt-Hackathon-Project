/*
  # Add Screen Share Permission System

  1. New Tables
    - `screen_share_permissions` - Track user consent for screen sharing
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to webrtc_sessions)
      - `user_id` (uuid, user granting permission)
      - `granted` (boolean, permission granted or denied)
      - `granted_at` (timestamp)

  2. Security
    - Enable RLS on new table
    - Add policies for screen share permissions

  3. Performance
    - Add indexes for efficient permission queries
*/

-- Screen share permissions table (similar to recording permissions)
CREATE TABLE IF NOT EXISTS screen_share_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES webrtc_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE screen_share_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on screen_share_permissions"
  ON screen_share_permissions
  FOR ALL
  TO public
  USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_screen_share_permissions_session ON screen_share_permissions(session_id);
CREATE INDEX IF NOT EXISTS idx_screen_share_permissions_user ON screen_share_permissions(user_id);

-- Add comment explaining the table
COMMENT ON TABLE screen_share_permissions IS 'Tracks user consent for screen sharing sessions';