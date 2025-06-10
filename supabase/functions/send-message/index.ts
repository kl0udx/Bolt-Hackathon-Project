import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SendMessageRequest {
  roomId: string;
  userId: string;
  content: string;
  messageType?: 'text' | 'file' | 'system' | 'image';
  replyTo?: string;
  fileData?: {
    filename: string;
    size: number;
    mimeType: string;
    url?: string;
    type: 'image' | 'document' | 'video' | 'audio' | 'archive' | 'code' | 'other';
  };
}

// File validation constants (updated with 500MB limits)
const ALLOWED_FILE_TYPES = {
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  document: {
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.rtf'],
    mimeTypes: [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/markdown', 'application/rtf'
    ],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  archive: {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  video: {
    extensions: ['.mp4', '.webm', '.avi', '.mov', '.wmv', '.flv', '.mkv'],
    mimeTypes: ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/x-matroska'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  audio: {
    extensions: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  code: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.html', '.json', '.xml', '.yaml', '.yml', '.py', '.java', '.cpp', '.c', '.php'],
    mimeTypes: ['application/javascript', 'text/javascript', 'application/typescript', 'text/css', 'text/html', 'application/json', 'application/xml', 'text/xml'],
    maxSize: 500 * 1024 * 1024, // 500MB
  }
};

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.app', '.deb', '.pkg', '.dmg', '.run', '.msi', '.dll', '.sys', '.drv'];
const BLOCKED_MIME_TYPES = ['application/x-msdownload', 'application/x-executable', 'application/x-msdos-program', 'application/x-java-archive'];

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

function validateFileData(fileData: any): { isValid: boolean; error?: string } {
  if (!fileData.filename || !fileData.size || !fileData.mimeType) {
    return { isValid: false, error: 'Invalid file data' };
  }

  const extension = getFileExtension(fileData.filename);
  
  // Check blocked types
  if (BLOCKED_EXTENSIONS.includes(extension) || BLOCKED_MIME_TYPES.includes(fileData.mimeType)) {
    return { isValid: false, error: 'File type blocked for security reasons' };
  }

  // Check file size (500MB absolute limit)
  if (fileData.size > 500 * 1024 * 1024) {
    return { isValid: false, error: 'File too large (max 500MB)' };
  }

  // Validate against allowed types
  for (const [type, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (config.extensions.includes(extension) || config.mimeTypes.includes(fileData.mimeType)) {
      if (fileData.size > config.maxSize) {
        const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
        return { isValid: false, error: `File too large for ${type} files (max ${maxSizeMB}MB)` };
      }
      return { isValid: true };
    }
  }

  return { isValid: false, error: 'Unsupported file type' };
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

    const { roomId, userId, content, messageType = 'text', replyTo, fileData }: SendMessageRequest = await req.json();

    // Validate input
    if (!roomId || !userId || (!content?.trim() && !fileData)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate message length for text messages
    if (messageType === 'text' && content && content.length > 2000) {
      return new Response(JSON.stringify({ error: 'Message too long (max 2000 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is in the room
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, display_name, user_color, avatar_emoji')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return new Response(JSON.stringify({ error: 'User not found in room' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file data if present
    if (fileData) {
      const validation = validateFileData(fileData);
      if (!validation.isValid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        content: content?.trim() || (fileData ? `Shared ${fileData.filename}` : ''),
        message_type: messageType,
        reply_to: replyTo || null,
        file_data: fileData || null
      })
      .select('*')
      .single();

    if (messageError) {
      console.error('Message creation error:', messageError);
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get reply message if exists
    let replyMessage = null;
    if (replyTo) {
      const { data: reply } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          message_type,
          file_data,
          user_id
        `)
        .eq('id', replyTo)
        .single();
      
      if (reply) {
        const { data: replyUser } = await supabase
          .from('participants')
          .select('display_name, user_color')
          .eq('user_id', reply.user_id)
          .single();

        replyMessage = {
          id: reply.id,
          content: reply.content,
          messageType: reply.message_type,
          fileData: reply.file_data,
          user: { 
            displayName: replyUser?.display_name || 'Unknown User',
            userColor: replyUser?.user_color || '#666666'
          }
        };
      }
    }

    const response = {
      message: {
        id: message.id,
        content: message.content,
        messageType: message.message_type,
        created_at: message.created_at,
        fileData: message.file_data,
        user: {
          userId: participant.user_id,
          displayName: participant.display_name,
          userColor: participant.user_color,
          avatarEmoji: participant.avatar_emoji
        },
        replyTo: replyMessage,
        reactions: {}
      }
    };

    return new Response(JSON.stringify(response), {
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