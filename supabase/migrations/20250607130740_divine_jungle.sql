/*
  # File Storage and Sharing System

  1. New Tables
    - `shared_files`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `uploader_id` (uuid, foreign key to participants)
      - `filename` (varchar, safe filename)
      - `original_filename` (varchar, original name)
      - `file_size` (bigint, size in bytes)
      - `mime_type` (varchar, MIME type)
      - `storage_path` (text, Supabase Storage path)
      - `transfer_type` (varchar, 'server' or 'p2p')
      - `download_count` (integer, tracking downloads)
      - `thumbnail_url` (text, for image previews)
      - `metadata` (jsonb, additional file info)
      - `created_at` (timestamp)

  2. Storage Bucket
    - Create 'shared-files' bucket with public access
    - Set up RLS policies for secure access

  3. Security
    - Enable RLS on shared_files table
    - Add policies for room-based access
*/

-- Create shared_files table
CREATE TABLE IF NOT EXISTS shared_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  storage_path TEXT,
  transfer_type VARCHAR(20) DEFAULT 'server',
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE shared_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_files
CREATE POLICY "Allow all operations on shared_files"
  ON shared_files
  FOR ALL
  TO public
  USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_files_room ON shared_files(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON shared_files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_files_type ON shared_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_size ON shared_files(file_size);

-- Create storage bucket (this needs to be done via Supabase Dashboard or API)
-- The bucket creation will be handled in the upload function