/**
 * Network Connectivity Monitor
 * 
 * Monitors network connectivity and provides checks before WebRTC connections
 */

import { debugLogger } from './debugLogger';

export interface NetworkStatus {
  isOnline: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  lastCheck: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
}

export interface ConnectivityCheckResult {
  canConnect: boolean;
  reason?: string;
  networkStatus: NetworkStatus;
  recommendations?: string[];
}

class NetworkMonitor {
  private status: NetworkStatus = {
    isOnline: navigator.onLine,
    lastCheck: Date.now(),
    quality: 'good'
  };

  private listeners = new Set<(status: NetworkStatus) => void>();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5000; // 5 seconds
  private readonly CONNECTIVITY_CHECK_URLS = [
    'https://www.google.com/generate_204',
    'https://connectivitycheck.gstatic.com/generate_204',
    'https://httpbin.org/status/204'
  ];

  constructor() {
    this.init();
  }

  private init(): void {
    debugLogger.info('network', 'Network monitor initialized');
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Start periodic checks
    this.startPeriodicChecks();
    
    // Initial status check
    this.updateNetworkStatus();
  }

  private handleOnline = (): void => {
    debugLogger.info('network', 'Browser reports online');
    this.status.isOnline = true;
    this.updateNetworkStatus();
    this.notifyListeners();
  };

  private handleOffline = (): void => {
    debugLogger.warn('network', 'Browser reports offline');
    this.status.isOnline = false;
    this.status.quality = 'offline';
    this.status.lastCheck = Date.now();
    this.notifyListeners();
  };

  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.updateNetworkStatus();
    }, this.CHECK_INTERVAL);

    debugLogger.debug('network', `Started periodic network checks (${this.CHECK_INTERVAL}ms interval)`);
  }

  private updateNetworkStatus(): void {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    this.status.isOnline = navigator.onLine;
    this.status.lastCheck = Date.now();

    if (connection) {
      this.status.effectiveType = connection.effectiveType;
      this.status.downlink = connection.downlink;
      this.status.rtt = connection.rtt;
      this.status.saveData = connection.saveData;

      debugLogger.trace('network', 'Network connection info updated', {
        effectiveType: this.status.effectiveType,
        downlink: this.status.downlink,
        rtt: this.status.rtt,
        saveData: this.status.saveData
      });
    }

    this.status.quality = this.calculateNetworkQuality();
    this.notifyListeners();
  }

  private calculateNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'offline' {
    if (!this.status.isOnline) {
      return 'offline';
    }

    const { effectiveType, downlink, rtt } = this.status;

    // If we have detailed connection info
    if (downlink !== undefined && rtt !== undefined) {
      if (downlink >= 10 && rtt <= 100) {
        return 'excellent';
      } else if (downlink >= 5 && rtt <= 200) {
        return 'good';
      } else if (downlink >= 1.5 && rtt <= 500) {
        return 'fair';
      } else {
        return 'poor';
      }
    }

    // Fallback to effective type
    if (effectiveType) {
      switch (effectiveType) {
        case '4g':
          return 'excellent';
        case '3g':
          return 'good';
        case '2g':
          return 'fair';
        case 'slow-2g':
          return 'poor';
        default:
          return 'good';
      }
    }

    // Default to good if no detailed info
    return 'good';
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        debugLogger.error('network', 'Error in network status listener', error);
      }
    });
  }

  // Public methods
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  addListener(callback: (status: NetworkStatus) => void): () => void {
    this.listeners.add(callback);
    
    // Call immediately with current status
    callback(this.status);
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  async checkConnectivity(): Promise<ConnectivityCheckResult> {
    debugLogger.startPerformanceTimer('connectivity-check', 'network');
    
    if (!this.status.isOnline) {
      debugLogger.endPerformanceTimer('connectivity-check');
      return {
        canConnect: false,
        reason: 'Browser reports offline',
        networkStatus: this.status,
        recommendations: ['Check your internet connection', 'Try refreshing the page']
      };
    }

    // Test actual connectivity
    const connectivityTest = await this.testActualConnectivity();
    
    debugLogger.endPerformanceTimer('connectivity-check');

    const result: ConnectivityCheckResult = {
      canConnect: connectivityTest.success,
      networkStatus: this.status,
      recommendations: this.getRecommendations()
    };

    if (!connectivityTest.success) {
      result.reason = connectivityTest.error || 'Connectivity test failed';
    }

    debugLogger.info('network', 'Connectivity check completed', {
      canConnect: result.canConnect,
      quality: this.status.quality,
      reason: result.reason
    });

    return result;
  }

  private async testActualConnectivity(): Promise<{ success: boolean; error?: string }> {
    const timeout = 5000; // 5 second timeout
    
    for (const url of this.CONNECTIVITY_CHECK_URLS) {
      try {
        debugLogger.trace('network', `Testing connectivity to ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        debugLogger.trace('network', `Connectivity test successful: ${url}`);
        return { success: true };
        
      } catch (error) {
        debugLogger.debug('network', `Connectivity test failed for ${url}`, error);
        continue; // Try next URL
      }
    }

    return { 
      success: false, 
      error: 'All connectivity tests failed' 
    };
  }

  private getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    switch (this.status.quality) {
      case 'offline':
        recommendations.push('Check your internet connection');
        recommendations.push('Try refreshing the page');
        break;
      case 'poor':
        recommendations.push('Connection is slow - WebRTC may have issues');
        recommendations.push('Consider waiting for better connectivity');
        recommendations.push('Close other bandwidth-heavy applications');
        break;
      case 'fair':
        recommendations.push('Connection quality is fair');
        recommendations.push('WebRTC should work but may be unstable');
        break;
      case 'good':
      case 'excellent':
        recommendations.push('Network quality is sufficient for WebRTC');
        break;
    }

    if (this.status.saveData) {
      recommendations.push('Data saver mode is enabled - this may affect WebRTC performance');
    }

    return recommendations;
  }

  async waitForConnectivity(timeout = 30000): Promise<boolean> {
    debugLogger.info('network', `Waiting for connectivity (timeout: ${timeout}ms)`);
    
    if (this.status.isOnline && this.status.quality !== 'offline') {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        debugLogger.warn('network', 'Connectivity wait timeout');
        removeListener();
        resolve(false);
      }, timeout);

      const removeListener = this.addListener((status) => {
        if (status.isOnline && status.quality !== 'offline') {
          debugLogger.info('network', 'Connectivity restored');
          clearTimeout(timeoutId);
          removeListener();
          resolve(true);
        }
      });
    });
  }

  cleanup(): void {
    debugLogger.info('network', 'Network monitor cleanup');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    this.listeners.clear();
  }
}

// Singleton instance
export const networkMonitor = new NetworkMonitor();

// Global helper for development
if (typeof window !== 'undefined') {
  (window as any).networkMonitor = networkMonitor;
} 