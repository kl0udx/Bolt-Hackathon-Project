import { supabase } from './supabase';
import { WebRTCSignalingManager } from './realtimeWebRTC';
import { CursorTracker, subscribeToCursorUpdates } from './realtimeCursor';
import type { CursorPosition } from '../services/cursorService';

interface CursorUpdate {
  type: 'cursor_update';
  userId: string;
  displayName: string;
  userColor: string;
  avatarEmoji?: string;
  x: number;
  y: number;
  timestamp: number;
  platform: string;
}

interface HybridCursorConfig {
  webrtcEnabled: boolean;
  fallbackDelay: number;
  periodicSyncInterval: number;
  maxWebRTCLatency: number;
  connectionTimeout: number;
}

const DEFAULT_CONFIG: HybridCursorConfig = {
  webrtcEnabled: true,
  fallbackDelay: 2000,
  periodicSyncInterval: 3000,
  maxWebRTCLatency: 150,
  connectionTimeout: 5000,
};

export class HybridCursorTracker {
  private roomId: string;
  private userId: string;
  private currentUser: {
    displayName: string;
    userColor: string;
    avatarEmoji?: string;
    platform: string;
  };
  
  // WebRTC components
  private webrtcManager: WebRTCSignalingManager | null = null;
  private dataChannels = new Map<string, RTCDataChannel>();
  private webrtcConnected = false;
  private webrtcConnectionAttempts = 0;
  private maxConnectionAttempts = 3;
  
  // Supabase fallback
  private supabaseCursorTracker: CursorTracker | null = null;
  private supabaseSubscription: any = null;
  private isUsingFallback = false;
  
  // Cursor state
  private lastPosition: { x: number; y: number } | null = null;
  private onCursorUpdate?: (cursor: CursorPosition) => void;
  private isActive = false;
  
  // Performance monitoring
  private webrtcLatencies: number[] = [];
  private lastWebRTCMessage = 0;
  private connectionHealthTimer: NodeJS.Timeout | null = null;
  private periodicSyncTimer: NodeJS.Timeout | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  
  // Configuration
  private config: HybridCursorConfig;

  constructor(
    roomId: string, 
    userId: string, 
    currentUser: {
      displayName: string;
      userColor: string;
      avatarEmoji?: string;
      platform: string;
    },
    config: Partial<HybridCursorConfig> = {}
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.currentUser = currentUser;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    console.log('🔗 HybridCursorTracker initialized', {
      roomId,
      userId,
      config: this.config,
      user: currentUser
    });
  }

  async start(): Promise<void> {
    if (this.isActive) {
      console.warn('⚠️ HybridCursorTracker already active');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting hybrid cursor tracking (WebRTC primary, Supabase fallback)');

    // Always prepare fallback first
    this.prepareFallback();

    // Try WebRTC first
    if (this.config.webrtcEnabled) {
      await this.initializeWebRTC();
    } else {
      await this.initializeFallback();
    }
    
    // Start connection health monitoring
    this.startHealthMonitoring();
  }

  stop(): void {
    if (!this.isActive) return;

    console.log('⏹️ Stopping hybrid cursor tracking');
    this.isActive = false;
    this.cleanupWebRTC();
    this.cleanupFallback();
    this.clearTimers();
  }

  updatePosition(position: { x: number; y: number }): void {
    if (!this.isActive) return;

    this.lastPosition = position;
    const timestamp = Date.now();

    const cursorUpdate: CursorUpdate = {
      type: 'cursor_update',
      userId: this.userId,
      displayName: this.currentUser.displayName,
      userColor: this.currentUser.userColor,
      avatarEmoji: this.currentUser.avatarEmoji,
      x: position.x,
      y: position.y,
      timestamp,
      platform: this.currentUser.platform
    };

    // Try WebRTC first, then fallback
    if (this.webrtcConnected && !this.isUsingFallback) {
      this.broadcastViaWebRTC(cursorUpdate);
    } else {
      this.broadcastViaSupabase(position);
    }
  }

  setOnCursorUpdate(callback: (cursor: CursorPosition) => void): void {
    this.onCursorUpdate = callback;
  }

  // WebRTC Implementation
  private async initializeWebRTC(): Promise<void> {
    try {
      console.log('🔗 Initializing WebRTC for cursor tracking...');

      this.webrtcManager = new WebRTCSignalingManager(this.roomId, this.userId);
      
      // Start signal polling for connections
      this.webrtcManager.startSignalPolling(1000);
      
      // Set fallback timer - if no connection in X seconds, use Supabase
      this.fallbackTimer = setTimeout(() => {
        if (!this.webrtcConnected) {
          console.warn('⏰ WebRTC connection timeout, falling back to Supabase');
          this.fallbackToSupabase();
        }
      }, this.config.connectionTimeout);

    } catch (error) {
      console.error('❌ Failed to initialize WebRTC:', error);
      await this.fallbackToSupabase();
    }
  }

  private broadcastViaWebRTC(cursorUpdate: CursorUpdate): void {
    const message = JSON.stringify(cursorUpdate);
    let sentCount = 0;

    this.dataChannels.forEach((channel, userId) => {
      if (channel.readyState === 'open') {
        try {
          channel.send(message);
          sentCount++;
        } catch (error) {
          console.error('❌ Failed to send WebRTC cursor update:', error);
        }
      }
    });

    // If no channels are available, fallback immediately
    if (sentCount === 0 && this.dataChannels.size > 0) {
      console.warn('📡 No WebRTC channels ready, falling back to Supabase');
      this.fallbackToSupabase();
    }
  }

  // Supabase Fallback Implementation
  private prepareFallback(): void {
    this.supabaseCursorTracker = new CursorTracker(this.roomId, this.userId);
  }

  private async initializeFallback(): Promise<void> {
    await this.fallbackToSupabase();
  }

  private async fallbackToSupabase(): Promise<void> {
    if (this.isUsingFallback) return;

    console.log('📡 Falling back to Supabase cursor tracking');
    this.isUsingFallback = true;
    this.webrtcConnected = false;

    // Start Supabase cursor tracker
    if (this.supabaseCursorTracker) {
      this.supabaseCursorTracker.start();
    }

    // Subscribe to Supabase cursor updates
    this.supabaseSubscription = subscribeToCursorUpdates(
      this.roomId,
      (cursor: CursorPosition) => {
        this.onCursorUpdate?.(cursor);
      },
      this.userId
    );
  }

  private switchFromFallback(): void {
    if (!this.isUsingFallback) return;

    console.log('🔄 Switching from Supabase fallback back to WebRTC');
    this.isUsingFallback = false;

    // Stop Supabase tracking
    if (this.supabaseCursorTracker) {
      this.supabaseCursorTracker.stop();
    }

    if (this.supabaseSubscription) {
      this.supabaseSubscription.unsubscribe();
      this.supabaseSubscription = null;
    }
  }

  private broadcastViaSupabase(position: { x: number; y: number }): void {
    if (this.supabaseCursorTracker) {
      this.supabaseCursorTracker.updatePosition(position);
    }
  }

  // Health monitoring
  private startHealthMonitoring(): void {
    this.connectionHealthTimer = setInterval(() => {
      this.checkConnectionHealth();
    }, 5000);
  }

  private checkConnectionHealth(): void {
    if (this.webrtcConnected && !this.isUsingFallback) {
      // Check if we still have active channels
      let activeChannels = 0;
      this.dataChannels.forEach(channel => {
        if (channel.readyState === 'open') activeChannels++;
      });
      
      if (activeChannels === 0) {
        console.warn('📡 No active WebRTC channels, falling back to Supabase');
        this.fallbackToSupabase();
      }
    }
  }

  // Cleanup methods
  private cleanupWebRTC(): void {
    if (this.webrtcManager) {
      this.webrtcManager.cleanup();
      this.webrtcManager = null;
    }
    
    this.dataChannels.clear();
    this.webrtcConnected = false;
  }

  private cleanupFallback(): void {
    if (this.supabaseCursorTracker) {
      this.supabaseCursorTracker.stop();
      this.supabaseCursorTracker = null;
    }
    
    if (this.supabaseSubscription) {
      this.supabaseSubscription.unsubscribe();
      this.supabaseSubscription = null;
    }
    
    this.isUsingFallback = false;
  }

  private clearTimers(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer);
      this.connectionHealthTimer = null;
    }
  }

  // Public status methods
  isUsingWebRTC(): boolean {
    return this.webrtcConnected && !this.isUsingFallback;
  }

  getConnectionStatus(): {
    webrtcConnected: boolean;
    usingFallback: boolean;
    activeChannels: number;
    averageLatency: number;
  } {
    const avgLatency = this.webrtcLatencies.length > 0 
      ? this.webrtcLatencies.reduce((sum, lat) => sum + lat, 0) / this.webrtcLatencies.length
      : 0;

    return {
      webrtcConnected: this.webrtcConnected,
      usingFallback: this.isUsingFallback,
      activeChannels: this.dataChannels.size,
      averageLatency: avgLatency
    };
  }
} 