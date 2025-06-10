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
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const before = url.searchParams.get('before'); // For pagination

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get messages with pagination support
    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        message_type,
        created_at,
        edited_at,
        user_id,
        reply_to,
        file_data
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(Math.min(limit, 200)); // Cap at 200 messages

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Messages fetch error:', messagesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all unique user IDs from messages
    const userIds = [...new Set(messages.map(m => m.user_id))];
    
    // Get user data for all users
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('user_id, display_name, user_color, avatar_emoji')
      .in('user_id', userIds);

    if (participantsError) {
      console.error('Participants fetch error:', participantsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user lookup map
    const userMap = new Map(participants.map(p => [p.user_id, p]));

    // Get reply messages if any
    const replyIds = messages.filter(m => m.reply_to).map(m => m.reply_to);
    let replyMessages = [];
    
    if (replyIds.length > 0) {
      const { data: replies } = await supabase
        .from('messages')
        .select('id, content, message_type, file_data, user_id')
        .in('id', replyIds);
      
      replyMessages = replies || [];
    }

    const replyMap = new Map(replyMessages.map(r => [r.id, r]));

    // Get reactions for all messages
    const messageIds = messages.map(m => m.id);
    let reactions = [];
    
    if (messageIds.length > 0) {
      const { data: messageReactions } = await supabase
        .from('message_reactions')
        .select(`
          message_id,
          emoji,
          user_id
        `)
        .in('message_id', messageIds);
      
      reactions = messageReactions || [];
    }

    // Group reactions by message
    const reactionMap = new Map();
    reactions.forEach(reaction => {
      if (!reactionMap.has(reaction.message_id)) {
        reactionMap.set(reaction.message_id, {});
      }
      const messageReactions = reactionMap.get(reaction.message_id);
      if (!messageReactions[reaction.emoji]) {
        messageReactions[reaction.emoji] = [];
      }
      const user = userMap.get(reaction.user_id);
      if (user) {
        messageReactions[reaction.emoji].push({
          userId: reaction.user_id,
          displayName: user.display_name,
          userColor: user.user_color
        });
      }
    });

    // Format messages with user data, replies, and reactions
    const formattedMessages = messages.map(message => {
      const user = userMap.get(message.user_id);
      const reply = message.reply_to ? replyMap.get(message.reply_to) : null;
      
      return {
        id: message.id,
        content: message.content,
        messageType: message.message_type,
        created_at: message.created_at,
        editedAt: message.edited_at,
        fileData: message.file_data,
        user: {
          userId: message.user_id,
          displayName: user?.display_name || 'Unknown User',
          userColor: user?.user_color || '#666666',
          avatarEmoji: user?.avatar_emoji || '🐘'
        },
        replyTo: reply ? {
          id: reply.id,
          content: reply.content,
          messageType: reply.message_type,
          fileData: reply.file_data,
          user: {
            displayName: userMap.get(reply.user_id)?.display_name || 'Unknown User',
            userColor: userMap.get(reply.user_id)?.user_color || '#666666'
          }
        } : null,
        reactions: reactionMap.get(message.id) || {}
      };
    });

    return new Response(JSON.stringify({ 
      messages: formattedMessages,
      hasMore: messages.length === limit
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