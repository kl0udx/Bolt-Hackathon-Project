/**
 * Debug Overlay Component
 * 
 * Shows detailed connection states, performance metrics, and real-time logging
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bug, X, Minimize2, Maximize2, Activity, Database, Wifi, Users, Eye, EyeOff, Download, Trash2, Settings } from 'lucide-react';
import { debugLogger } from '../utils/debugLogger';
import { networkMonitor, NetworkStatus } from '../utils/networkMonitor';

interface DebugOverlayProps {
  isVisible: boolean;
  onToggle: () => void;
  webrtcManager?: any; // WebRTCSignalingManager
  cursorTracker?: any; // CursorTracker
}

interface LogDisplayEntry {
  id: string;
  timestamp: string;
  category: string;
  level: string;
  message: string;
  data?: any;
  emoji: string;
}

export default function DebugOverlay({ isVisible, onToggle, webrtcManager, cursorTracker }: DebugOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'network' | 'webrtc' | 'cursor' | 'performance'>('logs');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkMonitor.getStatus());
  const [logs, setLogs] = useState<LogDisplayEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [maxLogs, setMaxLogs] = useState(100);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    // Network status listener
    const networkListener = networkMonitor.addListener(setNetworkStatus);

    // Log updates
    const updateLogs = () => {
      const allLogs = debugLogger.getLogs();
      const recentLogs = allLogs.slice(-maxLogs);
      
      const formattedLogs: LogDisplayEntry[] = recentLogs.map((log, index) => ({
        id: `${log.timestamp}-${index}`,
        timestamp: new Date(log.timestamp).toLocaleTimeString(),
        category: log.category,
        level: log.level,
        message: log.message,
        data: log.data,
        emoji: getCategoryEmoji(log.category)
      }));

      setLogs(formattedLogs);

      // Auto-scroll to bottom
      if (autoScroll && logsContainerRef.current) {
        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      }
    };

    // Initial load
    updateLogs();

    // Update every 1 second
    updateIntervalRef.current = setInterval(updateLogs, 1000);

    return () => {
      networkListener();
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isVisible, maxLogs, autoScroll]);

  const getCategoryEmoji = (category: string): string => {
    const emojis: Record<string, string> = {
      cursor: '🖱️',
      webrtc: '📡',
      network: '🌐',
      performance: '⚡',
      general: '📝',
      trace: '🔍'
    };
    return emojis[category] || '📝';
  };

  const getLogLevelColor = (level: string): string => {
    const colors: Record<string, string> = {
      debug: 'text-gray-500',
      trace: 'text-gray-400',
      info: 'text-blue-600',
      warn: 'text-yellow-600',
      error: 'text-red-600'
    };
    return colors[level] || 'text-gray-600';
  };

  const getNetworkQualityColor = (quality: string): string => {
    const colors: Record<string, string> = {
      excellent: 'text-green-600',
      good: 'text-green-500',
      fair: 'text-yellow-500',
      poor: 'text-red-500',
      offline: 'text-red-600'
    };
    return colors[quality] || 'text-gray-500';
  };

  const handleClearLogs = () => {
    debugLogger.clearLogs();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const logsData = debugLogger.exportLogs();
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'all') return true;
    return log.category === logFilter || log.level === logFilter;
  });

  const getCursorStats = () => {
    return debugLogger.getCursorStats();
  };

  const getWebRTCConnectionInfo = () => {
    if (!webrtcManager) return null;
    
    try {
      return {
        connectedPeers: webrtcManager.getConnectedPeers?.() || [],
        connectionStates: Array.from(webrtcManager.peerConnections?.entries() || []).map(([userId, pc]) => ({
          userId,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState
        }))
      };
    } catch (error) {
      return { error: 'Failed to get WebRTC info' };
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 p-2 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        title="Show Debug Overlay"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white rounded-lg shadow-lg p-3 flex items-center gap-2">
        <Bug className="w-4 h-4" />
        <span className="text-sm font-medium">Debug</span>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 h-[600px] bg-white border border-gray-300 rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-800">Debug Console</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { id: 'logs', label: 'Logs', icon: Database },
          { id: 'network', label: 'Network', icon: Wifi },
          { id: 'webrtc', label: 'WebRTC', icon: Activity },
          { id: 'cursor', label: 'Cursor', icon: Users },
          { id: 'performance', label: 'Perf', icon: Activity },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex-1 p-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
              activeTab === id
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="flex flex-col h-full">
            {/* Log Controls */}
            <div className="p-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="cursor">Cursor</option>
                <option value="webrtc">WebRTC</option>
                <option value="network">Network</option>
                <option value="performance">Performance</option>
                <option value="error">Errors</option>
              </select>
              
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded text-xs ${autoScroll ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                title="Auto-scroll"
              >
                {autoScroll ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              
              <button
                onClick={handleClearLogs}
                className="p-1 rounded text-xs bg-red-500 text-white hover:bg-red-600"
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              
              <button
                onClick={handleExportLogs}
                className="p-1 rounded text-xs bg-green-500 text-white hover:bg-green-600"
                title="Export logs"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>

            {/* Logs List */}
            <div
              ref={logsContainerRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 text-xs font-mono"
            >
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-1">
                  <span className="flex-shrink-0">{log.emoji}</span>
                  <span className="text-gray-500 flex-shrink-0">{log.timestamp}</span>
                  <span className={`flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="text-gray-500 text-center py-4">No logs to display</div>
              )}
            </div>
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="p-3 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">Status:</span>
                <span className={`ml-2 ${networkStatus.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {networkStatus.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div>
                <span className="font-medium">Quality:</span>
                <span className={`ml-2 ${getNetworkQualityColor(networkStatus.quality)}`}>
                  {networkStatus.quality}
                </span>
              </div>
            </div>
            
            {networkStatus.effectiveType && (
              <div>
                <span className="font-medium">Connection Type:</span>
                <span className="ml-2">{networkStatus.effectiveType.toUpperCase()}</span>
              </div>
            )}
            
            {networkStatus.downlink && (
              <div>
                <span className="font-medium">Downlink:</span>
                <span className="ml-2">{networkStatus.downlink} Mbps</span>
              </div>
            )}
            
            {networkStatus.rtt && (
              <div>
                <span className="font-medium">RTT:</span>
                <span className="ml-2">{networkStatus.rtt}ms</span>
              </div>
            )}
            
            <div>
              <span className="font-medium">Last Check:</span>
              <span className="ml-2">{new Date(networkStatus.lastCheck).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {/* WebRTC Tab */}
        {activeTab === 'webrtc' && (
          <div className="p-3 space-y-3 text-sm">
            {(() => {
              const info = getWebRTCConnectionInfo();
              if (!info) {
                return <div>WebRTC manager not available</div>;
              }
              if (info.error) {
                return <div className="text-red-600">{info.error}</div>;
              }
              return (
                <>
                  <div>
                    <span className="font-medium">Connected Peers:</span>
                    <span className="ml-2">{info.connectedPeers.length}</span>
                  </div>
                  
                  {info.connectionStates.length > 0 && (
                    <div>
                      <div className="font-medium mb-2">Connection States:</div>
                      <div className="space-y-1">
                        {info.connectionStates.map((conn) => (
                          <div key={conn.userId} className="text-xs bg-gray-50 p-2 rounded">
                            <div className="font-medium">{conn.userId}</div>
                            <div>Connection: {conn.connectionState}</div>
                            <div>ICE: {conn.iceConnectionState}</div>
                            <div>Signaling: {conn.signalingState}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Cursor Tab */}
        {activeTab === 'cursor' && (
          <div className="p-3 space-y-3 text-sm">
            {(() => {
              const stats = getCursorStats();
              return (
                <>
                  <div>
                    <span className="font-medium">Total Updates:</span>
                    <span className="ml-2">{stats.totalUpdates}</span>
                  </div>
                  
                  <div>
                    <span className="font-medium">Frequency:</span>
                    <span className="ml-2">{stats.averageFrequency.toFixed(1)} Hz</span>
                  </div>
                  
                  <div>
                    <span className="font-medium">Dropped:</span>
                    <span className="ml-2 text-red-600">{stats.droppedUpdates}</span>
                  </div>
                  
                  <div>
                    <span className="font-medium">Throttled:</span>
                    <span className="ml-2 text-yellow-600">{stats.throttledUpdates}</span>
                  </div>
                  
                  {stats.lastUpdateTime > 0 && (
                    <div>
                      <span className="font-medium">Last Update:</span>
                      <span className="ml-2">
                        {Math.round(Date.now() - stats.lastUpdateTime)}ms ago
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="p-3 space-y-3 text-sm">
            <div>
              <span className="font-medium">Memory:</span>
              <span className="ml-2">
                {(performance as any).memory ? 
                  `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB` :
                  'Not available'
                }
              </span>
            </div>
            
            <div>
              <span className="font-medium">Connection Type:</span>
              <span className="ml-2">{(navigator as any).connection?.effectiveType || 'Unknown'}</span>
            </div>
            
            <div>
              <span className="font-medium">User Agent:</span>
              <div className="text-xs mt-1 break-words">{navigator.userAgent}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600 flex justify-between items-center">
        <span>Debug Mode Active</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
} 