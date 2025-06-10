import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface AddTestParticipantRequest {
  roomId: string;
  userId: string;
  displayName: string;
  userColor: string;
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

    const { roomId, userId, displayName, userColor }: AddTestParticipantRequest = await req.json();

    if (!roomId || !userId || !displayName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if participant already exists in this specific room
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('id')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .single();

    if (existingParticipant) {
      return new Response(JSON.stringify({ success: true, message: 'Participant already exists in room' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add test participant
    const { error } = await supabase
      .from('participants')
      .insert({
        room_id: roomId,
        user_id: userId,
        display_name: displayName,
        user_color: userColor,
        is_host: false,
        is_online: true,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      });

    if (error) {
      console.error('Test participant creation error:', error);
      return new Response(JSON.stringify({ error: 'Failed to add test participant' }), {
        status: 500,
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