import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Simple file validation with reasonable limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp4', '.webm', '.avi', '.mov',
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
  '.js', '.ts', '.css', '.html', '.json', '.xml', '.py'
];

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.jar',
  '.msi', '.app', '.deb', '.pkg', '.dmg', '.run', '.dll', '.sys'
];

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

function validateFile(filename: string, size: number): { isValid: boolean; error?: string } {
  const extension = getFileExtension(filename);
  
  // Check blocked types
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: `File type ${extension} is blocked for security reasons` };
  }

  // Check file size
  if (size > MAX_FILE_SIZE) {
    return { isValid: false, error: `File too large. Maximum size is 100MB` };
  }

  // Check allowed types
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: `File type ${extension} is not supported` };
  }

  return { isValid: true };
}

function generateSafeFilename(originalName: string): string {
  const extension = getFileExtension(originalName);
  const nameWithoutExt = originalName.slice(0, originalName.lastIndexOf('.')) || originalName;
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
  const timestamp = Date.now();
  return `${timestamp}_${safeName}${extension}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('📤 Upload request received');
    
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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const roomId = formData.get('roomId') as string;
    const userId = formData.get('userId') as string;

    if (!file || !roomId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file
    const validation = validateFile(file.name, file.size);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user info
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, display_name, user_color')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return new Response(JSON.stringify({ error: 'User not found in room' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create bucket if it doesn't exist
    try {
      const { data: bucket } = await supabase.storage.getBucket('shared-files');
      if (!bucket) {
        await supabase.storage.createBucket('shared-files', { public: true });
      }
    } catch (bucketError) {
      console.log('Bucket creation attempted, continuing...');
    }

    // Upload file
    const safeFilename = generateSafeFilename(file.name);
    const filePath = `${roomId}/${safeFilename}`;
    
    const fileBuffer = await file.arrayBuffer();
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shared-files')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shared-files')
      .getPublicUrl(filePath);

    // Save to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('shared_files')
      .insert({
        room_id: roomId,
        uploader_id: userId,
        filename: safeFilename,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: uploadData.path,
        transfer_type: 'server'
      })
      .select('*')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('shared-files').remove([filePath]);
      return new Response(JSON.stringify({ error: 'Failed to save file metadata' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = {
      fileId: fileRecord.id,
      filename: fileRecord.filename,
      originalFilename: fileRecord.original_filename,
      fileSize: fileRecord.file_size,
      mimeType: fileRecord.mime_type,
      downloadUrl: urlData.publicUrl,
      thumbnailUrl: null,
      transferType: 'server',
      uploadedBy: {
        userId,
        displayName: participant.display_name,
        userColor: participant.user_color
      },
      createdAt: fileRecord.created_at
    };

    return new Response(JSON.stringify(response), {
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