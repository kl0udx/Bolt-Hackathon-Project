import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const url = new URL(req.url)
    const roomId = url.searchParams.get('roomId')

    if (!roomId) {
      return new Response(
        JSON.stringify({ error: 'Room ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get cursor positions from participants table
    const { data, error } = await supabase
      .from('participants')
      .select(`
        user_id,
        display_name,
        user_color,
        avatar_emoji,
        cursor_x,
        cursor_y,
        cursor_updated_at,
        current_platform,
        is_online
      `)
      .eq('room_id', roomId)
      .eq('is_online', true)
      .order('cursor_updated_at', { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform to cursor format
    const cursors = data?.map(p => ({
      userId: p.user_id,
      displayName: p.display_name || 'Anonymous',
      userColor: p.user_color || '#6366f1',
      avatarEmoji: p.avatar_emoji || '🖱️',
      x: p.cursor_x,
      y: p.cursor_y,
      updatedAt: p.cursor_updated_at,
      platform: p.current_platform,
      isOnline: p.is_online
    })) || []

    return new Response(
      JSON.stringify({ cursors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 