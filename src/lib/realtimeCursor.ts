import { supabase } from './supabase';
import type { CursorPosition } from '../services/cursorService';
import { debugLogger } from '../utils/debugLogger';

interface SupabasePayload {
  new?: {
    user_id?: string;
    display_name?: string;
    user_color?: string;
    avatar_emoji?: string;
    cursor_x?: number;
    cursor_y?: number;
    cursor_updated_at?: string;
    current_platform?: string;
    is_online?: boolean;
  };
  old?: {
    cursor_updated_at?: string;
  };
}

// Enhanced error logging for cursor operations
function logCursorError(operation: string, error: any, context?: any) {
  debugLogger.error('cursor', `${operation} failed`, {
    error: error?.message || error,
    stack: error?.stack,
    context,
    timestamp: new Date().toISOString()
  });
}

export function subscribeToCursorUpdates(
  roomId: string,
  onCursorUpdate: (cursor: CursorPosition) => void,
  currentUserId: string
) {
  console.log(`[CursorSubscription] Setting up subscription for room: ${roomId}, user: ${currentUserId}`);
  
  const channel = supabase.channel(`cursor_updates_${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: roomId }
    }
  });

  // Enhanced postgres_changes listener with better error handling
  channel.on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'participants',
    filter: `room_id=eq.${roomId}`
  }, (payload: any) => {
    try {
      console.log(`[CursorSubscription] Raw payload received:`, payload);
      
      // Validate payload structure
      if (!payload || !payload.new) {
        console.warn(`[CursorSubscription] Invalid payload structure:`, payload);
        return;
      }
      
      const newData = payload.new;
      
      // Check if this is from a different user
      if (!newData.user_id || newData.user_id === currentUserId) {
        console.debug(`[CursorSubscription] Ignoring own cursor update`);
        return;
      }
      
      // Check if this is a cursor update (cursor_updated_at changed)
      const oldCursorTime = payload.old?.cursor_updated_at;
      const newCursorTime = newData.cursor_updated_at;
      
      if (!newCursorTime || newCursorTime === oldCursorTime) {
        console.debug(`[CursorSubscription] No cursor timestamp change, ignoring`);
        return;
      }
      
      // Validate cursor coordinates
      if (typeof newData.cursor_x !== 'number' || typeof newData.cursor_y !== 'number') {
        console.warn(`[CursorSubscription] Invalid cursor coordinates:`, { 
          x: newData.cursor_x, 
          y: newData.cursor_y 
        });
        return;
      }
      
      // Build cursor position object
      const cursor: CursorPosition = {
        userId: newData.user_id,
        displayName: newData.display_name || 'Anonymous',
        userColor: newData.user_color || '#6366f1',
        avatarEmoji: newData.avatar_emoji || '🖱️',
        x: newData.cursor_x,
        y: newData.cursor_y,
        updatedAt: newData.cursor_updated_at,
        platform: newData.current_platform || 'Unknown',
        isOnline: newData.is_online || false
      };
      
      console.log(`[CursorSubscription] Valid cursor update:`, {
        userId: cursor.userId,
        x: cursor.x,
        y: cursor.y,
        platform: cursor.platform
      });
      
      onCursorUpdate(cursor);
      
    } catch (error) {
      logCursorError('Process cursor update', error, { payload, roomId });
    }
  });

  // Enhanced subscription status monitoring
  channel.on('system', {}, (status: any) => {
    console.log(`[CursorSubscription] Status: ${status.event || status} for room ${roomId}`);
  });

  // Subscribe with error handling
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[CursorSubscription] Successfully subscribed to room ${roomId}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[CursorSubscription] Channel error for room ${roomId}`);
    } else if (status === 'TIMED_OUT') {
      console.error(`[CursorSubscription] Subscription timeout for room ${roomId}`);
    } else {
      console.log(`[CursorSubscription] Status: ${status} for room ${roomId}`);
    }
  });

  return channel;
}

// Enhanced platform detection with more specific identification
function detectPlatform(): string {
  try {
    const userAgent = navigator.userAgent.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    // AI Platform Detection (specific)
    if (hostname.includes('chatgpt') || userAgent.includes('chatgpt')) return 'ChatGPT';
    if (hostname.includes('claude') || userAgent.includes('claude')) return 'Claude';
    if (hostname.includes('character.ai')) return 'Character.AI';
    if (hostname.includes('perplexity')) return 'Perplexity';
    
    // Development Platform Detection
    if (hostname.includes('bolt') || userAgent.includes('bolt')) return 'Bolt';
    if (hostname.includes('replit') || hostname.includes('repl.it')) return 'Replit';
    if (hostname.includes('stackblitz')) return 'StackBlitz';
    if (hostname.includes('codepen')) return 'CodePen';
    if (hostname.includes('codesandbox')) return 'CodeSandbox';
    if (hostname.includes('glitch')) return 'Glitch';
    if (hostname.includes('vercel')) return 'Vercel';
    if (hostname.includes('netlify')) return 'Netlify';
    
    // Local Development
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return `Local Development (Port: ${window.location.port || '80'})`;
    }
    
    // Browser Detection (fallback)
    if (userAgent.includes('edg/')) return 'Microsoft Edge';
    if (userAgent.includes('chrome/') && !userAgent.includes('edg/')) return 'Google Chrome';
    if (userAgent.includes('firefox/')) return 'Mozilla Firefox';
    if (userAgent.includes('safari/') && !userAgent.includes('chrome/')) return 'Apple Safari';
    if (userAgent.includes('opera/') || userAgent.includes('opr/')) return 'Opera';
    
    // OS Detection (additional context)
    let os = 'Unknown OS';
    if (userAgent.includes('win')) os = 'Windows';
    else if (userAgent.includes('mac')) os = 'macOS';
    else if (userAgent.includes('linux')) os = 'Linux';
    else if (userAgent.includes('android')) os = 'Android';
    else if (userAgent.includes('ios')) os = 'iOS';
    
    return `Unknown Browser on ${os}`;
  } catch (error) {
    console.warn('[Platform Detection] Failed to detect platform:', error);
    return 'Unknown Platform';
  }
}

export class CursorTracker {
  private roomId: string;
  private userId: string;
  private platform: string;
  private isActive: boolean = false;
  private lastPosition: { x: number; y: number } | null = null;
  private updateThrottle: number = 100;
  private activeThrottle: number = 33;  // 30 FPS for active movement
  private idleThrottle: number = 100;   // 10 FPS for idle state
  private lastUpdate: number = 0;
  private lastMovementTime: number = 0;
  private isMoving: boolean = false;
  private idleTimeout: NodeJS.Timeout | null = null;
  private readonly idleDelay: number = 1000; // Switch to idle after 1 second
  
  // Retry mechanism for failed updates
  private retryQueue: { position: { x: number; y: number }, attempt: number }[] = [];
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Start with 1 second
  private isRetrying: boolean = false;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.platform = detectPlatform();
    
    debugLogger.info('cursor', 'CursorTracker initialized', {
      roomId,
      userId,
      platform: this.platform,
      activeThrottle: this.activeThrottle,
      idleThrottle: this.idleThrottle,
      maxRetries: this.maxRetries
    });
  }

  start() {
    if (this.isActive) {
      debugLogger.warn('cursor', 'CursorTracker already active', { roomId: this.roomId });
      return;
    }
    
    debugLogger.info('cursor', 'Starting cursor tracking', {
      roomId: this.roomId,
      userId: this.userId,
      platform: this.platform,
      initialThrottle: this.idleThrottle
    });
    
    debugLogger.startPerformanceTimer('cursor-tracking-session', 'cursor');
    
    this.isActive = true;
    this.isMoving = false;
    this.updateThrottle = this.idleThrottle; // Start in idle mode
    this.setOnline();
    this.attachEventListeners();
    
    // Set offline when user leaves
    window.addEventListener('beforeunload', () => this.setOffline());
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        debugLogger.debug('cursor', 'Page hidden, setting offline');
        this.setOffline();
      } else {
        debugLogger.debug('cursor', 'Page visible, setting online');
        this.setOnline();
      }
    });
  }

  stop() {
    if (!this.isActive) return;
    
    debugLogger.info('cursor', 'Stopping cursor tracking', {
      roomId: this.roomId,
      totalUpdates: debugLogger.getCursorStats().totalUpdates,
      droppedUpdates: debugLogger.getCursorStats().droppedUpdates
    });
    
    debugLogger.endPerformanceTimer('cursor-tracking-session');
    
    this.isActive = false;
    this.isMoving = false;
    this.removeEventListeners();
    this.setOffline();
    
    // Clear all timeouts
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    
    // Clear retry queue
    this.retryQueue = [];
    this.isRetrying = false;
  }

  // Public method to update cursor position (for external canvas integration)
  public updatePosition(position: { x: number; y: number }) {
    if (!this.isActive) {
      debugLogger.debug('cursor', 'CursorTracker not active, ignoring position update', { position });
      return;
    }
    
    debugLogger.trace('cursor', 'External position update', { position });
    this.handleMovement(position, false);
  }

  private attachEventListeners() {
    debugLogger.debug('cursor', 'Attaching event listeners');
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick);
    document.addEventListener('touchmove', this.handleTouchMove);
  }

  private removeEventListeners() {
    debugLogger.debug('cursor', 'Removing event listeners');
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('touchmove', this.handleTouchMove);
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isActive) return;
    
    // Use screen coordinates for mouse events (clientX/Y are screen-relative)
    const position = { x: event.clientX, y: event.clientY };
    debugLogger.trace('cursor', 'Mouse move', { position, target: (event.target as Element)?.nodeName });
    this.handleMovement(position);
  };

  private handleClick = (event: MouseEvent) => {
    if (!this.isActive) return;
    
    // Use screen coordinates for click events
    const position = { x: event.clientX, y: event.clientY };
    debugLogger.debug('cursor', 'Click event', { position, button: event.button });
    this.handleMovement(position, true); // Immediate update on click
  };

  private handleTouchMove = (event: TouchEvent) => {
    if (!this.isActive || event.touches.length === 0) return;
    
    // Use screen coordinates for touch events
    const touch = event.touches[0];
    const position = { x: touch.clientX, y: touch.clientY };
    debugLogger.trace('cursor', 'Touch move', { position, touchCount: event.touches.length });
    this.handleMovement(position);
  };

  // Adaptive movement handler that switches between active/idle throttling
  private handleMovement(position: { x: number; y: number }, immediate: boolean = false) {
    const now = Date.now();
    this.lastMovementTime = now;
    
    // Check if position actually changed
    const positionChanged = !this.lastPosition || 
      Math.abs(this.lastPosition.x - position.x) > 1 || 
      Math.abs(this.lastPosition.y - position.y) > 1;
    
    if (!positionChanged && !immediate) {
      debugLogger.trace('cursor', 'Position unchanged, skipping', { position, lastPosition: this.lastPosition });
      return;
    }
    
    if (positionChanged) {
      this.switchToActiveMode();
    }
    
    debugLogger.trackCursorUpdate();
    
    if (immediate) {
      debugLogger.debug('cursor', 'Immediate cursor update', { position, reason: 'click' });
      this.sendUpdate(position);
    } else {
      this.throttledUpdate(position);
    }
  }

  // Switch to active mode (30 FPS) for smooth tracking
  private switchToActiveMode() {
    if (!this.isMoving) {
      this.isMoving = true;
      this.updateThrottle = this.activeThrottle;
      debugLogger.debug('cursor', 'Switched to active mode', { 
        throttle: this.activeThrottle,
        mode: 'active'
      });
    }
    
    // Reset idle timeout - switch back to idle after delay
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    
    this.idleTimeout = setTimeout(() => {
      this.switchToIdleMode();
    }, this.idleDelay);
  }

  // Switch to idle mode (10 FPS) for resource efficiency
  private switchToIdleMode() {
    this.isMoving = false;
    this.updateThrottle = this.idleThrottle;
    debugLogger.debug('cursor', 'Switched to idle mode', { 
      throttle: this.idleThrottle,
      mode: 'idle'
    });
    
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  // Improved throttling that doesn't queue up requests
  private throttledUpdate(position: { x: number; y: number }) {
    const now = Date.now();
    
    // Always update last known position
    this.lastPosition = position;
    
    // Check if we're within throttle period
    const timeSinceLastUpdate = now - this.lastUpdate;
    if (timeSinceLastUpdate < this.updateThrottle) {
      debugLogger.trackCursorThrottled();
      debugLogger.trace('cursor', 'Update throttled', { 
        timeSinceLastUpdate, 
        throttle: this.updateThrottle,
        position 
      });
      return;
    }
    
    this.sendUpdate(position);
  }

  private async sendUpdate(position: { x: number; y: number }) {
    if (!this.isActive) return;
    
    debugLogger.startPerformanceTimer('cursor-update', 'cursor');
    let timerEnded = false;
    
    try {
      this.lastUpdate = Date.now();
      
      // Validate coordinates
      if (!isFinite(position.x) || !isFinite(position.y)) {
        debugLogger.warn('cursor', 'Invalid coordinates detected', { position });
        debugLogger.trackCursorDropped();
        debugLogger.endPerformanceTimer('cursor-update');
        timerEnded = true;
        return;
      }
      
      await this.updateCursorDirect(position);
      
      // Clear retry queue on successful update
      if (this.retryQueue.length > 0) {
        debugLogger.info('cursor', 'Cleared retry queue after successful update', {
          retryQueueSize: this.retryQueue.length
        });
        this.retryQueue = [];
        this.isRetrying = false;
      }
      
      debugLogger.endPerformanceTimer('cursor-update');
      timerEnded = true;
      
    } catch (error) {
      if (!timerEnded) {
        debugLogger.endPerformanceTimer('cursor-update');
      }
      debugLogger.trackCursorDropped();
      logCursorError('Send cursor update', error, { position, roomId: this.roomId });
      
      // Add to retry queue if not already retrying
      if (!this.isRetrying && this.retryQueue.length < this.maxRetries) {
        debugLogger.warn('cursor', 'Adding failed update to retry queue', {
          position,
          queueLength: this.retryQueue.length,
          maxRetries: this.maxRetries
        });
        this.retryQueue.push({ position, attempt: 0 });
        this.processRetryQueue();
      }
    }
  }

  // Enhanced database update with proper error handling and validation
  private async updateCursorDirect(position: { x: number; y: number }) {
    try {
      const updateData = {
        cursor_x: Math.round(position.x),
        cursor_y: Math.round(position.y),
        cursor_updated_at: new Date().toISOString(),
        current_platform: this.platform,
        last_seen: new Date().toISOString()
      };
      
      console.debug(`[CursorTracker] Updating cursor:`, updateData);
      
      const { error, data } = await supabase
        .from('participants')
        .update(updateData)
        .eq('room_id', this.roomId)
        .eq('user_id', this.userId)
        .select('cursor_x, cursor_y, cursor_updated_at');
      
      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error(`No participant record found for user ${this.userId} in room ${this.roomId}`);
      }
      
      console.debug(`[CursorTracker] Cursor updated successfully:`, data[0]);
      
    } catch (error) {
      throw error; // Re-throw for retry mechanism
    }
  }

  // Retry mechanism for failed cursor updates
  private async processRetryQueue() {
    if (this.isRetrying || this.retryQueue.length === 0) return;
    
    this.isRetrying = true;
    
    while (this.retryQueue.length > 0 && this.isActive) {
      const { position, attempt } = this.retryQueue.shift()!;
      
      if (attempt >= this.maxRetries) {
        console.warn(`[CursorTracker] Max retries reached for position:`, position);
        continue;
      }
      
      try {
        console.log(`[CursorTracker] Retrying cursor update (attempt ${attempt + 1}):`, position);
        
        await this.updateCursorDirect(position);
        console.log(`[CursorTracker] Retry successful`);
        break; // Success, exit retry loop
        
      } catch (error) {
        logCursorError(`Retry cursor update (attempt ${attempt + 1})`, error);
        
        // Add back to queue with incremented attempt count
        this.retryQueue.push({ position, attempt: attempt + 1 });
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    this.isRetrying = false;
  }

  private async setOnline() {
    try {
      console.log(`[CursorTracker] Setting online status for user ${this.userId}`);
      
      const { error } = await supabase
        .from('participants')
        .update({
          is_online: true,
          current_platform: this.platform,
          cursor_updated_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        })
        .eq('room_id', this.roomId)
        .eq('user_id', this.userId);
      
      if (error) {
        throw error;
      }
      
      console.log(`[CursorTracker] Online status set successfully`);
      
    } catch (error) {
      logCursorError('Set online status', error, { roomId: this.roomId, userId: this.userId });
    }
  }

  private async setOffline() {
    try {
      console.log(`[CursorTracker] Setting offline status for user ${this.userId}`);
      
      const { error } = await supabase
        .from('participants')
        .update({
          is_online: false,
          last_seen: new Date().toISOString()
        })
        .eq('room_id', this.roomId)
        .eq('user_id', this.userId);
      
      if (error) {
        throw error;
      }
      
      console.log(`[CursorTracker] Offline status set successfully`);
      
    } catch (error) {
      logCursorError('Set offline status', error, { roomId: this.roomId, userId: this.userId });
    }
  }
} 