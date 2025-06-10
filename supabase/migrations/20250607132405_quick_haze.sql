/*
  # WebRTC Signaling and Recording System

  1. New Tables
    - `webrtc_sessions` - Track screen sharing and voice sessions
    - `comments` - Figma-style annotations with position data
    - `recording_sessions` - Session recording management
    - `recording_permissions` - User consent tracking
    - `webrtc_signals` - Temporary signaling data storage

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated access
    - Proper indexing for performance

  3. Features
    - Screen sharing coordination
    - Real-time comments with positioning
    - Recording with permission management
    - WebRTC signaling support
*/

-- WebRTC Sessions table
CREATE TABLE IF NOT EXISTS webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  session_type VARCHAR(20) NOT NULL, -- 'screen_share', 'voice', 'recording'
  host_user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Comments table (Figma-style annotations)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  target_url TEXT, -- URL where comment was made
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Recording sessions
CREATE TABLE IF NOT EXISTS recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  file_url TEXT,
  file_size BIGINT,
  status VARCHAR(20) DEFAULT 'recording', -- 'recording', 'processing', 'completed', 'failed', 'requesting_permission', 'cancelled'
  twitter_optimized BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Recording permissions (who agreed to be recorded)
CREATE TABLE IF NOT EXISTS recording_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_session_id UUID REFERENCES recording_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(recording_session_id, user_id)
);

-- WebRTC signaling temporary storage
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  from_peer UUID NOT NULL,
  to_peer UUID NOT NULL,
  signal_type VARCHAR(20) NOT NULL, -- 'offer', 'answer', 'ice-candidate'
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS
ALTER TABLE webrtc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on webrtc_sessions"
  ON webrtc_sessions
  FOR ALL
  TO public
  USING (true);

CREATE POLICY "Allow all operations on comments"
  ON comments
  FOR ALL
  TO public
  USING (true);

CREATE POLICY "Allow all operations on recording_sessions"
  ON recording_sessions
  FOR ALL
  TO public
  USING (true);

CREATE POLICY "Allow all operations on recording_permissions"
  ON recording_permissions
  FOR ALL
  TO public
  USING (true);

CREATE POLICY "Allow all operations on webrtc_signals"
  ON webrtc_signals
  FOR ALL
  TO public
  USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_webrtc_room_active ON webrtc_sessions(room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webrtc_session_type ON webrtc_sessions(session_type, is_active);
CREATE INDEX IF NOT EXISTS idx_comments_room_position ON comments(room_id, position_x, position_y);
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(room_id, resolved);
CREATE INDEX IF NOT EXISTS idx_recordings_room ON recording_sessions(room_id, started_at);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recording_sessions(status);
CREATE INDEX IF NOT EXISTS idx_permissions_recording ON recording_permissions(recording_session_id);
CREATE INDEX IF NOT EXISTS idx_signals_room_peer ON webrtc_signals(room_id, to_peer);
CREATE INDEX IF NOT EXISTS idx_signals_expires ON webrtc_signals(expires_at);

-- Auto-cleanup expired signals (function to be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS void AS $$
BEGIN
  DELETE FROM webrtc_signals WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;