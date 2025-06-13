import { WebRTCSignalingManager } from '../lib/realtimeWebRTC';

interface AIRequest {
  type: 'ai_request';
  message: string;
  requestId: string;
  fromUserId: string;
}

interface AIResponse {
  type: 'ai_response';
  content: string;
  requestId: string;
  fromUserId: string;
}

export class AIService {
  private signalingManager: WebRTCSignalingManager | null = null;
  private isHost: boolean;
  private apiKey: string | null = null;
  private pendingRequests: Map<string, (response: string) => void> = new Map();
  private userId: string;
  private hostUserId: string | undefined;

  constructor(roomId: string, userId: string, isHost: boolean, apiKey?: string, hostUserId?: string) {
    this.isHost = isHost;
    this.userId = userId;
    if (isHost && apiKey) {
      this.apiKey = apiKey;
    }
    if (!isHost) {
      if (!hostUserId) {
        throw new Error('hostUserId is required for participants');
      }
      this.hostUserId = hostUserId;
    }

    // Only initialize WebRTC if we're the host or if we need to receive responses
    if (isHost || !isHost) {
      console.log('🔌 Initializing WebRTC for AI Service:', { isHost, userId, hostUserId });
      this.signalingManager = new WebRTCSignalingManager(roomId, userId);
      
      // Set up connection state callback
      this.signalingManager.setConnectionStateCallback(userId, (state) => {
        console.log('🔌 AI Service WebRTC connection state:', { userId, state });
      });
      
      // Set up message handler for AI requests/responses
      this.signalingManager.setDataMessageHandler((fromUserId, message) => {
        console.log('📨 AI Service received message:', { fromUserId, messageType: JSON.parse(message).type });
        try {
          const data = JSON.parse(message);
          
          if (this.isHost) {
            // Host receives requests and sends responses
            if (data.type === 'ai_request') {
              console.log('📥 Host received AI request:', { fromUserId, requestId: data.requestId });
              this.handleAIRequest(data);
            }
          } else {
            // Participants receive responses
            if (data.type === 'ai_response' && data.fromUserId === this.userId) {
              console.log('📥 Participant received AI response:', { requestId: data.requestId });
              const resolve = this.pendingRequests.get(data.requestId);
              if (resolve) {
                resolve(data.content);
                this.pendingRequests.delete(data.requestId);
              }
            }
          }
        } catch (error) {
          console.error('Failed to parse AI message:', error);
        }
      });

      // Start polling for signals
      this.signalingManager.startSignalPolling();
    }
  }

  // For host: Set API key
  setApiKey(apiKey: string) {
    if (this.isHost) {
      this.apiKey = apiKey;
    }
  }

  // For participants: Send request to host
  async sendRequest(message: string): Promise<string> {
    if (!this.signalingManager) {
      console.error('❌ AI Service not connected: signalingManager is null');
      throw new Error('Not connected to room');
    }

    if (this.isHost) {
      console.error('❌ Host attempted to use sendRequest');
      throw new Error('Host should use handleAIRequest directly');
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log('📤 Sending AI request:', { requestId, toHost: this.hostUserId });
    
    // Create a promise that will be resolved when we get the response
    const responsePromise = new Promise<string>((resolve) => {
      this.pendingRequests.set(requestId, resolve);
    });

    // Send the request to the host
    try {
      await this.signalingManager.sendDataMessage(this.hostUserId!, JSON.stringify({
        type: 'ai_request',
        message,
        requestId,
        fromUserId: this.userId
      }));
      console.log('✅ AI request sent successfully');
    } catch (error) {
      console.error('❌ Failed to send AI request:', error);
      this.pendingRequests.delete(requestId);
      throw error;
    }

    // Wait for response with timeout
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        console.error('⏰ AI request timed out:', { requestId });
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timed out'));
      }, 30000); // 30 second timeout
    });

    return Promise.race([responsePromise, timeoutPromise]);
  }

  // For host: Handle incoming requests
  private async handleAIRequest(request: AIRequest) {
    if (!this.isHost || !this.apiKey || !this.signalingManager) {
      return;
    }

    try {
      // Make the actual API call using the host's API key
      const response = await this.makeAIAPICall(request.message);
      
      // Broadcast the response back to the requesting user
      this.signalingManager.sendDataMessage(request.fromUserId, JSON.stringify({
        type: 'ai_response',
        content: response,
        requestId: request.requestId,
        fromUserId: request.fromUserId
      }));
    } catch (error) {
      console.error('Failed to handle AI request:', error);
      // Broadcast error response
      this.signalingManager.sendDataMessage(request.fromUserId, JSON.stringify({
        type: 'ai_response',
        content: 'Sorry, there was an error processing your request.',
        requestId: request.requestId,
        fromUserId: request.fromUserId
      }));
    }
  }

  // For host: Make actual API call
  private async makeAIAPICall(message: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key available');
    }

    // TODO: Implement actual API call to OpenAI/other providers
    // This is where you'd use the host's API key to make the request
    // For now, returning a mock response
    return `Mock response to: ${message}`;
  }

  cleanup() {
    this.signalingManager?.cleanup();
    this.signalingManager = null;
    this.pendingRequests.clear();
  }
} 