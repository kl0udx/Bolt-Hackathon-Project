import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface RecordingPermissionRequest {
  recordingSessionId: string;
  userId: string;
  granted: boolean;
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

    const { recordingSessionId, userId, granted }: RecordingPermissionRequest = await req.json();

    if (!recordingSessionId || !userId || granted === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify recording session exists and is requesting permission
    const { data: session, error: sessionError } = await supabase
      .from('recording_sessions')
      .select('room_id, status')
      .eq('id', recordingSessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Recording session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'pending_permission') {
      return new Response(JSON.stringify({ error: 'Recording session not requesting permission' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record permission
    const { error: permissionError } = await supabase
      .from('recording_permissions')
      .upsert({
        recording_session_id: recordingSessionId,
        user_id: userId,
        granted
      }, {
        onConflict: 'recording_session_id,user_id'
      });

    if (permissionError) {
      console.error('Permission recording error:', permissionError);
      return new Response(JSON.stringify({ error: 'Failed to record permission' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if all participants have responded
    const { data: onlineParticipants } = await supabase
      .from('participants')
      .select('user_id')
      .eq('room_id', session.room_id)
      .eq('is_online', true);

    const { data: permissions } = await supabase
      .from('recording_permissions')
      .select('granted')
      .eq('recording_session_id', recordingSessionId);

    if (onlineParticipants && permissions) {
      const totalParticipants = onlineParticipants.length;
      const totalResponses = permissions.length;
      const allGranted = permissions.every(p => p.granted);

      let newStatus = null;

      if (totalResponses === totalParticipants) {
        if (allGranted) {
          // Everyone agreed - start recording
          newStatus = 'recording';
        } else {
          // Someone denied - cancel recording
          newStatus = 'cancelled';
        }

        await supabase
          .from('recording_sessions')
          .update({ 
            status: newStatus,
            started_at: newStatus === 'recording' ? new Date().toISOString() : undefined,
            ended_at: newStatus === 'cancelled' ? new Date().toISOString() : undefined
          })
          .eq('id', recordingSessionId);
      }

      return new Response(JSON.stringify({ 
        success: true,
        status: newStatus || 'waiting_for_responses',
        responsesReceived: totalResponses,
        totalParticipants
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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