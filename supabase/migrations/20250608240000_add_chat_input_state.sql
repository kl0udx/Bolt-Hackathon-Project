-- Create table for tracking chat input state
CREATE TABLE chat_input_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(room_id)
);

-- Add RLS policies
ALTER TABLE chat_input_state ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read the state
CREATE POLICY "Allow read access to all participants"
  ON chat_input_state
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update the state if they're in the room
CREATE POLICY "Allow update access to room participants"
  ON chat_input_state
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.room_id = chat_input_state.room_id
      AND participants.user_id = auth.uid()
      AND participants.is_online = true
    )
  );

-- Allow users to insert state if they're in the room
CREATE POLICY "Allow insert access to room participants"
  ON chat_input_state
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.room_id = chat_input_state.room_id
      AND participants.user_id = auth.uid()
      AND participants.is_online = true
    )
  );

-- Create function to update last_activity
CREATE OR REPLACE FUNCTION update_chat_input_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_activity
CREATE TRIGGER update_chat_input_activity
  BEFORE UPDATE ON chat_input_state
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_input_activity();

-- Add indexes
CREATE INDEX idx_chat_input_state_room_user ON chat_input_state(room_id, user_id);
CREATE INDEX idx_chat_input_state_last_activity ON chat_input_state(last_activity);

-- Add comments
COMMENT ON TABLE chat_input_state IS 'Tracks the state of chat input for each room, including who is typing and when they were last active';
COMMENT ON COLUMN chat_input_state.is_typing IS 'Whether the user is currently typing in the chat input';
COMMENT ON COLUMN chat_input_state.last_activity IS 'When the user last interacted with the chat input'; 