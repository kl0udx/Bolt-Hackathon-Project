import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface StartScreenShareRequest {
  roomId: string;
  userId: string;
  metadata?: {
    resolution?: string;
    frameRate?: number;
    hasAudio?: boolean;
  };
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

    const { roomId, userId, metadata = {} }: StartScreenShareRequest = await req.json();

    if (!roomId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is in the room
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('is_host, display_name')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .single();

    if (participantError || !participant) {
      return new Response(JSON.stringify({ error: 'User not in room' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there's already an active screen share session
    const { data: existingSession } = await supabase
      .from('webrtc_sessions')
      .select('id, host_user_id')
      .eq('room_id', roomId)
      .eq('session_type', 'screen_share')
      .eq('is_active', true)
      .single();

    if (existingSession && existingSession.host_user_id !== userId) {
      return new Response(JSON.stringify({ 
        error: 'Another user is already sharing their screen' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // End any existing screen share sessions for this user
    await supabase
      .from('webrtc_sessions')
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString() 
      })
      .eq('room_id', roomId)
      .eq('host_user_id', userId)
      .eq('session_type', 'screen_share')
      .eq('is_active', true);

    // Create new screen share session
    const { data: session, error } = await supabase
      .from('webrtc_sessions')
      .insert({
        room_id: roomId,
        session_type: 'screen_share',
        host_user_id: userId,
        metadata: {
          resolution: metadata.resolution || '1920x1080',
          frameRate: metadata.frameRate || 30,
          hasAudio: metadata.hasAudio || false,
          hostName: participant.display_name
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Session creation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to start screen share' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      sessionId: session.id,
      message: 'Screen share session started',
      metadata: session.metadata
    }), {
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