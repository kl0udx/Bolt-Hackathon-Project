import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface CreateRoomRequest {
  hostName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { hostName }: CreateRoomRequest = await req.json();

    // Generate room code
    const generateRoomCode = (): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Generate user identity with enhanced features
    const generateUserIdentity = (customName?: string) => {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ];
      const adjectives = [
        'Swift', 'Brave', 'Clever', 'Gentle', 'Mighty', 'Wise', 'Bold', 'Kind',
        'Noble', 'Bright', 'Quick', 'Strong', 'Smart', 'Cool', 'Wild', 'Free'
      ];
      const animals = [
        'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Panda', 'Wolf', 'Fox', 'Bear',
        'Hawk', 'Whale', 'Rabbit', 'Deer', 'Owl', 'Shark', 'Falcon', 'Turtle'
      ];
      const emojis = [
        '🐘', '🦁', '🐯', '🐺', '🦊', '🐻', '🐼', '🐨', '🐸', '🐙',
        '🦅', '🦆', '🐧', '🦋', '🐝', '🐞', '🦄', '🐲', '🦖', '🐳'
      ];
      
      const userColor = colors[Math.floor(Math.random() * colors.length)];
      const avatarEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      if (customName && customName.trim()) {
        return {
          displayName: customName.trim(),
          userColor,
          avatarEmoji
        };
      }
      
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const animal = animals[Math.floor(Math.random() * animals.length)];
      
      return {
        displayName: `${adjective} ${animal}`,
        userColor,
        avatarEmoji
      };
    };

    let roomCode = generateRoomCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure unique room code
    while (attempts < maxAttempts) {
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();

      if (!existingRoom) break;
      roomCode = generateRoomCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(JSON.stringify({ error: 'Unable to generate unique room code' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate single UUID for the host user
    const hostUserId = crypto.randomUUID();

    // Create room with enhanced settings and 8 person limit for optimal WebRTC performance
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        host_user_id: hostUserId,
        max_participants: 8, // Reduced from 20 to 8 for optimal WebRTC performance
        is_active: true,
        settings: {
          allowScreenShare: true,
          allowRecording: true,
          allowFileSharing: true,
          allowCursorTracking: true,
          maxFileSize: 104857600,
          cursorUpdateInterval: 100,
          webrtcOptimized: true // Flag to indicate WebRTC optimization
        }
      })
      .select()
      .single();

    if (roomError) {
      console.error('Room creation error:', roomError);
      return new Response(JSON.stringify({ error: 'Failed to create room' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate host identity
    const hostIdentity = generateUserIdentity(hostName);
    const now = new Date().toISOString();

    // Add host as participant with cursor tracking
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        user_id: hostUserId,
        display_name: hostIdentity.displayName,
        user_color: hostIdentity.userColor,
        avatar_emoji: hostIdentity.avatarEmoji,
        is_host: true,
        is_online: true,
        joined_at: now,
        last_seen: now,
        cursor_x: 0,
        cursor_y: 0,
        cursor_updated_at: now
      })
      .select()
      .single();

    if (participantError) {
      console.error('Participant creation error:', participantError);
      return new Response(JSON.stringify({ error: 'Failed to add host to room' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = {
      roomCode: room.room_code,
      roomId: room.id,
      userId: participant.user_id,
      displayName: participant.display_name,
      userColor: participant.user_color,
      avatarEmoji: participant.avatar_emoji,
      expiresAt: room.expires_at,
      settings: room.settings,
      maxParticipants: room.max_participants
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});