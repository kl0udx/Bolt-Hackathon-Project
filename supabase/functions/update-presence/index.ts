import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface UpdatePresenceRequest {
  userId: string;
  isOnline?: boolean;
  isTyping?: boolean;
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

    const { userId, isOnline, isTyping }: UpdatePresenceRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Updating presence for user:', userId, { isOnline, isTyping });

    // First get current participant data
    const { data: currentParticipant, error: fetchError } = await supabase
      .from('participants')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch current participant:', fetchError);
      return new Response(JSON.stringify({ error: 'Participant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updateData: any = {
      last_seen: new Date().toISOString()
    };

    if (isOnline !== undefined) {
      updateData.is_online = isOnline;
    }

    // Handle metadata updates properly
    if (isTyping !== undefined) {
      const currentMetadata = currentParticipant.metadata || {};
      updateData.metadata = {
        ...currentMetadata,
        isTyping: isTyping
      };
      console.log('Setting metadata to:', updateData.metadata);
    }

    const { data: updatedParticipant, error } = await supabase
      .from('participants')
      .update(updateData)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      console.error('Presence update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update presence' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Presence updated successfully:', updatedParticipant);

    return new Response(JSON.stringify({ 
      success: true, 
      participant: updatedParticipant 
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