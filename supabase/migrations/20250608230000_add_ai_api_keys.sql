/*
  # Add AI API Keys Management

  1. New Tables
    - `ai_api_keys`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `provider` (varchar, e.g., 'openai', 'anthropic', 'google')
      - `encrypted_key` (text, encrypted API key)
      - `created_by` (uuid, foreign key to participants.user_id)
      - `created_at` (timestamp)
      - `last_used_at` (timestamp)
      - `is_active` (boolean)
      - `metadata` (jsonb for additional data)

  2. Security
    - Enable RLS on ai_api_keys table
    - Add policies for host-only access
    - Add encryption for API keys
    - Add proper indexing

  3. Features
    - Encrypted storage of API keys
    - Host-only management
    - Usage tracking
    - Room-based access control
*/

-- Create encryption extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create ai_api_keys table
CREATE TABLE IF NOT EXISTS ai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(room_id, provider)
);

-- Enable RLS
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only room hosts can manage API keys
CREATE POLICY "Hosts can manage API keys"
  ON ai_api_keys
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.room_id = ai_api_keys.room_id
      AND p.user_id = auth.uid()
      AND p.is_host = true
    )
  );

-- All room participants can view active API keys
CREATE POLICY "Participants can view active API keys"
  ON ai_api_keys
  FOR SELECT
  TO public
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.room_id = ai_api_keys.room_id
      AND p.user_id = auth.uid()
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ai_keys_room ON ai_api_keys(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_keys_provider ON ai_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_ai_keys_active ON ai_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_keys_created_by ON ai_api_keys(created_by);

-- Helper function to encrypt API key
CREATE OR REPLACE FUNCTION encrypt_api_key(api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pgcrypto to encrypt the API key
  -- The encryption key should be stored in environment variables
  RETURN encode(
    pgp_sym_encrypt(
      api_key,
      current_setting('app.settings.encryption_key', true)
    ),
    'base64'
  );
END;
$$;

-- Helper function to decrypt API key
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pgcrypto to decrypt the API key
  RETURN pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    current_setting('app.settings.encryption_key', true)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION encrypt_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_api_key(TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE ai_api_keys IS 'Stores encrypted API keys for AI providers, managed by room hosts';
COMMENT ON FUNCTION encrypt_api_key(TEXT) IS 'Encrypts API keys using pgcrypto';
COMMENT ON FUNCTION decrypt_api_key(TEXT) IS 'Decrypts API keys using pgcrypto'; 