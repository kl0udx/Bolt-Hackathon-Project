import { supabase } from '../lib/supabase';

export interface Participant {
  userId: string;
  displayName: string;
  userColor: string;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: string;
  avatarEmoji?: string;
}

export class ParticipantService {
  static async getRoomParticipants(roomId: string): Promise<Participant[]> {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_online', true)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      return data.map(p => ({
        userId: p.user_id,
        displayName: p.display_name,
        userColor: p.user_color,
        isHost: p.is_host,
        isOnline: p.is_online,
        joinedAt: p.joined_at,
        avatarEmoji: p.avatar_emoji
      }));
    } catch (error) {
      throw error;
    }
  }

  static async getParticipant(userId: string): Promise<Participant | null> {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return {
        userId: data.user_id,
        displayName: data.display_name,
        userColor: data.user_color,
        isHost: data.is_host,
        isOnline: data.is_online,
        joinedAt: data.joined_at,
        avatarEmoji: data.avatar_emoji
      };
    } catch (error) {
      return null;
    }
  }

  static async updateParticipantStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('participants')
        .update({ is_online: isOnline })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  }
} 