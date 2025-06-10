-- Create the missing cursor_positions table
CREATE TABLE IF NOT EXISTS cursor_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    user_color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    avatar_emoji VARCHAR(10) DEFAULT '🖱️',
    x REAL NOT NULL,
    y REAL NOT NULL,
    platform VARCHAR(50) DEFAULT 'desktop',
    is_online BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cursor_positions_room_id ON cursor_positions(room_id);
CREATE INDEX IF NOT EXISTS idx_cursor_positions_user_id ON cursor_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_cursor_positions_is_online ON cursor_positions(is_online);

-- Enable RLS (Row Level Security)
ALTER TABLE cursor_positions ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Users can view all cursor positions in rooms they participate in"
    ON cursor_positions FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM participants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own cursor positions"
    ON cursor_positions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own cursor positions"
    ON cursor_positions FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own cursor positions"
    ON cursor_positions FOR DELETE
    USING (user_id = auth.uid()); 