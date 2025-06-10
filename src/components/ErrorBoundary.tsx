import React, { Component, ErrorInfo, ReactNode, ReactElement } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Download } from 'lucide-react';
import { debugLogger } from '../utils/debugLogger';
import { networkMonitor, NetworkStatus } from '../utils/networkMonitor';

interface Props {
  children: ReactNode;
  fallback?: ReactElement;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  eventId: string | null;
  networkStatus: NetworkStatus;
  retryCount: number;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private networkListener: (() => void) | null = null;
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      eventId: null,
      networkStatus: networkMonitor.getStatus(),
      retryCount: 0,
      showDetails: false
    };
  }

  componentDidMount() {
    // Enhanced network monitoring for WebRTC errors
    this.networkListener = networkMonitor.addListener((status) => {
      this.setState({ networkStatus: status });
      
      // Auto-retry if network comes back online after error
      if (this.state.hasError && status.isOnline && status.quality !== 'offline') {
        debugLogger.info('general', 'Network restored after error, attempting auto-recovery');
        setTimeout(() => this.handleRetry(), 2000);
      }
    });
  }

  componentWillUnmount() {
    if (this.networkListener) {
      this.networkListener();
    }
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    const prevResetKeys = prevProps.resetKeys;

    // Reset on props change if enabled
    if (
      hasError &&
      resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      debugLogger.info('general', 'Props changed, resetting error boundary');
      this.resetErrorBoundary();
    }

    // Reset when resetKeys change
    if (hasError && resetKeys && prevResetKeys) {
      if (resetKeys.some((key, idx) => key !== prevResetKeys[idx])) {
        debugLogger.info('general', 'Reset keys changed, resetting error boundary');
        this.resetErrorBoundary();
      }
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced logging with categorization
    const category = ErrorBoundary.categorizeError(error);
    debugLogger.error('general', `Error Boundary caught ${category} error`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      errorId,
      category
    });

    return {
      hasError: true,
      error,
      errorId
    };
  }

  static categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    if (message.includes('webrtc') || stack.includes('webrtc') || 
        message.includes('peer') || message.includes('signaling')) {
      return 'WebRTC';
    } else if (message.includes('network') || message.includes('fetch') || 
               message.includes('connection')) {
      return 'Network';
    } else if (message.includes('permission') || message.includes('denied') || 
               message.includes('notallowed')) {
      return 'Permission';
    } else if (message.includes('media') || message.includes('stream') || 
               message.includes('track')) {
      return 'Media';
    } else if (message.includes('chunk') || message.includes('loading')) {
      return 'Loading';
    } else {
      return 'Application';
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugLogger.error('general', 'Error boundary component details', {
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'Enhanced ErrorBoundary'
    });

    this.setState({
      errorInfo
    });

    // Call external error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        debugLogger.error('general', 'Error in error boundary handler', handlerError);
      }
    }
  }

  handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      debugLogger.warn('general', `Max retries (${this.maxRetries}) reached for error boundary`);
      return;
    }

    debugLogger.info('general', `Attempting error recovery (${this.state.retryCount + 1}/${this.maxRetries})`);

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      showDetails: false
    }));
  };

  resetErrorBoundary = () => {
    debugLogger.info('general', 'Manual error boundary reset');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      showDetails: false,
      eventId: null
    });
  };

  handleRefreshPage = () => {
    debugLogger.info('general', 'User initiated page refresh from error boundary');
    window.location.reload();
  };

  handleGoHome = () => {
    debugLogger.info('general', 'User navigating to home from error boundary');
    window.location.href = '/';
  };

  handleCopyError = async () => {
    const errorText = JSON.stringify({
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      networkStatus: this.state.networkStatus,
      timestamp: new Date().toISOString()
    }, null, 2);

    try {
      await navigator.clipboard.writeText(errorText);
      debugLogger.info('general', 'Error details copied to clipboard');
    } catch (err) {
      debugLogger.warn('general', 'Failed to copy error details', err);
    }
  };

  handleExportLogs = () => {
    const logs = debugLogger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${this.state.errorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    debugLogger.info('general', 'Error logs exported', { errorId: this.state.errorId });
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  getErrorSuggestions(): string[] {
    if (!this.state.error) return [];
    
    const category = ErrorBoundary.categorizeError(this.state.error);
    const isOffline = !this.state.networkStatus.isOnline;
    const isPoorConnection = this.state.networkStatus.quality === 'poor';
    
    const suggestions: string[] = [];
    
    if (isOffline) {
      suggestions.push('Check your internet connection');
      suggestions.push('Wait for network connectivity to be restored');
    } else if (isPoorConnection) {
      suggestions.push('Your connection quality is poor');
      suggestions.push('Try moving closer to your router');
    }
    
    switch (category) {
      case 'WebRTC':
        suggestions.push('Try refreshing the page');
        suggestions.push('Check if other participants are experiencing issues');
        suggestions.push('Verify WebRTC is supported in your browser');
        break;
      case 'Network':
        suggestions.push('Check your firewall settings');
        suggestions.push('Try using a different network');
        break;
      case 'Permission':
        suggestions.push('Grant camera and microphone permissions');
        suggestions.push('Check browser permission settings');
        break;
      case 'Media':
        suggestions.push('Check your camera and microphone');
        suggestions.push('Close other applications using media devices');
        break;
      case 'Loading':
        suggestions.push('Try refreshing the page');
        suggestions.push('Clear your browser cache');
        break;
      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Clear your browser cache');
    }
    
    return suggestions;
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorCategory = ErrorBoundary.categorizeError(this.state.error!);
      const suggestions = this.getErrorSuggestions();
      const canRetry = this.state.retryCount < this.maxRetries;

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
            <div className="bg-white shadow-xl rounded-lg border border-red-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-red-50 rounded-t-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h2 className="text-lg font-semibold text-red-900">
                      {errorCategory} Error Occurred
                    </h2>
                    <p className="text-sm text-red-700">
                      Error ID: {this.state.errorId.split('_').pop()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Error Message */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    What happened?
                  </h3>
                  <div className="bg-gray-50 rounded-md p-3 border">
                    <p className="text-sm font-mono text-gray-800">
                      {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                  </div>
                </div>

                {/* Network Status */}
                <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-blue-900">Network Status:</span>
                    <span className={`ml-2 ${this.state.networkStatus.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                      {this.state.networkStatus.isOnline ? 'Online' : 'Offline'}
                    </span>
                    {this.state.networkStatus.effectiveType && (
                      <span className="text-blue-700 ml-2">
                        • {this.state.networkStatus.effectiveType.toUpperCase()}
                      </span>
                    )}
                    <span className="text-blue-700 ml-2">
                      • Quality: {this.state.networkStatus.quality}
                    </span>
                  </div>
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Suggested solutions:
                    </h3>
                    <ul className="space-y-1">
                      {suggestions.map((suggestion, index) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start">
                          <span className="text-blue-500 mr-2 mt-1">•</span>
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
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry ({this.state.retryCount}/{this.maxRetries})
                    </button>
                  )}
                  
                  <button
                    onClick={this.resetErrorBoundary}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Reset
                  </button>
                  
                  <button
                    onClick={this.handleRefreshPage}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Page
                  </button>
                  
                  <button
                    onClick={this.handleGoHome}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Go Home
                  </button>
                </div>

                {/* Debug Actions */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={this.handleCopyError}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Error
                    </button>
                    
                    <button
                      onClick={this.handleExportLogs}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Export Logs
                    </button>
                    
                    <button
                      onClick={this.toggleDetails}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Bug className="w-3 h-3 mr-1" />
                      {this.state.showDetails ? 'Hide' : 'Show'} Details
                    </button>
                  </div>
                  
                  {/* Technical Details */}
                  {this.state.showDetails && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-medium text-gray-900 mb-1">Error Stack:</h4>
                        <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded border overflow-auto max-h-32">
                          {this.state.error?.stack}
                        </pre>
                      </div>
                      
                      {this.state.errorInfo && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-900 mb-1">Component Stack:</h4>
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
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 