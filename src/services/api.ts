import { supabase } from '../lib/supabase';
import { CreateRoomRequest, CreateRoomResponse, JoinRoomRequest, JoinRoomResponse, RoomDetailsResponse, CreateInviteLinkRequest, CreateInviteLinkResponse, InviteLink } from '../types/room';

// API configuration
const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const USE_EDGE_FUNCTIONS = true; // Toggle this based on deployment status

// Helper function to generate display names
const generateDisplayName = (): string => {
  const adjectives = ['Swift', 'Bright', 'Cool', 'Wise', 'Bold', 'Quick', 'Sharp', 'Calm'];
  const animals = ['Fox', 'Eagle', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Hawk', 'Owl'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj} ${animal}`;
};

// Helper function to generate user colors
const generateUserColor = (): string => {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Helper function to generate room codes
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to generate user IDs
const generateUserId = (): string => {
  return crypto.randomUUID();
};

class ApiService {
  /**
   * Try edge function first, fallback to direct calls
   */
  private async callWithFallback<T>(
    edgeFunctionCall: () => Promise<T>,
    fallbackCall: () => Promise<T>
  ): Promise<T> {
    if (!USE_EDGE_FUNCTIONS) {
      return fallbackCall();
    }

    try {
      return await edgeFunctionCall();
    } catch {
      return fallbackCall();
    }
  }

  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    return this.callWithFallback(
      // Edge function approach
      async () => {
        const response = await fetch(`${API_BASE}/create-room`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create room');
        }

        return response.json();
      },
      
      // Direct Supabase fallback
      async () => {
        const roomCode = generateRoomCode();
        const userId = generateUserId();
        const displayName = request.hostName || generateDisplayName();
        const userColor = generateUserColor();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            room_code: roomCode,
            host_user_id: userId,
            expires_at: expiresAt.toISOString(),
            max_participants: 8,
            is_active: true
          })
          .select()
          .single();

        if (roomError) throw new Error('Failed to create room: ' + roomError.message);

        // Add host as participant
        const { error: participantError } = await supabase
          .from('participants')
          .insert({
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
            user_color: userColor,
            is_host: true,
            is_online: true
          });

        if (participantError) throw new Error('Failed to add host: ' + participantError.message);

        return {
          roomCode,
          roomId: room.id,
          userId,
          displayName,
          userColor
        };
      }
    );
  }

  async getRoomDetails(roomCode: string): Promise<RoomDetailsResponse> {
    return this.callWithFallback(
      // Edge function approach
      async () => {
        const response = await fetch(`${API_BASE}/get-room?roomCode=${encodeURIComponent(roomCode)}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to get room details');
        }

        return response.json();
      },
      
      // Direct Supabase fallback
      async () => {
        // Get room details
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .eq('is_active', true)
          .single();

        if (roomError || !room) {
          throw new Error('Room not found or expired');
        }

        // Check if room is expired
        if (new Date(room.expires_at) < new Date()) {
          await supabase
            .from('rooms')
            .update({ is_active: false })
            .eq('id', room.id);
          throw new Error('Room has expired');
        }

        // Get participants
        const { data: participants, error: participantsError } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', room.id);

        if (participantsError) {
          throw new Error('Failed to load participants');
        }

        return {
          room: {
            id: room.id,
            roomCode: room.room_code,
            createdAt: room.created_at,
            expiresAt: room.expires_at,
            participantCount: participants.length,
            isActive: room.is_active
          },
          participants: participants.map(p => ({
            userId: p.user_id,
            displayName: p.display_name,
            userColor: p.user_color,
            isHost: p.is_host,
            isOnline: p.is_online
          }))
        };
      }
    );
  }

  async joinRoom(roomCode: string, request: JoinRoomRequest): Promise<JoinRoomResponse> {
    return this.callWithFallback(
      // Edge function approach
      async () => {
        const response = await fetch(`${API_BASE}/join-room?roomCode=${encodeURIComponent(roomCode)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to join room');
        }

        return response.json();
      },
      
      // Direct Supabase fallback
      async () => {
        // Get room details first
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .eq('is_active', true)
          .single();

        if (roomError || !room) {
          throw new Error('Room not found or expired');
        }

        // Check if room is expired
        if (new Date(room.expires_at) < new Date()) {
          throw new Error('Room has expired');
        }

        // Check participant count
        const { count } = await supabase
          .from('participants')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id);

        if (count && count >= room.max_participants) {
          throw new Error('Room is full');
        }

        const userId = generateUserId();
        const displayName = request.displayName || generateDisplayName();
        const userColor = generateUserColor();

        // Add participant
        const { error: participantError } = await supabase
          .from('participants')
          .insert({
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
            user_color: userColor,
            is_host: false,
            is_online: true
          });

        if (participantError) {
          throw new Error('Failed to join room: ' + participantError.message);
        }

        return {
          userId,
          displayName,
          userColor,
          roomId: room.id
        };
      }
    );
  }

  async updateParticipant(userId: string, updates: { displayName?: string; isOnline?: boolean }): Promise<void> {
    return this.callWithFallback(
      // Edge function approach
      async () => {
        const response = await fetch(`${API_BASE}/update-participant?userId=${encodeURIComponent(userId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update participant');
        }
      },
      
      // Direct Supabase fallback
      async () => {
        const updateData: any = {
          last_seen: new Date().toISOString()
        };

        if (updates.displayName !== undefined) {
          updateData.display_name = updates.displayName;
        }

        if (updates.isOnline !== undefined) {
          updateData.is_online = updates.isOnline;
        }

        const { error } = await supabase
          .from('participants')
          .update(updateData)
          .eq('user_id', userId);

        if (error) {
          throw new Error('Failed to update participant: ' + error.message);
        }
      }
    );
  }

  async leaveRoom(userId: string): Promise<void> {
    return this.updateParticipant(userId, { isOnline: false });
  }

  async createInviteLink(request: CreateInviteLinkRequest): Promise<CreateInviteLinkResponse> {
    return this.callWithFallback(
      // Edge function approach
      async () => {
        const response = await fetch(`${API_BASE}/create-invite-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create invite link');
        }

        return response.json();
      },
      
      // Direct fallback
      async () => {
        // Fallback: Generate invite link locally
        const inviteHash = crypto.randomUUID().replace(/-/g, '');
        const baseUrl = window.location.origin;
        const inviteLink = `${baseUrl}/invite/${inviteHash}/${request.roomId}?ref=${Date.now()}`;
        
        // Store in localStorage as fallback
        const inviteData = {
          inviteHash,
          roomId: request.roomId,
          createdBy: request.userId,
          createdAt: new Date().toISOString(),
          expiresAt: request.expirationHours ? 
            new Date(Date.now() + request.expirationHours * 60 * 60 * 1000).toISOString() : 
            undefined,
          inviteLink
        };
        
        const existingInvites = JSON.parse(localStorage.getItem('inviteLinks') || '[]');
        existingInvites.push(inviteData);
        localStorage.setItem('inviteLinks', JSON.stringify(existingInvites));

        return {
          inviteLink,
          inviteHash,
          expiresAt: inviteData.expiresAt
        };
      }
    );
  }

  async getInviteLinkInfo(inviteHash: string): Promise<InviteLink | null> {
    return this.callWithFallback(
      // Edge function approach
      async () => {
        const response = await fetch(`${API_BASE}/get-invite-link?hash=${inviteHash}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) return null;
          const error = await response.json();
          throw new Error(error.error || 'Failed to get invite link info');
        }

        return response.json();
      },
      
      // Direct fallback
      async () => {
        // Fallback: Get from localStorage
        const existingInvites = JSON.parse(localStorage.getItem('inviteLinks') || '[]');
        const invite = existingInvites.find((inv: any) => inv.inviteHash === inviteHash);
        
        if (!invite) return null;
        
        // Check if expired
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
          return null;
        }

        return {
          id: invite.inviteHash,
          roomId: invite.roomId,
          roomCode: '', // Will be filled by component
          inviteHash: invite.inviteHash,
          createdBy: invite.createdBy,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          clickCount: 0,
          isActive: true,
          metadata: {}
        };
      }
    );
  }
}

export const apiService = new ApiService(); 