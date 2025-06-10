import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface JoinRoomRequest {
  displayName?: string;
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

    const url = new URL(req.url);
    const roomCode = url.searchParams.get('roomCode');
    const { displayName }: JoinRoomRequest = await req.json();

    if (!roomCode) {
      return new Response(JSON.stringify({ error: 'Room code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get room details
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (roomError || !room) {
      return new Response(JSON.stringify({ error: 'Room not found or inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if room has expired
    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    if (now > expiresAt) {
      return new Response(JSON.stringify({ error: 'Room has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check room capacity (now 8 people for optimal WebRTC performance)
    const { count: participantCount } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (participantCount && participantCount >= room.max_participants) {
      return new Response(JSON.stringify({ 
        error: `Room is full (maximum ${room.max_participants} participants for optimal WebRTC performance)` 
      }), {
        status: 423,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const userIdentity = generateUserIdentity(displayName);
    const userId = crypto.randomUUID();
    const nowTimestamp = new Date().toISOString();

    // Add participant with cursor tracking
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        user_id: userId,
        display_name: userIdentity.displayName,
        user_color: userIdentity.userColor,
        avatar_emoji: userIdentity.avatarEmoji,
        is_host: false,
        is_online: true,
        joined_at: nowTimestamp,
        last_seen: nowTimestamp,
        cursor_x: 0,
        cursor_y: 0,
        cursor_updated_at: nowTimestamp
      })
      .select()
      .single();

    if (participantError) {
      console.error('Participant creation error:', participantError);
      return new Response(JSON.stringify({ error: 'Failed to join room' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = {
      userId: participant.user_id,
      displayName: participant.display_name,
      userColor: participant.user_color,
      avatarEmoji: participant.avatar_emoji,
      roomId: room.id,
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