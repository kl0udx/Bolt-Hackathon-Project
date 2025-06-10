/**
 * Comprehensive Debug Logger for WebRTC and Cursor Tracking
 * 
 * Provides detailed logging with categories, levels, and performance monitoring
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace';
export type LogCategory = 'cursor' | 'webrtc' | 'network' | 'performance' | 'general' | 'trace';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  stack?: string;
  sessionId?: string;
}

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  category: LogCategory;
}

interface CursorPerformanceStats {
  totalUpdates: number;
  averageFrequency: number; // Hz
  lastUpdateTime: number;
  timeWindow: number[];
  droppedUpdates: number;
  throttledUpdates: number;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private logLevel: LogLevel = 'info';
  private enabledCategories = new Set<LogCategory>(['cursor', 'webrtc', 'network', 'performance', 'general']);
  private sessionId = this.generateSessionId();
  private performanceMetrics = new Map<string, PerformanceMetric>();
  private isDebugMode = false;
  
  // Cursor performance tracking
  private cursorStats: CursorPerformanceStats = {
    totalUpdates: 0,
    averageFrequency: 0,
    lastUpdateTime: 0,
    timeWindow: [],
    droppedUpdates: 0,
    throttledUpdates: 0
  };

  constructor() {
    // Check for debug mode from localStorage or URL params
    this.isDebugMode = this.checkDebugMode();
    this.logLevel = this.isDebugMode ? 'debug' : 'info';
    
    if (this.isDebugMode) {
      console.log('🐛 Debug mode enabled - Enhanced logging active');
      this.enabledCategories.add('trace');
    }
  }

  private checkDebugMode(): boolean {
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      return true;
    }
    
    // Check localStorage
    return localStorage.getItem('debug-mode') === 'true';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    if (!this.enabledCategories.has(category)) {
      return false;
    }

    const levels: LogLevel[] = ['debug', 'trace', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private addLogEntry(level: LogLevel, category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog(level, category)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      sessionId: this.sessionId,
      ...(level === 'error' && { stack: new Error().stack })
    };

    this.logs.push(entry);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }

    // Console output with formatting
    this.outputToConsole(entry);
  }

  private outputToConsole(entry: LogEntry): void {
    const emoji = this.getCategoryEmoji(entry.category);
    const timestamp = new Date(entry.timestamp).toISOString().substr(11, 12);
    const prefix = `${emoji} [${timestamp}] [${entry.category.toUpperCase()}]`;
    
    const style = this.getLogStyle(entry.level);
    
    if (entry.data) {
      console.groupCollapsed(`%c${prefix} ${entry.message}`, style);
      console.log('Data:', entry.data);
      if (entry.stack) {
        console.log('Stack:', entry.stack);
      }
      console.groupEnd();
    } else {
      console.log(`%c${prefix} ${entry.message}`, style);
    }
  }

  private getCategoryEmoji(category: LogCategory): string {
    const emojis = {
      cursor: '🖱️',
      webrtc: '📡',
      network: '🌐',
      performance: '⚡',
      general: '📝',
      trace: '🔍'
    };
    return emojis[category] || '📝';
  }

  private getLogStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #666; font-size: 11px;',
      trace: 'color: #999; font-size: 10px;',
      info: 'color: #2196F3; font-weight: bold;',
      warn: 'color: #FF9800; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold; background: #ffebee; padding: 2px 4px;'
    };
    return styles[level] || styles.info;
  }

  // Public logging methods
  debug(category: LogCategory, message: string, data?: any): void {
    this.addLogEntry('debug', category, message, data);
  }

  trace(category: LogCategory, message: string, data?: any): void {
    this.addLogEntry('trace', category, message, data);
  }

  info(category: LogCategory, message: string, data?: any): void {
    this.addLogEntry('info', category, message, data);
  }

  warn(category: LogCategory, message: string, data?: any): void {
    this.addLogEntry('warn', category, message, data);
  }

  error(category: LogCategory, message: string, error?: Error | any): void {
    this.addLogEntry('error', category, message, {
      error: error?.message || error,
      stack: error?.stack,
      ...error
    });
  }

  // Performance monitoring
  startPerformanceTimer(name: string, category: LogCategory = 'performance'): void {
    this.performanceMetrics.set(name, {
      name,
      startTime: performance.now(),
      category
    });
    
    this.trace('performance', `Started performance timer: ${name}`);
  }

  endPerformanceTimer(name: string): number | null {
    const metric = this.performanceMetrics.get(name);
    if (!metric) {
      this.warn('performance', `Performance timer not found: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    this.info('performance', `Performance timer completed: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      startTime: metric.startTime,
      endTime
    });

    this.performanceMetrics.delete(name);
    return duration;
  }

  // Cursor performance monitoring
  trackCursorUpdate(): void {
    const now = performance.now();
    this.cursorStats.totalUpdates++;
    
    // Track frequency in a sliding window
    this.cursorStats.timeWindow.push(now);
    
    // Keep only last 10 updates for frequency calculation
    if (this.cursorStats.timeWindow.length > 10) {
      this.cursorStats.timeWindow.shift();
    }
    
    // Calculate average frequency
    if (this.cursorStats.timeWindow.length > 1) {
      const windowDuration = now - this.cursorStats.timeWindow[0];
      this.cursorStats.averageFrequency = (this.cursorStats.timeWindow.length - 1) / (windowDuration / 1000);
    }
    
    this.cursorStats.lastUpdateTime = now;
    
    // Log every 100 updates or in debug mode
    if (this.cursorStats.totalUpdates % 100 === 0 || this.isDebugMode) {
      this.trace('cursor', `Cursor update #${this.cursorStats.totalUpdates}`, {
        frequency: `${this.cursorStats.averageFrequency.toFixed(1)} Hz`,
        totalUpdates: this.cursorStats.totalUpdates,
        droppedUpdates: this.cursorStats.droppedUpdates,
        throttledUpdates: this.cursorStats.throttledUpdates
      });
    }
  }

  trackCursorDropped(): void {
    this.cursorStats.droppedUpdates++;
    this.debug('cursor', `Cursor update dropped (total: ${this.cursorStats.droppedUpdates})`);
  }

  trackCursorThrottled(): void {
    this.cursorStats.throttledUpdates++;
    this.trace('cursor', `Cursor update throttled (total: ${this.cursorStats.throttledUpdates})`);
  }

  // Debug mode controls
  enableDebugMode(): void {
    this.isDebugMode = true;
    this.logLevel = 'debug';
    localStorage.setItem('debug-mode', 'true');
    this.info('general', 'Debug mode enabled');
  }

  disableDebugMode(): void {
    this.isDebugMode = false;
    this.logLevel = 'info';
    localStorage.removeItem('debug-mode');
    this.info('general', 'Debug mode disabled');
  }

  // Log retrieval and export
  getLogs(category?: LogCategory, level?: LogLevel): LogEntry[] {
    return this.logs.filter(log => {
      if (category && log.category !== category) return false;
      if (level && log.level !== level) return false;
      return true;
    });
  }

  exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      logs: this.logs,
      cursorStats: this.cursorStats,
      performanceMetrics: Array.from(this.performanceMetrics.entries())
    }, null, 2);
  }

  getCursorStats(): CursorPerformanceStats {
    return { ...this.cursorStats };
  }

  clearLogs(): void {
    this.logs = [];
    this.info('general', 'Logs cleared');
  }

  getDebugMode(): boolean {
    return this.isDebugMode;
  }

  // Network connectivity logging
  logNetworkEvent(event: string, data?: any): void {
    this.info('network', event, data);
  }

  // WebRTC connection logging
  logWebRTCEvent(event: string, userId?: string, data?: any): void {
    this.info('webrtc', event, {
      userId,
      ...data
    });
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();

// Global debug helpers for development
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger;
  (window as any).enableDebug = () => debugLogger.enableDebugMode();
  (window as any).disableDebug = () => debugLogger.disableDebugMode();
  (window as any).exportLogs = () => debugLogger.exportLogs();
  (window as any).clearLogs = () => debugLogger.clearLogs();
} 