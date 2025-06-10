/*
  # Add Message Reactions and File Attachments

  1. New Tables
    - `message_reactions`
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key to messages)
      - `user_id` (uuid, foreign key to participants)
      - `emoji` (varchar, the reaction emoji)
      - `created_at` (timestamp)

  2. Enhanced Tables
    - `messages` table gets file attachment support
      - `file_data` (jsonb) for file metadata
      - Enhanced metadata field

  3. Security
    - Enable RLS on new tables
    - Add policies for message reactions
*/

-- Add file attachment support to existing messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'file_data'
  ) THEN
    ALTER TABLE messages ADD COLUMN file_data JSONB DEFAULT NULL;
  END IF;
END $$;

-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on reactions"
  ON message_reactions
  FOR ALL
  TO public
  USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_file_data ON messages USING gin (file_data);