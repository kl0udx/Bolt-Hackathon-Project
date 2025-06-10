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
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get file record
    const { data: file, error } = await supabase
      .from('shared_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !file) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment download count
    await supabase
      .from('shared_files')
      .update({ download_count: file.download_count + 1 })
      .eq('id', fileId);

    if (file.transfer_type === 'server' && file.storage_path) {
      // Get signed URL for download
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('shared-files')
        .createSignedUrl(file.storage_path, 3600); // 1 hour expiry

      if (urlError) {
        console.error('Signed URL error:', urlError);
        // Fallback to public URL
        const { data: publicUrlData } = supabase.storage
          .from('shared-files')
          .getPublicUrl(file.storage_path);
        
        return Response.redirect(publicUrlData.publicUrl);
      }

      return Response.redirect(signedUrlData.signedUrl);
    } else {
      // P2P file - return metadata for WebRTC transfer
      return new Response(JSON.stringify({
        fileId: file.id,
        filename: file.original_filename,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        transferType: 'p2p',
        metadata: file.metadata
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Download failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});