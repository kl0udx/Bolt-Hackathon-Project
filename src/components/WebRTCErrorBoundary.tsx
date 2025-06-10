/**
 * WebRTC Error Boundary
 * 
 * Comprehensive error boundary for WebRTC components with detailed logging and recovery
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download, Bug, Wifi, WifiOff } from 'lucide-react';
import { debugLogger } from '../utils/debugLogger';
import { networkMonitor, NetworkStatus } from '../utils/networkMonitor';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  networkStatus: NetworkStatus;
  retryCount: number;
  showDetails: boolean;
}

export class WebRTCErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private networkListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      networkStatus: networkMonitor.getStatus(),
      retryCount: 0,
      showDetails: false
    };
  }

  componentDidMount() {
    // Listen to network status changes
    this.networkListener = networkMonitor.addListener((status) => {
      this.setState({ networkStatus: status });
      
      // Auto-retry if network comes back online after error
      if (this.state.hasError && status.isOnline && status.quality !== 'offline') {
        debugLogger.info('webrtc', 'Network restored, attempting auto-recovery');
        setTimeout(() => this.handleRetry(), 2000);
      }
    });
  }

  componentWillUnmount() {
    if (this.networkListener) {
      this.networkListener();
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `webrtc_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    debugLogger.error('webrtc', 'WebRTC Error Boundary caught error', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      errorId
    });

    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugLogger.error('webrtc', 'WebRTC component error details', {
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'WebRTCErrorBoundary'
    });

    this.setState({
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        debugLogger.error('webrtc', 'Error in error boundary handler', handlerError);
      }
    }
  }

  handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      debugLogger.warn('webrtc', `Max retries (${this.maxRetries}) reached for error boundary`);
      return;
    }

    debugLogger.info('webrtc', `Attempting recovery (${this.state.retryCount + 1}/${this.maxRetries})`);

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      showDetails: false
    }));
  };

  handleReset = () => {
    debugLogger.info('webrtc', 'Manual error boundary reset');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      showDetails: false
    });
  };

  handleRefreshPage = () => {
    debugLogger.info('webrtc', 'User initiated page refresh from error boundary');
    window.location.reload();
  };

  handleExportLogs = () => {
    const logs = debugLogger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `webrtc-error-logs-${this.state.errorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    debugLogger.info('webrtc', 'Error logs exported', { errorId: this.state.errorId });
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  getErrorCategory(): string {
    if (!this.state.error) return 'Unknown';
    
    const error = this.state.error;
    const message = error.message.toLowerCase();
    
    if (message.includes('webrtc') || message.includes('peer') || message.includes('signaling')) {
      return 'WebRTC Connection';
    } else if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'Network';
    } else if (message.includes('permission') || message.includes('denied') || message.includes('notallowed')) {
      return 'Permissions';
    } else if (message.includes('media') || message.includes('stream') || message.includes('track')) {
      return 'Media';
    } else {
      return 'Application';
    }
  }

  getErrorSuggestions(): string[] {
    if (!this.state.error) return [];
    
    const category = this.getErrorCategory();
    const isOffline = !this.state.networkStatus.isOnline;
    const isPoorConnection = this.state.networkStatus.quality === 'poor';
    
    const suggestions: string[] = [];
    
    if (isOffline) {
      suggestions.push('Check your internet connection');
      suggestions.push('Wait for network connectivity to be restored');
    } else if (isPoorConnection) {
      suggestions.push('Your connection quality is poor');
      suggestions.push('Try moving closer to your router');
      suggestions.push('Close other bandwidth-heavy applications');
    }
    
    switch (category) {
      case 'WebRTC Connection':
        suggestions.push('Try refreshing the page');
        suggestions.push('Check if other participants are experiencing issues');
        suggestions.push('Verify WebRTC is supported in your browser');
        break;
      case 'Network':
        suggestions.push('Check your firewall settings');
        suggestions.push('Try using a different network');
        suggestions.push('Contact your network administrator');
        break;
      case 'Permissions':
        suggestions.push('Grant camera and microphone permissions');
        suggestions.push('Check browser permission settings');
        suggestions.push('Try allowing permissions and refreshing');
        break;
      case 'Media':
        suggestions.push('Check your camera and microphone');
        suggestions.push('Close other applications using media devices');
        suggestions.push('Try using different media devices');
        break;
      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Clear your browser cache');
        suggestions.push('Try using a different browser');
    }
    
    return suggestions;
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      const errorCategory = this.getErrorCategory();
      const suggestions = this.getErrorSuggestions();
      const canRetry = this.state.retryCount < this.maxRetries;
      const networkIcon = this.state.networkStatus.isOnline ? 
        <Wifi className="w-4 h-4" /> : 
        <WifiOff className="w-4 h-4" />;

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-red-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-red-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-red-900">
                    WebRTC Error Occurred
                  </h2>
                  <p className="text-red-700 text-sm">
                    Category: {errorCategory} • Error ID: {this.state.errorId.split('_').pop()}
                  </p>
                </div>
              </div>
            </div>

            {/* Network Status */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2 text-sm">
                {networkIcon}
                <span className={`font-medium ${
                  this.state.networkStatus.isOnline ? 'text-green-600' : 'text-red-600'
                }`}>
                  {this.state.networkStatus.isOnline ? 'Online' : 'Offline'}
                </span>
                {this.state.networkStatus.effectiveType && (
                  <span className="text-gray-600">
                    • {this.state.networkStatus.effectiveType.toUpperCase()}
                  </span>
                )}
                <span className="text-gray-600">
                  • Quality: {this.state.networkStatus.quality}
                </span>
              </div>
            </div>

            {/* Error Message */}
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-2">What happened?</h3>
                <p className="text-gray-700 bg-gray-50 p-3 rounded border text-sm font-mono">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Suggested Solutions:</h3>
                  <ul className="space-y-1">
                    {suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry ({this.state.retryCount}/{this.maxRetries})
                  </button>
                )}
                
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Reset
                </button>
                
                <button
                  onClick={this.handleRefreshPage}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </button>
                
                <button
                  onClick={this.handleExportLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Logs
                </button>
              </div>

              {/* Technical Details Toggle */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <Bug className="w-4 h-4" />
                  {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
                </button>
                
                {this.state.showDetails && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Error Stack:</h4>
                      <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded border overflow-auto max-h-32">
                        {this.state.error?.stack}
                      </pre>
                    </div>
                    
                    {this.state.errorInfo && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Component Stack:</h4>
                        <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded border overflow-auto max-h-32">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WebRTCErrorBoundary; 