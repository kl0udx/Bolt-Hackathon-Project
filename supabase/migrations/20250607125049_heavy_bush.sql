/*
  # Add Cursor Tracking to Room Management System

  1. Database Changes
    - Add cursor tracking columns to participants table
    - Add avatar_emoji and platform tracking
    - Add room settings for enhanced features
    - Add performance indexes for cursor updates

  2. New Features
    - Real-time cursor position tracking
    - Platform detection (ChatGPT, Claude, Bolt, etc.)
    - Avatar emoji support
    - Enhanced room settings

  3. Performance Optimizations
    - Indexes for cursor queries
    - Optimized real-time subscriptions
*/

-- Add cursor tracking and enhanced features to participants table
DO $$
BEGIN
  -- Add cursor tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'cursor_x'
  ) THEN
    ALTER TABLE participants ADD COLUMN cursor_x INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'cursor_y'
  ) THEN
    ALTER TABLE participants ADD COLUMN cursor_y INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'cursor_updated_at'
  ) THEN
    ALTER TABLE participants ADD COLUMN cursor_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add avatar and platform tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'avatar_emoji'
  ) THEN
    ALTER TABLE participants ADD COLUMN avatar_emoji VARCHAR(10) DEFAULT '🐘';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'current_platform'
  ) THEN
    ALTER TABLE participants ADD COLUMN current_platform VARCHAR(50);
  END IF;
END $$;

-- Add enhanced settings to rooms table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'settings'
  ) THEN
    ALTER TABLE rooms ADD COLUMN settings JSONB DEFAULT '{
      "allowScreenShare": true,
      "allowRecording": true,
      "allowFileSharing": true,
      "allowCursorTracking": true,
      "maxFileSize": 104857600,
      "cursorUpdateInterval": 100
    }'::jsonb;
  END IF;
END $$;

-- Add performance indexes for cursor tracking
CREATE INDEX IF NOT EXISTS idx_participants_cursor ON participants(room_id, cursor_updated_at);
CREATE INDEX IF NOT EXISTS idx_participants_platform ON participants(current_platform);
CREATE INDEX IF NOT EXISTS idx_rooms_settings ON rooms USING GIN(settings);

-- Update existing participants with default cursor positions
UPDATE participants 
SET 
  cursor_x = 0,
  cursor_y = 0,
  cursor_updated_at = NOW(),
  avatar_emoji = '🐘'
WHERE cursor_x IS NULL OR cursor_y IS NULL;

-- Update existing rooms with default settings
UPDATE rooms 
SET settings = '{
  "allowScreenShare": true,
  "allowRecording": true,
  "allowFileSharing": true,
  "allowCursorTracking": true,
  "maxFileSize": 104857600,
  "cursorUpdateInterval": 100
}'::jsonb
WHERE settings IS NULL;