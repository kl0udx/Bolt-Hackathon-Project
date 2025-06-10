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
  static async updateCursor(roomId: string, update: CursorUpdate): Promise<void> {
    const { error } = await supabase
      .from('participants')
      .update({
        cursor_x: Math.round(update.x),
        cursor_y: Math.round(update.y),
        cursor_updated_at: new Date().toISOString(),
        current_platform: update.platform,
        last_seen: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', update.userId);

    if (error) throw error;
  }

  static async getCursors(roomId: string): Promise<CursorPosition[]> {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_online', true);

    if (error) throw error;

    return data?.map(participant => ({
      userId: participant.user_id,
      displayName: participant.display_name || 'Anonymous',
      userColor: participant.user_color || '#6366f1',
      avatarEmoji: participant.avatar_emoji || '🖱️',
      x: participant.cursor_x || 0,
      y: participant.cursor_y || 0,
      updatedAt: participant.cursor_updated_at,
      platform: participant.current_platform,
      isOnline: participant.is_online
    })) || [];
  }

  static async setOnlineStatus(roomId: string, userId: string, isOnline: boolean): Promise<void> {
    const { error } = await supabase
      .from('participants')
      .update({
        is_online: isOnline,
        last_seen: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) throw error;
  }
} 