import { WebRTCSignalingManager } from '../lib/realtimeWebRTC';

interface ChatInputState {
  userId: string;
  isTyping: boolean;
  lastActivity: number;
}

export class ChatInputService {
  private static readonly IDLE_TIMEOUT = 10000; // 10 seconds
  private static readonly POLL_INTERVAL = 1000; // 1 second
  private pollInterval: NodeJS.Timeout | null = null;
  private signalingManager: WebRTCSignalingManager | null = null;
  private onStateChange: ((state: ChatInputState | null) => void) | null = null;
  private userId: string;
  private hostUserId: string;
  private currentState: ChatInputState | null = null;

  constructor(roomId: string, userId: string, hostUserId: string) {
    this.userId = userId;
    this.hostUserId = hostUserId;
    this.signalingManager = new WebRTCSignalingManager(roomId, userId);
    
    // Set up message handler for chat input state
    this.signalingManager.setDataMessageHandler((fromUserId, message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'chat_input_state') {
          this.currentState = data.state;
          this.onStateChange?.(data.state);
        }
      } catch (error) {
        console.error('Failed to parse chat input state message:', error);
      }
    });
  }

  // Start typing in the chat input
  async startTyping(): Promise<boolean> {
    if (!this.signalingManager) return false;

    try {
      const state: ChatInputState = {
        userId: this.userId,
        isTyping: true,
        lastActivity: Date.now()
      };

      // Send state to the host
      this.signalingManager.sendDataMessage(this.hostUserId, JSON.stringify({
        type: 'chat_input_state',
        state
      }));

      return true;
    } catch (error) {
      console.error('Failed to start typing:', error);
      return false;
    }
  }

  // Stop typing in the chat input
  async stopTyping(): Promise<void> {
    if (!this.signalingManager) return;

    try {
      const state: ChatInputState = {
        userId: this.userId,
        isTyping: false,
        lastActivity: Date.now()
      };

      // Send state to the host
      this.signalingManager.sendDataMessage(this.hostUserId, JSON.stringify({
        type: 'chat_input_state',
        state
      }));
    } catch (error) {
      console.error('Failed to stop typing:', error);
    }
  }

  // Update last activity timestamp
  async updateActivity(): Promise<void> {
    if (!this.signalingManager) return;

    try {
      const state: ChatInputState = {
        userId: this.userId,
        isTyping: true,
        lastActivity: Date.now()
      };

      // Send state to the host
      this.signalingManager.sendDataMessage(this.hostUserId, JSON.stringify({
        type: 'chat_input_state',
        state
      }));
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }

  // Subscribe to chat input state changes
  subscribeToChatInputState(callback: (state: ChatInputState | null) => void) {
    this.onStateChange = (state: ChatInputState | null) => callback(state);
    return () => {
      this.onStateChange = null;
    };
  }

  // Start polling for idle state
  startPolling(onIdle: () => void) {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(() => {
      const now = Date.now();
      if (this.onStateChange) {
        const state = this.currentState as ChatInputState | null;
        this.onStateChange(state);
        if (state && state.userId === this.userId && state.isTyping) {
          if (now - state.lastActivity > ChatInputService.IDLE_TIMEOUT) {
            this.stopTyping();
            onIdle();
          }
        }
      }
    }, ChatInputService.POLL_INTERVAL);
  }

  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Cleanup
  cleanup() {
    this.stopPolling();
    this.signalingManager?.cleanup();
    this.signalingManager = null;
    this.onStateChange = null;
  }
} 