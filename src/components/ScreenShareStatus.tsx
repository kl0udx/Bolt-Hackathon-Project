import React from 'react';
import { Monitor, Wifi, WifiOff, Eye } from 'lucide-react';

interface ScreenShareStatusProps {
  isSharing: boolean;
  connectedPeers: string[];
  totalParticipants: number;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
}

export function ScreenShareStatus({ 
  isSharing, 
  connectedPeers, 
  totalParticipants,
  connectionStatus 
}: ScreenShareStatusProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'reconnecting': return 'text-orange-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'connecting':
      case 'reconnecting': return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />;
      case 'failed': return <WifiOff className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (!isSharing) return 'Not sharing';
    
    switch (connectionStatus) {
      case 'connected': return `Sharing to ${connectedPeers.length} viewer${connectedPeers.length !== 1 ? 's' : ''}`;
      case 'connecting': return 'Starting screen share...';
      case 'reconnecting': return 'Reconnecting...';
      case 'failed': return 'Connection failed';
      default: return 'Screen sharing';
    }
  };

  if (!isSharing && connectionStatus === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border">
      {/* Status indicator */}
      <div className={`flex items-center gap-2 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {/* Viewer count */}
      {isSharing && (
        <div className="flex items-center gap-2 text-gray-600">
          <Eye className="w-4 h-4" />
          <span className="text-sm">
            {connectedPeers.length}/{totalParticipants - 1} participants
          </span>
        </div>
      )}

      {/* Connection quality indicator */}
      {isSharing && connectionStatus === 'connected' && (
        <div className="flex items-center gap-1">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-1 h-3 rounded-full ${
                i <= Math.min(3, Math.max(1, connectedPeers.length))
                  ? 'bg-green-500'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
} 