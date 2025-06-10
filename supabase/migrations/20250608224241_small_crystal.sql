/*
  # Storage Bucket Setup (Fixed)

  1. Storage Configuration
    - Create helper functions for bucket management
    - Set up file validation functions
    - Prepare bucket configuration for edge functions

  2. Note
    - Storage bucket creation is handled by edge functions
    - RLS policies are managed automatically by Supabase
    - This migration provides supporting functions only

  3. Security
    - File validation functions
    - Bucket configuration helpers
    - Edge function support utilities
*/

-- Create a function to get bucket configuration
-- This will be used by edge functions to ensure consistent settings
CREATE OR REPLACE FUNCTION get_shared_files_bucket_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
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
END;
$$;

-- Create enhanced file validation function
CREATE OR REPLACE FUNCTION validate_shared_file(
  file_name text,
  file_size bigint,
  mime_type text,
  user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config jsonb;
  allowed_types text[];
  blocked_extensions text[] := ARRAY['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.jar', '.app', '.deb', '.pkg', '.dmg', '.run', '.msi', '.dll', '.sys', '.drv'];
  blocked_mimes text[] := ARRAY['application/x-msdownload', 'application/x-executable', 'application/x-msdos-program', 'application/x-java-archive'];
  file_extension text;
  result jsonb;
BEGIN
  -- Get bucket configuration
  config := get_shared_files_bucket_config();
  allowed_types := (config->>'allowed_mime_types')::text[];
  
  -- Initialize result
  result := jsonb_build_object('valid', false, 'error', null);
  
  -- Check file size
  IF file_size > (config->>'file_size_limit')::bigint THEN
    result := jsonb_build_object(
      'valid', false, 
      'error', 'File too large (max 100MB)',
      'max_size', config->>'file_size_limit'
    );
    RETURN result;
  END IF;
  
  -- Check blocked MIME types
  IF mime_type = ANY(blocked_mimes) THEN
    result := jsonb_build_object(
      'valid', false, 
      'error', 'File type blocked for security reasons'
    );
    RETURN result;
  END IF;
  
  -- Check file extension for security
  file_extension := lower(substring(file_name from '\.([^.]*)$'));
  IF ('.' || file_extension) = ANY(blocked_extensions) THEN
    result := jsonb_build_object(
      'valid', false, 
      'error', 'File extension blocked for security reasons'
    );
    RETURN result;
  END IF;
  
  -- Check if MIME type is allowed
  IF NOT (mime_type = ANY(allowed_types)) THEN
    result := jsonb_build_object(
      'valid', false, 
      'error', 'Unsupported file type'
    );
    RETURN result;
  END IF;
  
  -- File is valid
  result := jsonb_build_object(
    'valid', true,
    'file_type', CASE 
      WHEN mime_type LIKE 'image/%' THEN 'image'
      WHEN mime_type LIKE 'video/%' THEN 'video'
      WHEN mime_type LIKE 'audio/%' THEN 'audio'
      WHEN mime_type IN ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') THEN 'document'
      WHEN mime_type LIKE 'application/zip%' OR mime_type LIKE '%compressed%' THEN 'archive'
      WHEN mime_type LIKE '%javascript%' OR mime_type LIKE 'text/css' OR mime_type LIKE 'text/html' THEN 'code'
      ELSE 'other'
    END
  );
  
  RETURN result;
END;
$$;

-- Create function to generate safe filenames
CREATE OR REPLACE FUNCTION generate_safe_filename(
  original_name text,
  user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  extension text;
  name_part text;
  safe_name text;
  timestamp_str text;
BEGIN
  -- Extract extension
  extension := substring(original_name from '\.([^.]*)$');
  IF extension IS NOT NULL THEN
    extension := '.' || extension;
    name_part := substring(original_name from '^(.*)\.([^.]*)$');
  ELSE
    extension := '';
    name_part := original_name;
  END IF;
  
  -- Clean the name part
  safe_name := regexp_replace(name_part, '[^a-zA-Z0-9._-]', '_', 'g');
  safe_name := regexp_replace(safe_name, '_+', '_', 'g');
  safe_name := trim(safe_name, '_');
  
  -- Add timestamp
  timestamp_str := extract(epoch from now())::bigint::text;
  
  -- Combine parts
  RETURN timestamp_str || '_' || safe_name || extension;
END;
$$;

-- Create function to get file type icon
CREATE OR REPLACE FUNCTION get_file_icon(mime_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE 
    WHEN mime_type LIKE 'image/%' THEN RETURN '🖼️';
    WHEN mime_type LIKE 'video/%' THEN RETURN '🎥';
    WHEN mime_type LIKE 'audio/%' THEN RETURN '🎵';
    WHEN mime_type IN ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') THEN RETURN '📄';
    WHEN mime_type LIKE 'application/zip%' OR mime_type LIKE '%compressed%' THEN RETURN '📦';
    WHEN mime_type LIKE '%javascript%' OR mime_type LIKE 'text/css' OR mime_type LIKE 'text/html' THEN RETURN '💻';
    ELSE RETURN '📎';
  END CASE;
END;
$$;

-- Grant execute permissions to all roles that need them
GRANT EXECUTE ON FUNCTION get_shared_files_bucket_config() TO service_role;
GRANT EXECUTE ON FUNCTION get_shared_files_bucket_config() TO anon;
GRANT EXECUTE ON FUNCTION get_shared_files_bucket_config() TO authenticated;

GRANT EXECUTE ON FUNCTION validate_shared_file(text, bigint, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION validate_shared_file(text, bigint, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION validate_shared_file(text, bigint, text, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION generate_safe_filename(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION generate_safe_filename(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION generate_safe_filename(text, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION get_file_icon(text) TO service_role;
GRANT EXECUTE ON FUNCTION get_file_icon(text) TO anon;
GRANT EXECUTE ON FUNCTION get_file_icon(text) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_shared_files_bucket_config() IS 'Returns configuration for shared-files storage bucket used by edge functions';
COMMENT ON FUNCTION validate_shared_file(text, bigint, text, uuid) IS 'Validates file uploads against security and size constraints';
COMMENT ON FUNCTION generate_safe_filename(text, uuid) IS 'Generates safe filenames for storage with timestamp prefix';
COMMENT ON FUNCTION get_file_icon(text) IS 'Returns appropriate emoji icon for file MIME type';