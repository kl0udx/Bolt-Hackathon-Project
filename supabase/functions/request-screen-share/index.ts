import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface RequestScreenShareRequest {
  roomId: string;
  userId: string;
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

    const { roomId, userId }: RequestScreenShareRequest = await req.json();

    if (!roomId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user can start screen sharing (host or with permission)
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

    // Check if there's already an active screen share
    const { data: existingScreenShare } = await supabase
      .from('webrtc_sessions')
      .select('id, status')
      .eq('room_id', roomId)
      .eq('session_type', 'screen_share')
      .in('status', ['active', 'pending_permission'])
      .single();

    if (existingScreenShare) {
      return new Response(JSON.stringify({ 
        error: 'Screen sharing already in progress or pending permission' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all online participants in room
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('user_id, display_name')
      .eq('room_id', roomId)
      .eq('is_online', true);

    if (participantsError) {
      return new Response(JSON.stringify({ error: 'Failed to get participants' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create screen share session with permission request
    const { data: screenShareSession, error } = await supabase
      .from('webrtc_sessions')
      .insert({
        room_id: roomId,
        session_type: 'screen_share',
        host_user_id: userId,
        started_at: new Date().toISOString(),
        is_active: false, // Will be activated when permissions are granted
        metadata: {
          status: 'pending_permission',
          hostName: participant.display_name,
          participantCount: participants.length,
          requestedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Screen share session creation error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create screen share session',
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      sessionId: screenShareSession.id,
      participants: participants.map(p => ({
        userId: p.user_id,
        displayName: p.display_name
      })),
      message: 'Screen share permission request sent to all participants'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});