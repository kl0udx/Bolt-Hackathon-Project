import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Mic, MicOff, X, Loader2, AlertCircle } from 'lucide-react';
import { displayMediaConstraints } from '../config/webrtcConfig';

interface StreamlinedWebRTCPanelProps {
  roomId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onScreenShareStateChange?: (isSharing: boolean) => void;
}

export default function StreamlinedWebRTCPanel({ 
  roomId, 
  userId, 
  isOpen, 
  onClose,
  onScreenShareStateChange 
}: StreamlinedWebRTCPanelProps) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isStartingScreenShare, setIsStartingScreenShare] = useState(false);
  const [error, setError] = useState<string>('');
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Monitor screen share state and notify parent
  useEffect(() => {
    onScreenShareStateChange?.(isScreenSharing);
  }, [isScreenSharing, onScreenShareStateChange]);

  const handleStartScreenShare = async () => {
    try {
      setIsStartingScreenShare(true);
      setError('');

      // Use native browser screen capture API
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaConstraints);

      localStreamRef.current = stream;
      
      // Display local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Set up track ended handlers for when user stops sharing via browser controls
      stream.getVideoTracks().forEach(track => {
        track.addEventListener('ended', () => {
          handleStopScreenShare();
        });
      });

      setIsScreenSharing(true);
      
      // TODO: Add your WebRTC peer connection logic here to share with other participants
      // signalingManagerRef.current?.startScreenShare(stream);
      
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Screen sharing permission denied. Please allow screen sharing and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No screen to share found. Please try again.');
        } else if (err.name === 'NotSupportedError') {
          setError('Screen sharing is not supported in this browser.');
        } else {
          setError(`Screen sharing failed: ${err.message}`);
        }
      } else {
        setError('Screen sharing failed. Please try again.');
      }
    } finally {
      setIsStartingScreenShare(false);
    }
  };

  const handleStopScreenShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    setIsScreenSharing(false);
    
    // TODO: Notify other participants that sharing stopped
    // signalingManagerRef.current?.stopScreenShare();
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMicMuted;
      });
    }
    setIsMicMuted(!isMicMuted);
  };

  const handleShareOption = (option: 'tab' | 'window' | 'screen') => {
    // The native getDisplayMedia API handles this selection automatically
    // But we could potentially add custom constraints based on option
    handleStartScreenShare();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200/50 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">Screen Share</h3>
          {isScreenSharing && (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium">LIVE</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50/80 border-b border-red-200/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-red-800">{error}</div>
              <button
                onClick={() => setError('')}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="p-4">
        {!isScreenSharing ? (
          /* Start Screen Share Options */
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center mb-4">
              Choose what to share with participants
            </p>
            
            <button
              onClick={() => handleShareOption('screen')}
              disabled={isStartingScreenShare}
              className="w-full flex items-center gap-3 p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStartingScreenShare ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Monitor className="w-5 h-5" />
              )}
              <div className="text-left">
                <div className="font-medium">Start Screen Share</div>
                <div className="text-xs text-blue-100">Choose tab, window, or entire screen</div>
              </div>
            </button>
            
            <p className="text-xs text-gray-500 text-center">
              Your browser will ask what you want to share
            </p>
          </div>
        ) : (
          /* Active Screen Share Controls */
          <div className="space-y-4">
            {/* Local Preview */}
            <div>
              <div className="text-sm font-medium text-gray-900 mb-2">Your Screen Share</div>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-32 bg-gray-900 rounded-lg object-contain"
              />
            </div>

            {/* Audio Controls */}
            <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg">
              <button
                onClick={toggleMicrophone}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
                  isMicMuted
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="text-sm">{isMicMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              
              <div className="flex-1 text-xs text-gray-600">
                <div className="font-medium">Audio: {isMicMuted ? 'Muted' : 'Active'}</div>
                <div>Click to toggle microphone</div>
              </div>
            </div>

            {/* Info Note */}
            <div className="text-xs text-gray-500 bg-blue-50/80 p-3 rounded-lg">
              <p className="font-medium text-blue-700 mb-1">💡 Screen sharing is active</p>
              <p>Use your browser's sharing controls to stop, or they will appear when you hover over this tab.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 