import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface RequestRecordingRequest {
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

    const { roomId, userId }: RequestRecordingRequest = await req.json();

    if (!roomId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user can start recording (host or with permission)
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

    if (!participant.is_host) {
      return new Response(JSON.stringify({ error: 'Only room host can start recording' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there's already an active recording
    const { data: existingRecording } = await supabase
      .from('recording_sessions')
      .select('id, status')
      .eq('room_id', roomId)
      .in('status', ['recording', 'pending_permission'])
      .single();

    if (existingRecording) {
      return new Response(JSON.stringify({ 
        error: 'Recording already in progress or pending permission' 
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

    // Create recording session with all required fields
    const { data: recordingSession, error } = await supabase
      .from('recording_sessions')
      .insert({
        room_id: roomId,
        started_by: userId,
        started_at: new Date().toISOString(),
        status: 'pending_permission',
        twitter_optimized: false,
        download_count: 0,
        metadata: {
          hostName: participant.display_name,
          participantCount: participants.length,
          requestedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Recording session creation error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create recording session',
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      recordingSessionId: recordingSession.id,
      participants: participants.map(p => ({
        userId: p.user_id,
        displayName: p.display_name
      })),
      message: 'Recording permission request sent to all participants'
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