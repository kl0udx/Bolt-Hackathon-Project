import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface StopRecordingRequest {
  recordingSessionId: string;
  userId: string;
  fileUrl?: string;
  fileSize?: number;
  durationSeconds?: number;
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

    const { 
      recordingSessionId, 
      userId, 
      fileUrl, 
      fileSize, 
      durationSeconds 
    }: StopRecordingRequest = await req.json();

    if (!recordingSessionId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify recording session exists and user has permission to stop it
    const { data: session, error: sessionError } = await supabase
      .from('recording_sessions')
      .select('started_by, room_id, status')
      .eq('id', recordingSessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Recording session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user can stop recording (starter or room host)
    const { data: participant } = await supabase
      .from('participants')
      .select('is_host')
      .eq('user_id', userId)
      .eq('room_id', session.room_id)
      .single();

    const canStop = session.started_by === userId || participant?.is_host;
    
    if (!canStop) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'recording') {
      return new Response(JSON.stringify({ error: 'Recording session is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update recording session
    const updateData: any = {
      status: fileUrl ? 'completed' : 'failed',
      ended_at: new Date().toISOString(),
      file_url: fileUrl,
      file_size: fileSize,
      duration_seconds: durationSeconds,
      twitter_optimized: true // Assume processed for social media
    };

    const { data: updatedSession, error } = await supabase
      .from('recording_sessions')
      .update(updateData)
      .eq('id', recordingSessionId)
      .select()
      .single();

    if (error) {
      console.error('Recording update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to stop recording' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      message: 'Recording stopped successfully',
      recording: {
        id: updatedSession.id,
        status: updatedSession.status,
        downloadUrl: updatedSession.file_url,
        duration: updatedSession.duration_seconds,
        fileSize: updatedSession.file_size
      }
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