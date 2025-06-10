import { supabase } from '../lib/supabase';

export interface RecordingSession {
  id: string;
  room_id: string;
  started_by: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  file_url?: string;
  file_size?: number;
  status: 'recording' | 'processing' | 'completed' | 'failed' | 'requesting_permission' | 'cancelled';
  twitter_optimized: boolean;
  download_count: number;
  metadata?: any;
}

export interface CreateRecordingRequest {
  roomId: string;
  userId: string;
  metadata?: any;
}

export interface UpdateRecordingRequest {
  sessionId: string;
  status?: 'recording' | 'processing' | 'completed' | 'failed' | 'cancelled';
  duration_seconds?: number;
  file_url?: string;
  file_size?: number;
  twitter_optimized?: boolean;
}

export class RecordingService {
  // Create a new recording session
  static async createRecordingSession(request: CreateRecordingRequest): Promise<RecordingSession> {
    try {
      const { data, error } = await supabase
        .from('recording_sessions')
        .insert({
          room_id: request.roomId,
          started_by: request.userId,
          status: 'recording',
          twitter_optimized: false,
          metadata: request.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create recording session:', error);
      throw new Error('Failed to start recording session');
    }
  }

  // Update recording session with completion data
  static async updateRecordingSession(request: UpdateRecordingRequest): Promise<RecordingSession> {
    try {
      const updateData: any = {};
      
      if (request.status) updateData.status = request.status;
      if (request.duration_seconds !== undefined) updateData.duration_seconds = request.duration_seconds;
      if (request.file_url) updateData.file_url = request.file_url;
      if (request.file_size !== undefined) updateData.file_size = request.file_size;
      if (request.twitter_optimized !== undefined) updateData.twitter_optimized = request.twitter_optimized;
      
      // Set ended_at if status is completed, failed, or cancelled
      if (request.status && ['completed', 'failed', 'cancelled'].includes(request.status)) {
        updateData.ended_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('recording_sessions')
        .update(updateData)
        .eq('id', request.sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update recording session:', error);
      throw new Error('Failed to update recording session');
    }
  }

  // Get recording session by ID
  static async getRecordingSession(sessionId: string): Promise<RecordingSession | null> {
    try {
      const { data, error } = await supabase
        .from('recording_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Failed to get recording session:', error);
      return null;
    }
  }

  // Get all recordings for a room
  static async getRoomRecordings(roomId: string): Promise<RecordingSession[]> {
    try {
      const { data, error } = await supabase
        .from('recording_sessions')
        .select('*')
        .eq('room_id', roomId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get room recordings:', error);
      return [];
    }
  }

  // Track download (increment download count)
  static async trackDownload(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_download_count', {
        session_id: sessionId
      });

      if (error) {
        // If the RPC doesn't exist, fall back to manual increment
        const { data: currentSession } = await supabase
          .from('recording_sessions')
          .select('download_count')
          .eq('id', sessionId)
          .single();

        if (currentSession) {
          await supabase
            .from('recording_sessions')
            .update({ download_count: (currentSession.download_count || 0) + 1 })
            .eq('id', sessionId);
        }
      }
    } catch (error) {
      console.error('Failed to track download:', error);
      // Don't throw error - tracking is optional
    }
  }

  // Delete recording session
  static async deleteRecordingSession(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('recording_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete recording session:', error);
      throw new Error('Failed to delete recording session');
    }
  }

  // Check if user is currently recording in room
  static async isUserRecording(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('recording_sessions')
        .select('id')
        .eq('room_id', roomId)
        .eq('started_by', userId)
        .eq('status', 'recording')
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Failed to check recording status:', error);
      return false;
    }
  }

  // Get active recording sessions for room
  static async getActiveRecordings(roomId: string): Promise<RecordingSession[]> {
    try {
      const { data, error } = await supabase
        .from('recording_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'recording');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get active recordings:', error);
      return [];
    }
  }
}

// Create the increment download count function if it doesn't exist
export const createDownloadCountFunction = async () => {
  try {
    await supabase.rpc('sql', {
      query: `
        CREATE OR REPLACE FUNCTION increment_download_count(session_id UUID)
        RETURNS void AS $$
        BEGIN
          UPDATE recording_sessions 
          SET download_count = COALESCE(download_count, 0) + 1 
          WHERE id = session_id;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
  } catch (error) {
    console.error('Failed to create download count function:', error);
  }
}; 