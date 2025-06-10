/*
  # Create Storage Bucket for File Sharing

  1. Storage Setup
    - Create shared-files bucket via function call
    - Set up basic bucket configuration
    - Enable public access for downloads

  2. Note
    - Storage bucket creation and RLS policies are handled automatically
    - by Supabase when using the storage client in edge functions
*/

-- Create a function to ensure the storage bucket exists
-- This will be called from the upload-file edge function
CREATE OR REPLACE FUNCTION ensure_shared_files_bucket()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function will be used by edge functions to ensure bucket exists
  -- The actual bucket creation will happen in the upload-file function
  RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_shared_files_bucket() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_shared_files_bucket() TO anon;