/*
  # Create shared-files storage bucket

  1. Storage Setup
    - Create 'shared-files' bucket for file uploads
    - Configure public access for downloads
    - Set up RLS policies for secure access

  2. Security
    - Enable RLS on storage objects
    - Allow authenticated users to upload files
    - Allow public read access for downloads
    - Restrict delete operations to file owners
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-files',
  'shared-files',
  true,
  104857600, -- 100MB limit
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/markdown', 'application/rtf',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/x-tar', 'application/gzip',
    'video/mp4', 'video/webm', 'video/avi', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4',
    'application/javascript', 'text/javascript', 'application/typescript',
    'text/css', 'text/html', 'application/json', 'application/xml', 'text/xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to files
CREATE POLICY "Public read access for shared files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'shared-files');

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'shared-files' AND
  auth.role() = 'authenticated'
);

-- Policy: Allow file owners to delete their files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'shared-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow file owners to update their files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'shared-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'shared-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);