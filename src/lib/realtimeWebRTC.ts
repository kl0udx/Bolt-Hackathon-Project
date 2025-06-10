import { supabase } from './supabase';
import { WebRTCSession, RecordingSession } from '../services/webrtcService';
import { debugLogger } from '../utils/debugLogger';
import { networkMonitor } from '../utils/networkMonitor';
import { 
  webrtcConfig, 
  connectionTimeouts, 
  retryConfig, 
  validateWebRTCEnvironment, 
  logWebRTCConfig,
  getAdaptiveConfig 
} from '../config/webrtcConfig';

export function subscribeToWebRTCEvents(roomId: string, callbacks: {
  onScreenShareStarted?: (session: WebRTCSession) => void;
  onScreenShareStopped?: (sessionId: string) => void;
  onRecordingRequested?: (session: RecordingSession) => void;
  onRecordingStarted?: (sessionId: string) => void;
  onRecordingStopped?: (sessionId: string, fileUrl?: string) => void;
}) {

  
  const channel = supabase.channel(`webrtc_events_${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: roomId }
    }
  });

  // Screen sharing events
  if (callbacks.onScreenShareStarted) {
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'webrtc_sessions',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if (payload.new.session_type === 'screen_share' && payload.new.is_active) {
        callbacks.onScreenShareStarted!({
          id: payload.new.id,
          roomId: payload.new.room_id,
          sessionType: payload.new.session_type,
          hostUserId: payload.new.host_user_id,
          startedAt: payload.new.started_at,
          endedAt: payload.new.ended_at,
          isActive: payload.new.is_active,
          metadata: payload.new.metadata
        });
      }
    });
  }

  if (callbacks.onScreenShareStopped) {
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'webrtc_sessions',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if (payload.new.session_type === 'screen_share' && 
          payload.old.is_active && !payload.new.is_active) {
        callbacks.onScreenShareStopped!(payload.new.id);
      }
    });
  }



  // Recording events
  if (callbacks.onRecordingRequested) {
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'recording_sessions',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if (payload.new.status === 'pending_permission') {
        console.log('🎬 Recording permission requested:', payload.new);
        callbacks.onRecordingRequested!({
          id: payload.new.id,
          roomId: payload.new.room_id,
          startedBy: payload.new.started_by,
          startedAt: payload.new.started_at,
          endedAt: payload.new.ended_at,
          durationSeconds: payload.new.duration_seconds,
          fileUrl: payload.new.file_url,
          fileSize: payload.new.file_size,
          status: payload.new.status,
          twitterOptimized: payload.new.twitter_optimized,
          downloadCount: payload.new.download_count,
          metadata: payload.new.metadata
        });
      }
    });
  }

  if (callbacks.onRecordingStarted) {
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'recording_sessions',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if (payload.new.status === 'recording' && payload.old.status !== 'recording') {
        console.log('🎬 Recording started:', payload.new.id);
        callbacks.onRecordingStarted!(payload.new.id);
      }
    });
  }

  if (callbacks.onRecordingStopped) {
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'recording_sessions',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if ((payload.new.status === 'completed' || payload.new.status === 'failed') && 
          payload.old.status === 'recording') {
        console.log('🎬 Recording stopped:', payload.new.id);
        callbacks.onRecordingStopped!(payload.new.id, payload.new.file_url);
      }
    });
  }

  return channel.subscribe((status) => {
    console.log('🎥 WebRTC events subscription status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('✅ WebRTC events: SUCCESSFULLY SUBSCRIBED');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ WebRTC events: SUBSCRIPTION FAILED');
    }
  });
}

// Enhanced WebRTC Signaling Manager with improved stream management
export class WebRTCSignalingManager {
  private roomId: string;
  private userId: string;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private onRemoteStream?: (stream: MediaStream, userId: string) => void;
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 3;
  private isScreenSharing = false;
  private streamEndedHandler: (() => void) | null = null;
  private signalPollingInterval: NodeJS.Timeout | null = null;
  private connectionStateCallbacks = new Map<string, (state: RTCPeerConnectionState) => void>();
  
  // Enhanced signaling state tracking
  private signalRetryAttempts = new Map<string, number>();
  private maxSignalRetries = 3;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat = new Map<string, number>();
  private heartbeatTimeout = 30000; // 30 seconds
  private adaptivePollingInterval = 1000; // Start with 1 second
  private pollingBackoffMultiplier = 1.5;
  private maxPollingInterval = 5000; // Max 5 seconds
  private isPollingActive = false;
  private consecutivePollingErrors = 0;
  private lastPollingSuccess = Date.now();

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    
    // Validate WebRTC environment on initialization
    const validation = validateWebRTCEnvironment();
    if (!validation.valid) {
      debugLogger.error('webrtc', 'WebRTC environment validation failed', {
        issues: validation.issues,
        warnings: validation.warnings
      });
    } else if (validation.warnings.length > 0) {
      debugLogger.warn('webrtc', 'WebRTC environment warnings', {
        warnings: validation.warnings
      });
    }
    
    // Log configuration in debug mode
    logWebRTCConfig();
    
    // Use configuration values from webrtcConfig
    this.maxReconnectAttempts = retryConfig.maxAttempts;
    this.maxSignalRetries = retryConfig.maxAttempts;
    this.heartbeatTimeout = connectionTimeouts.connection;
    this.adaptivePollingInterval = retryConfig.initialDelay;
    this.pollingBackoffMultiplier = retryConfig.backoffMultiplier;
    this.maxPollingInterval = retryConfig.maxDelay;
    
    debugLogger.info('webrtc', 'WebRTC SignalingManager initialized', {
      roomId,
      userId,
      maxReconnectAttempts: this.maxReconnectAttempts,
      heartbeatTimeout: this.heartbeatTimeout,
      validation: validation.valid ? 'passed' : 'failed'
    });
    
    this.startHeartbeat();
  }

  setOnRemoteStream(callback: (stream: MediaStream, userId: string) => void) {
    this.onRemoteStream = callback;
  }

  setLocalStream(stream: MediaStream) {
    console.log('🖥️ Setting local stream in signaling manager');
    
    // Stop previous stream if exists
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    this.localStream = stream;
    this.isScreenSharing = true;
    
    // Replace tracks in existing connections
    this.peerConnections.forEach(pc => {
      this.replaceTracksInConnection(pc, stream);
    });

    // Set up stream ended handler with proper cleanup
    this.setupStreamEndedHandler(stream);
  }

  private setupStreamEndedHandler(stream: MediaStream) {
    // Remove previous handler if exists
    if (this.streamEndedHandler) {
      this.streamEndedHandler();
    }

    const handleStreamEnded = () => {
      console.log('🖥️ Local stream ended, attempting to maintain connections...');
      
      if (this.isScreenSharing) {
        // Don't immediately close - try to get a new stream
        this.attemptStreamRecovery();
      }
    };

    // Set up handlers for all tracks
    const trackEndedHandlers: (() => void)[] = [];
    stream.getTracks().forEach(track => {
      const handler = () => handleStreamEnded();
      track.addEventListener('ended', handler);
      trackEndedHandlers.push(() => track.removeEventListener('ended', handler));
    });

    // Store cleanup function
    this.streamEndedHandler = () => {
      trackEndedHandlers.forEach(cleanup => cleanup());
    };
  }

  private async attemptStreamRecovery() {
    console.log('🔄 Attempting stream recovery...');
    
    try {
      // Try to get a new screen share stream
      const newStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      console.log('✅ Stream recovery successful');
      this.setLocalStream(newStream);
      
    } catch (error) {
      console.log('❌ Stream recovery failed - user likely stopped sharing:', error);
      this.stopScreenShare();
    }
  }

  private replaceTracksInConnection(pc: RTCPeerConnection, newStream: MediaStream) {
    console.log('🔄 Replacing tracks in peer connection');
    
    const senders = pc.getSenders();
    
    // Replace video track
    const videoTrack = newStream.getVideoTracks()[0];
    const videoSender = senders.find(s => s.track?.kind === 'video');
    if (videoSender && videoTrack) {
      videoSender.replaceTrack(videoTrack).catch(error => {
        console.error('Failed to replace video track:', error);
        // If replace fails, try to add new track
        pc.addTrack(videoTrack, newStream);
      });
    } else if (videoTrack) {
      pc.addTrack(videoTrack, newStream);
    }

    // Replace audio track
    const audioTrack = newStream.getAudioTracks()[0];
    const audioSender = senders.find(s => s.track?.kind === 'audio');
    if (audioSender && audioTrack) {
      audioSender.replaceTrack(audioTrack).catch(error => {
        console.error('Failed to replace audio track:', error);
        // If replace fails, try to add new track
        pc.addTrack(audioTrack, newStream);
      });
    } else if (audioTrack) {
      pc.addTrack(audioTrack, newStream);
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      // Enhanced screen sharing options with better error handling
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.setLocalStream(stream);
      console.log('🖥️ Screen share started locally with enhanced options');
      
      return stream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  }

  stopScreenShare() {
    console.log('🛑 Stopping screen share in signaling manager');
    
    this.isScreenSharing = false;
    
    // Clean up stream ended handler
    if (this.streamEndedHandler) {
      this.streamEndedHandler();
      this.streamEndedHandler = null;
    }
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }

    // Close all peer connections gracefully
    this.peerConnections.forEach((pc, userId) => {
      try {
        pc.close();
        console.log(`🔌 Closed connection to ${userId}`);
      } catch (error) {
        console.error(`Failed to close connection to ${userId}:`, error);
      }
    });
    
    this.peerConnections.clear();
    this.reconnectAttempts.clear();

    console.log('🖥️ Screen share stopped locally');
  }

  async connectToPeer(targetUserId: string): Promise<void> {
    if (!this.localStream) {
      throw new Error('No local stream available');
    }

    console.log(`🤝 Connecting to peer: ${targetUserId}`);
    
    try {
      await this.createOffer(targetUserId);
    } catch (error) {
      console.error(`Failed to connect to peer ${targetUserId}:`, error);
      throw error;
    }
  }

  async createOffer(targetUserId: string): Promise<void> {
    if (!this.localStream) {
      throw new Error('No local stream available');
    }

    console.log(`📤 Creating offer for ${targetUserId}`);
    
    // Close existing connection if any
    const existingPc = this.peerConnections.get(targetUserId);
    if (existingPc) {
      existingPc.close();
    }

    const pc = this.createPeerConnection(targetUserId);
    this.peerConnections.set(targetUserId, pc);

    // Add local stream tracks
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
      console.log(`➕ Added ${track.kind} track to connection`);
    });

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await pc.setLocalDescription(offer);
      console.log(`📤 Offer created and set for ${targetUserId}`);

      // Send offer via signaling server
      await this.sendSignal(targetUserId, 'offer', offer);
      console.log(`📡 Offer sent to ${targetUserId}`);
      
    } catch (error) {
      console.error(`Failed to create offer for ${targetUserId}:`, error);
      this.peerConnections.delete(targetUserId);
      throw error;
    }
  }

  async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📥 Handling offer from ${fromUserId}`);
    
    try {
      // Close existing connection if any
      const existingPc = this.peerConnections.get(fromUserId);
      if (existingPc) {
        existingPc.close();
      }

      const pc = this.createPeerConnection(fromUserId);
      this.peerConnections.set(fromUserId, pc);

      await pc.setRemoteDescription(offer);
      console.log(`📥 Remote description set for ${fromUserId}`);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log(`📤 Answer created for ${fromUserId}`);

      // Send answer via signaling server
      await this.sendSignal(fromUserId, 'answer', answer);
      console.log(`📡 Answer sent to ${fromUserId}`);
      
    } catch (error) {
      console.error(`Failed to handle offer from ${fromUserId}:`, error);
      this.peerConnections.delete(fromUserId);
    }
  }

  async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📥 Handling answer from ${fromUserId}`);
    
    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
        console.log(`📥 Remote description (answer) set for ${fromUserId}`);
      } catch (error) {
        console.error(`Failed to set remote description for ${fromUserId}:`, error);
      }
    } else {
      console.warn(`No peer connection found for ${fromUserId} when handling answer`);
    }
  }

  async handleIceCandidate(fromUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
        console.log(`🧊 ICE candidate added for ${fromUserId}`);
      } catch (error) {
        console.error(`Failed to add ICE candidate for ${fromUserId}:`, error);
      }
    } else {
      console.warn(`Cannot add ICE candidate for ${fromUserId}: no connection or remote description`);
    }
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    console.log(`🔗 Creating peer connection for ${userId}`);
    
    // Get network information for adaptive configuration
    const networkInfo = networkMonitor.getStatus();
    const adaptiveConfig = getAdaptiveConfig({
      effectiveType: networkInfo.effectiveType,
      downlink: networkInfo.downlink,
      rtt: networkInfo.rtt
    });
    
    debugLogger.info('webrtc', 'Creating peer connection', {
      userId,
      networkQuality: networkInfo.quality,
      adaptiveConfig,
      iceServersCount: adaptiveConfig.iceServers?.length || 0
    });
    
    const pc = new RTCPeerConnection(adaptiveConfig);

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📺 Remote stream received from:', userId);
      debugLogger.info('webrtc', 'Remote stream received', {
        userId,
        streamId: event.streams[0]?.id,
        trackKind: event.track.kind
      });
      
      if (event.streams[0]) {
        this.onRemoteStream?.(event.streams[0], userId);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to ${userId}`);
        debugLogger.debug('webrtc', 'ICE candidate generated', {
          userId,
          candidateType: event.candidate.type,
          protocol: event.candidate.protocol
        });
        
        this.sendSignal(userId, 'ice-candidate', event.candidate).catch(error => {
          console.error(`Failed to send ICE candidate to ${userId}:`, error);
          debugLogger.error('webrtc', 'Failed to send ICE candidate', { userId, error: error.message });
        });
      }
    };

    // Handle connection state changes with enhanced logging
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`🔗 Connection state with ${userId}: ${state}`);
      
      debugLogger.info('webrtc', 'Connection state changed', {
        userId,
        state,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState
      });
      
      // Notify external handlers
      const callback = this.connectionStateCallbacks.get(userId);
      if (callback) {
        callback(state);
      }
      
      switch (state) {
        case 'connected':
          // Reset reconnection attempts on successful connection
          this.reconnectAttempts.delete(userId);
          debugLogger.info('webrtc', 'Peer connection established', { userId });
          break;
          
        case 'failed':
        case 'disconnected':
          if (this.isScreenSharing) {
            console.log(`🔄 Attempting to reconnect to ${userId}`);
            debugLogger.warn('webrtc', 'Connection lost, attempting reconnect', { userId, state });
            this.handleConnectionFailure(userId);
          }
          break;
          
        case 'closed':
          this.peerConnections.delete(userId);
          this.reconnectAttempts.delete(userId);
          this.connectionStateCallbacks.delete(userId);
          debugLogger.info('webrtc', 'Peer connection closed', { userId });
          break;
      }
    };

    // Enhanced ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${userId}: ${pc.iceConnectionState}`);
      debugLogger.debug('webrtc', 'ICE connection state changed', {
        userId,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState
      });
    };

    // Add ICE gathering state monitoring
    pc.onicegatheringstatechange = () => {
      debugLogger.debug('webrtc', 'ICE gathering state changed', {
        userId,
        iceGatheringState: pc.iceGatheringState
      });
    };

    // Set up connection timeout
    const connectionTimer = setTimeout(() => {
      if (pc.connectionState === 'connecting' || pc.connectionState === 'new') {
        debugLogger.warn('webrtc', 'Connection timeout', { userId });
        console.warn(`⏰ Connection timeout for ${userId}`);
        this.handleConnectionFailure(userId);
      }
    }, connectionTimeouts.connection);

    // Clear timer when connection is established or closed
    const originalClose = pc.close.bind(pc);
    pc.close = () => {
      clearTimeout(connectionTimer);
      originalClose();
    };

    return pc;
  }

  setConnectionStateCallback(userId: string, callback: (state: RTCPeerConnectionState) => void) {
    this.connectionStateCallbacks.set(userId, callback);
  }

  private async handleConnectionFailure(userId: string) {
    const attempts = this.reconnectAttempts.get(userId) || 0;
    
    if (attempts < this.maxReconnectAttempts && this.isScreenSharing) {
      console.log(`🔄 Attempting to reconnect to ${userId} (${attempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectAttempts.set(userId, attempts + 1);
      
      // Wait before reconnecting with exponential backoff
      const delay = Math.min(2000 * Math.pow(2, attempts), 10000);
      
      setTimeout(async () => {
        if (this.isScreenSharing && this.localStream) {
          try {
            await this.createOffer(userId);
          } catch (error) {
            console.error(`Reconnection attempt failed for ${userId}:`, error);
          }
        }
      }, delay);
    } else {
      console.log(`❌ Max reconnection attempts reached for ${userId} or not screen sharing`);
      this.peerConnections.delete(userId);
      this.reconnectAttempts.delete(userId);
      this.connectionStateCallbacks.delete(userId);
    }
  }

  private async sendSignal(toUserId: string, signalType: string, signalData: any): Promise<void> {
    const signalKey = `${toUserId}-${signalType}`;
    const retryAttempts = this.signalRetryAttempts.get(signalKey) || 0;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webrtc-signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          roomId: this.roomId,
          fromUserId: this.userId,
          toUserId,
          signalType,
          signalData
        }),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}: Failed to send signal`);
      }
      
      console.log(`📡 Signal sent: ${signalType} to ${toUserId}`);
      
      // Reset retry counter on success
      this.signalRetryAttempts.delete(signalKey);
      
      // Update heartbeat
      this.lastHeartbeat.set(toUserId, Date.now());
      
    } catch (error) {
      console.error(`Failed to send signal ${signalType} to ${toUserId} (attempt ${retryAttempts + 1}):`, error);
      
      // Implement exponential backoff for retries
      if (retryAttempts < this.maxSignalRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryAttempts), 8000); // Max 8 seconds
        
        console.log(`🔄 Retrying signal ${signalType} to ${toUserId} in ${delay}ms`);
        
        this.signalRetryAttempts.set(signalKey, retryAttempts + 1);
        
        setTimeout(async () => {
          try {
            await this.sendSignal(toUserId, signalType, signalData);
          } catch (retryError) {
            console.error(`Final retry failed for ${signalType} to ${toUserId}:`, retryError);
            // Check if this is a dead connection
            this.checkConnectionHealth(toUserId);
          }
        }, delay);
      } else {
        console.error(`❌ Max retries exceeded for ${signalType} to ${toUserId}`);
        this.signalRetryAttempts.delete(signalKey);
        
        // Mark connection as potentially dead
        this.checkConnectionHealth(toUserId);
      }
      
      throw error;
    }
  }

  // Enhanced polling with adaptive intervals and error handling
  async pollSignals(): Promise<void> {
    if (!this.isPollingActive) {
      console.log('📡 Polling stopped, skipping poll');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webrtc-signal?roomId=${this.roomId}&userId=${this.userId}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        if (data.signals && data.signals.length > 0) {
          console.log(`📡 Received ${data.signals.length} signals`);
          
          for (const signal of data.signals) {
            try {
              // Update heartbeat for sender
              this.lastHeartbeat.set(signal.from_peer, Date.now());
              
              switch (signal.signal_type) {
                case 'offer':
                  await this.handleOffer(signal.from_peer, signal.signal_data);
                  break;
                case 'answer':
                  await this.handleAnswer(signal.from_peer, signal.signal_data);
                  break;
                case 'ice-candidate':
                  await this.handleIceCandidate(signal.from_peer, signal.signal_data);
                  break;
                case 'heartbeat':
                  // Respond to heartbeat
                  await this.sendSignal(signal.from_peer, 'heartbeat-response', { timestamp: Date.now() });
                  break;
                case 'heartbeat-response':
                  // Heartbeat response received, connection is alive
                  console.log(`💓 Heartbeat response from ${signal.from_peer}`);
                  break;
                default:
                  console.warn(`Unknown signal type: ${signal.signal_type}`);
              }
            } catch (error) {
              console.error(`Failed to handle signal from ${signal.from_peer}:`, error);
            }
          }
        }
        
        // Successful poll - reset adaptive interval and error count
        this.consecutivePollingErrors = 0;
        this.lastPollingSuccess = Date.now();
        
        // Gradually reduce polling interval back to baseline for active sessions
        if (this.isScreenSharing && this.adaptivePollingInterval > 1000) {
          this.adaptivePollingInterval = Math.max(1000, this.adaptivePollingInterval / this.pollingBackoffMultiplier);
        }
        
      } else {
        throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.consecutivePollingErrors++;
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('📡 Polling request timed out');
      } else {
        console.error('📡 Polling failed:', error);
      }
      
      // Implement adaptive polling with backoff for errors
      if (this.consecutivePollingErrors > 3) {
        this.adaptivePollingInterval = Math.min(
          this.adaptivePollingInterval * this.pollingBackoffMultiplier,
          this.maxPollingInterval
        );
        console.log(`📡 Increased polling interval to ${this.adaptivePollingInterval}ms due to errors`);
      }
    }
  }

  startSignalPolling(intervalMs = 1000): () => void {
    console.log('📡 Starting enhanced signal polling');
    
    // Clear existing interval if any
    if (this.signalPollingInterval) {
      clearInterval(this.signalPollingInterval);
    }
    
    this.isPollingActive = true;
    this.adaptivePollingInterval = intervalMs;
    this.consecutivePollingErrors = 0;
    
    const poll = async () => {
      if (!this.isPollingActive) return;
      
      await this.pollSignals();
      
      // Schedule next poll with adaptive interval
      if (this.isPollingActive) {
        this.signalPollingInterval = setTimeout(poll, this.adaptivePollingInterval);
      }
    };
    
    // Start first poll immediately
    poll();

    return () => {
      this.isPollingActive = false;
      if (this.signalPollingInterval) {
        clearTimeout(this.signalPollingInterval);
        this.signalPollingInterval = null;
        console.log('📡 Enhanced signal polling stopped');
      }
    };
  }

  // Heartbeat mechanism for dead connection detection
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.heartbeatTimeout / 2); // Check every 15 seconds
    
    console.log('💓 Heartbeat monitoring started');
  }

  private async performHeartbeatCheck() {
    const now = Date.now();
    
    // Send heartbeat to all connected peers
    for (const [userId, pc] of this.peerConnections.entries()) {
      if (pc.connectionState === 'connected') {
        const lastHeartbeat = this.lastHeartbeat.get(userId) || 0;
        
        if (now - lastHeartbeat > this.heartbeatTimeout) {
          console.warn(`💔 No heartbeat from ${userId} for ${now - lastHeartbeat}ms`);
          
          // Try sending a heartbeat
          try {
            await this.sendSignal(userId, 'heartbeat', { timestamp: now });
          } catch (error) {
            console.error(`Failed to send heartbeat to ${userId}:`, error);
            this.checkConnectionHealth(userId);
          }
        } else {
          // Send periodic heartbeat to maintain connection
          try {
            await this.sendSignal(userId, 'heartbeat', { timestamp: now });
          } catch (error) {
            console.warn(`Heartbeat send failed to ${userId}:`, error);
          }
        }
      }
    }
  }

  private checkConnectionHealth(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (!pc) return;
    
    const lastHeartbeat = this.lastHeartbeat.get(userId) || 0;
    const timeSinceHeartbeat = Date.now() - lastHeartbeat;
    
    console.log(`🔍 Checking connection health for ${userId}`, {
      connectionState: pc.connectionState,
      timeSinceHeartbeat,
      threshold: this.heartbeatTimeout
    });
    
    // If no heartbeat for too long and connection seems stuck
    if (timeSinceHeartbeat > this.heartbeatTimeout * 2) {
      console.warn(`💀 Connection to ${userId} appears dead, initiating cleanup`);
      
      // Force connection failure to trigger reconnection
      if (this.isScreenSharing) {
        this.handleConnectionFailure(userId);
      } else {
        // Clean up dead connection
        pc.close();
        this.peerConnections.delete(userId);
        this.lastHeartbeat.delete(userId);
        this.signalRetryAttempts.delete(userId);
      }
    }
  }

  // Get connection status for a specific peer
  getConnectionState(userId: string): RTCPeerConnectionState | null {
    const pc = this.peerConnections.get(userId);
    return pc ? pc.connectionState : null;
  }

  // Get all connected peers
  getConnectedPeers(): string[] {
    const connected: string[] = [];
    this.peerConnections.forEach((pc, userId) => {
      if (pc.connectionState === 'connected') {
        connected.push(userId);
      }
    });
    return connected;
  }

  // Enhanced cleanup with proper heartbeat shutdown
  cleanup() {
    console.log('🧹 Cleaning up enhanced WebRTC signaling manager');
    
    this.stopScreenShare();
    
    // Stop polling
    this.isPollingActive = false;
    if (this.signalPollingInterval) {
      clearTimeout(this.signalPollingInterval);
      this.signalPollingInterval = null;
    }
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Clear all tracking maps
    this.connectionStateCallbacks.clear();
    this.signalRetryAttempts.clear();
    this.lastHeartbeat.clear();
    
    console.log('✅ Enhanced cleanup completed');
  }
}