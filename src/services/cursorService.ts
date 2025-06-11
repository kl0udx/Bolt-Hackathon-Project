import { supabase } from '../lib/supabase';

export interface CursorPosition {
  userId: string;
  displayName: string;
  userColor: string;
  avatarEmoji: string;
  x: number;
  y: number;
  updatedAt: string;
  platform?: string;
  isOnline: boolean;
}

export interface CursorUpdate {
  userId: string;
  x: number;
  y: number;
  platform?: string;
}

export class CursorService {
  // Validate cursor coordinates to ensure they're valid numbers
  private static validateCoordinates(x: number, y: number): { x: number; y: number } {
    const validX = isFinite(x) ? Math.round(x) : 0;
    const validY = isFinite(y) ? Math.round(y) : 0;
    
    // Clamp coordinates to reasonable ranges (0 to 50,000 for large canvas)
    const clampedX = Math.max(0, Math.min(50000, validX));
    const clampedY = Math.max(0, Math.min(50000, validY));
    
    return { x: clampedX, y: clampedY };
  }

  static async updateCursor(roomId: string, update: CursorUpdate): Promise<void> {
    try {
      console.log('Updating cursor position:', { roomId, update });
      
      // Validate and clamp coordinates
      const { x, y } = this.validateCoordinates(update.x, update.y);
      
      const updateData = {
        cursor_x: x,  // INTEGER type in DB
        cursor_y: y,  // INTEGER type in DB
        cursor_updated_at: new Date().toISOString(),
        current_platform: update.platform || 'Unknown',
        last_seen: new Date().toISOString()
      };
      
      console.log('Processed update data:', updateData);
      
      const { error, data } = await supabase
        .from('participants')
        .update(updateData)
        .eq('room_id', roomId)
        .eq('user_id', update.userId)
        .select();

      if (error) {
        console.error('Failed to update cursor - Supabase error:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('No participant found to update cursor for:', { roomId, userId: update.userId });
      } else {
        console.log('Cursor updated successfully:', data[0]);
      }
    } catch (error) {
      console.error('Error in updateCursor:', error);
      throw error;
    }
  }

  static async getCursors(roomId: string): Promise<CursorPosition[]> {
    try {
      console.log('Fetching cursors for room:', roomId);
      
      const { data, error } = await supabase
        .from('participants')
        .select(`
          user_id,
          display_name,
          user_color,
          avatar_emoji,
          cursor_x,
          cursor_y,
          cursor_updated_at,
          current_platform,
          is_online,
          last_seen
        `)
        .eq('room_id', roomId)
        .eq('is_online', true)
        .not('cursor_updated_at', 'is', null); // Only get participants with cursor data

      if (error) {
        console.error('Failed to fetch cursors - Supabase error:', {
          error,
          code: error.code,
          message: error.message
        });
        throw error;
      }

      const cursors = data?.map(participant => {
        // Ensure coordinates are valid numbers
        const x = typeof participant.cursor_x === 'number' ? participant.cursor_x : 0;
        const y = typeof participant.cursor_y === 'number' ? participant.cursor_y : 0;
        
        return {
          userId: participant.user_id,
          displayName: participant.display_name || 'Anonymous',
          userColor: participant.user_color || '#6366f1',
          avatarEmoji: participant.avatar_emoji || '🖱️',
          x,
          y,
          updatedAt: participant.cursor_updated_at || new Date().toISOString(),
          platform: participant.current_platform || 'Unknown',
          isOnline: participant.is_online || false
        };
      }) || [];
      
      console.log('Fetched cursors:', cursors);
      return cursors;
    } catch (error) {
      console.error('Error in getCursors:', error);
      throw error;
    }
  }

  static async setOnlineStatus(roomId: string, userId: string, isOnline: boolean): Promise<void> {
    try {
      console.log('Setting online status:', { roomId, userId, isOnline });
      
      const { error, data } = await supabase
        .from('participants')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Failed to set online status - Supabase error:', {
          error,
          code: error.code,
          message: error.message
        });
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('No participant found to update online status for:', { roomId, userId });
      } else {
        console.log('Online status updated successfully:', data[0]);
      }
    } catch (error) {
      console.error('Error in setOnlineStatus:', error);
      throw error;
    }
  }

  // Helper method to check if the participant exists and has proper schema
  static async validateParticipantSchema(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('user_id, cursor_x, cursor_y, cursor_updated_at')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Schema validation failed:', error);
        return false;
      }

      // Check if cursor fields exist
      const hasRequiredFields = data && 
        'cursor_x' in data && 
        'cursor_y' in data && 
        'cursor_updated_at' in data;

      console.log('Schema validation result:', { hasRequiredFields, data });
      return hasRequiredFields;
    } catch (error) {
      console.error('Error in schema validation:', error);
      return false;
    }
  }
} 