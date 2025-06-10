/*
  # Update Room Capacity for WebRTC Optimization

  1. Changes
    - Update default max_participants from 10 to 8 for optimal WebRTC performance
    - Add webrtcOptimized flag to room settings
    - Update existing rooms to new capacity limit

  2. Performance Benefits
    - Better video/audio quality with fewer participants
    - Reduced bandwidth requirements per user
    - More stable connections and lower latency
    - Improved screen sharing performance
*/

-- Update default max_participants for new rooms
ALTER TABLE rooms ALTER COLUMN max_participants SET DEFAULT 8;

-- Update existing rooms to the new capacity limit
UPDATE rooms 
SET 
  max_participants = 8,
  settings = settings || '{"webrtcOptimized": true}'::jsonb
WHERE max_participants > 8;

-- Add comment explaining the change
COMMENT ON COLUMN rooms.max_participants IS 'Maximum participants per room (8 for optimal WebRTC performance)';