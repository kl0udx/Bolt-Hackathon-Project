/*
  # Create rooms and participants schema

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `room_code` (varchar, unique 6-char code)
      - `host_user_id` (uuid)
      - `created_at` (timestamp)
      - `expires_at` (timestamp, 24 hours from creation)
      - `max_participants` (integer, default 10)
      - `is_active` (boolean, default true)
    - `participants`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key)
      - `user_id` (uuid, unique)
      - `display_name` (varchar)
      - `user_color` (varchar, hex color)
      - `is_host` (boolean)
      - `joined_at` (timestamp)
      - `last_seen` (timestamp)
      - `is_online` (boolean)

  2. Security
    - Enable RLS on both tables
    - Add open policies for hackathon use
    - Add performance indexes

  3. Features
    - Automatic room expiration after 24 hours
    - Participant tracking with online status
    - Host designation and management
    - Room code generation and validation
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code varchar(6) UNIQUE NOT NULL,
  host_user_id uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours',
  max_participants integer DEFAULT 10,
  is_active boolean DEFAULT true
);

-- Create participants table  
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid UNIQUE DEFAULT gen_random_uuid(),
  display_name varchar(100) NOT NULL,
  user_color varchar(7) NOT NULL,
  is_host boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  is_online boolean DEFAULT true
);

-- Enable RLS (open policies for hackathon)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on rooms"
  ON rooms
  FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on participants"
  ON participants
  FOR ALL
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_participants_online ON participants(is_online);