import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const roomId = url.searchParams.get('roomId');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get files first
    const { data: files, error: filesError } = await supabase
      .from('shared_files')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)); // Cap at 100 files

    if (filesError) {
      console.error('Files fetch error:', filesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch files' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get participant data for uploaders
    const uploaderIds = [...new Set(files.map(file => file.uploader_id))];
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('user_id, display_name, user_color, avatar_emoji')
      .in('user_id', uploaderIds);

    if (participantsError) {
      console.error('Participants fetch error:', participantsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch participant data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a map for quick lookup
    const participantMap = new Map(
      participants.map(p => [p.user_id, p])
    );

    const filesWithUrls = files.map(file => {
      let downloadUrl = null;
      
      if (file.storage_path && file.transfer_type === 'server') {
        const { data: urlData } = supabase.storage
          .from('shared-files')
          .getPublicUrl(file.storage_path);
        downloadUrl = urlData.publicUrl;
      }

      // Get participant data from the map
      const participant = participantMap.get(file.uploader_id);
      const displayName = participant?.display_name || 'Unknown User';
      const userColor = participant?.user_color || '#666666';
      const avatarEmoji = participant?.avatar_emoji || '🐘';

      return {
        id: file.id,
        filename: file.filename,
        originalFilename: file.original_filename,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        downloadUrl,
        thumbnailUrl: file.thumbnail_url,
        transferType: file.transfer_type,
        uploadedBy: {
          userId: file.uploader_id,
          displayName,
          userColor,
          avatarEmoji
        },
        createdAt: file.created_at,
        downloadCount: file.download_count,
        metadata: file.metadata
      };
    });

    return new Response(JSON.stringify({ files: filesWithUrls }), {
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