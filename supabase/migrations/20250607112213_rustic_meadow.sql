/*
  # Add Chat Functionality

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `user_id` (uuid, foreign key to participants.user_id)
      - `content` (text, message content)
      - `message_type` (varchar, default 'text')
      - `reply_to` (uuid, foreign key to messages)
      - `created_at` (timestamp)
      - `edited_at` (timestamp)
      - `metadata` (jsonb for additional data)

  2. Security
    - Enable RLS on messages table
    - Add open policy for hackathon use

  3. Performance
    - Add indexes for room/time queries
    - Add index for user queries
*/

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  message_type varchar(20) DEFAULT 'text',
  reply_to uuid REFERENCES messages(id),
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on messages"
  ON messages
  FOR ALL
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to);

-- Add metadata column to participants for typing indicators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'participants' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE participants ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;