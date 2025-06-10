import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ScreenSharePermissionRequest {
  sessionId: string;
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

    const { sessionId, userId, granted }: ScreenSharePermissionRequest = await req.json();

    if (!sessionId || !userId || granted === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify screen share session exists and is requesting permission
    const { data: session, error: sessionError } = await supabase
      .from('webrtc_sessions')
      .select('room_id, metadata')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Screen share session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.metadata?.status !== 'pending_permission') {
      return new Response(JSON.stringify({ error: 'Screen share session not requesting permission' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a screen share permissions table entry (similar to recording permissions)
    const { error: permissionError } = await supabase
      .from('screen_share_permissions')
      .upsert({
        session_id: sessionId,
        user_id: userId,
        granted
      }, {
        onConflict: 'session_id,user_id'
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
      .from('screen_share_permissions')
      .select('granted')
      .eq('session_id', sessionId);

    if (onlineParticipants && permissions) {
      const totalParticipants = onlineParticipants.length;
      const totalResponses = permissions.length;
      const allGranted = permissions.every(p => p.granted);

      let newStatus = null;
      let isActive = false;

      if (totalResponses === totalParticipants) {
        if (allGranted) {
          // Everyone agreed - activate screen sharing
          newStatus = 'active';
          isActive = true;
        } else {
          // Someone denied - cancel screen sharing
          newStatus = 'cancelled';
          isActive = false;
        }

        await supabase
          .from('webrtc_sessions')
          .update({ 
            is_active: isActive,
            metadata: {
              ...session.metadata,
              status: newStatus,
              permissionGrantedAt: allGranted ? new Date().toISOString() : undefined,
              cancelledAt: !allGranted ? new Date().toISOString() : undefined
            }
          })
          .eq('id', sessionId);
      }

      return new Response(JSON.stringify({ 
        success: true,
        status: newStatus || 'waiting_for_responses',
        responsesReceived: totalResponses,
        totalParticipants,
        canProceed: allGranted && totalResponses === totalParticipants
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