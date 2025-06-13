import { useState, useEffect, useCallback, useRef } from 'react';
import { WebRTCSignalingManager } from '../lib/realtimeWebRTC';

export function useWebRTC(roomId: string, userId: string) {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const signalingManagerRef = useRef<WebRTCSignalingManager | null>(null);

  // Initialize WebRTC connection
  useEffect(() => {
    if (!roomId || !userId) return;

    const manager = new WebRTCSignalingManager(roomId, userId);
    signalingManagerRef.current = manager;

    // Set up message handler using data channels
    const handleDataChannel = (event: MessageEvent) => {
      try {
        const message = event.data;
        setLastMessage(message);
      } catch (error) {
        console.error('Failed to handle data channel message:', error);
      }
    };

    // Set up connection state callback
    manager.setConnectionStateCallback(userId, (state) => {
      setIsConnected(state === 'connected');
    });

    // Start polling for signals
    const stopPolling = manager.startSignalPolling();

    return () => {
      stopPolling();
      manager.cleanup();
      signalingManagerRef.current = null;
    };
  }, [roomId, userId]);

  // Send message via send-message endpoint
  const sendMessage = useCallback(async (message: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          roomId,
          userId,
          content: message,
          messageType: 'text'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const data = await response.json();
      setLastMessage(data.message.content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [roomId, userId]);

  return {
    sendMessage,
    lastMessage,
    isConnected
  };
} 