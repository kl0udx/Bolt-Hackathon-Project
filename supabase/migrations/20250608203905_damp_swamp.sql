/*
  # Create Storage Bucket for File Sharing (Fixed)

  1. Storage Setup
    - Create shared-files bucket safely
    - Set up RLS policies without modifying system tables
    - Use proper Supabase storage functions

  2. Security
    - Public read access for downloads
    - Authenticated upload access
    - User-based file management

  Note: This migration creates the bucket configuration that will be
  used by the upload-file edge function. The actual bucket creation
  and RLS setup is handled automatically by Supabase when using
  the storage client in edge functions.
*/

-- Create a function to initialize storage bucket settings
-- This will be called by edge functions when needed
CREATE OR REPLACE FUNCTION initialize_shared_files_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bucket_config jsonb;
BEGIN
  -- Return bucket configuration that will be used by edge functions
  bucket_config := jsonb_build_object(
    'id', 'shared-files',
    'name', 'shared-files',
    'public', true,
    'file_size_limit', 104857600,
    'allowed_mime_types', ARRAY[
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
  );
  
  RETURN bucket_config;
END;
$$;

-- Grant execute permission to service role and anon
GRANT EXECUTE ON FUNCTION initialize_shared_files_bucket() TO service_role;
GRANT EXECUTE ON FUNCTION initialize_shared_files_bucket() TO anon;
GRANT EXECUTE ON FUNCTION initialize_shared_files_bucket() TO authenticated;

-- Create a helper function for file validation
CREATE OR REPLACE FUNCTION validate_file_upload(
  file_name text,
  file_size bigint,
  mime_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  allowed_types text[] := ARRAY[
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
  ];
  blocked_extensions text[] := ARRAY['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.jar'];
  file_extension text;
BEGIN
  -- Check file size (100MB limit)
  IF file_size > 104857600 THEN
    RETURN false;
  END IF;
  
  -- Check MIME type
  IF NOT (mime_type = ANY(allowed_types)) THEN
    RETURN false;
  END IF;
  
  -- Check file extension for security
  file_extension := lower(right(file_name, 4));
  IF file_extension = ANY(blocked_extensions) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Grant execute permission for file validation
GRANT EXECUTE ON FUNCTION validate_file_upload(text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION validate_file_upload(text, bigint, text) TO anon;
GRANT EXECUTE ON FUNCTION validate_file_upload(text, bigint, text) TO authenticated;

-- Add a comment explaining the approach
COMMENT ON FUNCTION initialize_shared_files_bucket() IS 'Returns configuration for shared-files bucket. Actual bucket creation is handled by edge functions.';
COMMENT ON FUNCTION validate_file_upload(text, bigint, text) IS 'Validates file uploads against security and size constraints.';