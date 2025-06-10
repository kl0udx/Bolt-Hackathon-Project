import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface WebRTCSignal {
  roomId: string;
  fromUserId: string;
  toUserId: string;
  signalType: string;
  signalData: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    if (req.method === 'POST') {
      // Store a new WebRTC signal
      const signal: WebRTCSignal = await req.json();
      
      console.log('📡 Storing WebRTC signal:', {
        type: signal.signalType,
        from: signal.fromUserId,
        to: signal.toUserId,
        room: signal.roomId
      });

      // Set expiration time (5 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      const { error } = await supabaseClient
        .from('webrtc_signals')
        .insert({
          room_id: signal.roomId,
          from_peer: signal.fromUserId,
          to_peer: signal.toUserId,
          signal_type: signal.signalType,
          signal_data: signal.signalData,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.error('❌ Failed to store signal:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } else if (req.method === 'GET') {
      // Retrieve pending signals for a user
      const url = new URL(req.url);
      const roomId = url.searchParams.get('roomId');
      const userId = url.searchParams.get('userId');

      if (!roomId || !userId) {
        return new Response(
          JSON.stringify({ error: 'Missing roomId or userId parameter' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      console.log('📡 Retrieving signals for user:', userId, 'in room:', roomId);

      // Get all pending signals for this user
      const { data: signals, error } = await supabaseClient
        .from('webrtc_signals')
        .select('*')
        .eq('room_id', roomId)
        .eq('to_peer', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to retrieve signals:', error);
        throw error;
      }

      // Delete the retrieved signals (they've been consumed)
      if (signals && signals.length > 0) {
        const signalIds = signals.map(s => s.id);
        await supabaseClient
          .from('webrtc_signals')
          .delete()
          .in('id', signalIds);

        console.log('📡 Retrieved and deleted', signals.length, 'signals');
      }

      return new Response(
        JSON.stringify({ signals: signals || [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );

  } catch (error) {
    console.error('❌ WebRTC Signal function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});