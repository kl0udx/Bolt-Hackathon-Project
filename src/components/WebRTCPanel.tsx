import React, { useState, useEffect, useRef } from 'react';
import { Monitor, MonitorOff, Video, VideoOff, Mic, MicOff, MessageSquare, X, Users, Share2, Download, Loader2, AlertCircle, Info, Maximize2, Minimize2, Shield, CheckCircle } from 'lucide-react';
import { WebRTCService } from '../services/webrtcService';
import { AudioNotificationService } from '../services/audioNotificationService';
import { ParticipantService } from '../services/participantService';
import { WebRTCSignalingManager, subscribeToWebRTCEvents } from '../lib/realtimeWebRTC';
import { ParticipantAvatar } from './ParticipantAvatar';
import { ScreenShareStatus } from './ScreenShareStatus';
import { displayMediaConstraints, validateWebRTCEnvironment } from '../config/webrtcConfig';

interface WebRTCPanelProps {
  roomId: string;
  userId: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface ScreenShareSession {
  sessionId: string;
  hostUserId: string;
  hostName: string;
  userColor: string;
  startedAt: number;
  stream?: MediaStream;
}

interface RecordingPermissionRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  participants: Array<{
    userId: string;
    displayName: string;
    hasResponded: boolean;
    granted?: boolean;
  }>;
}

// Add stream state tracking interface
interface StreamState {
  status: 'idle' | 'starting' | 'active' | 'stopping' | 'failed';
  timestamp: number;
  setupComplete: boolean;
  userInitiatedStop: boolean;
}

export default function WebRTCPanel({ roomId, userId, isOpen, onToggle }: WebRTCPanelProps) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [currentScreenShareSessionId, setCurrentScreenShareSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingRequestPending, setIsRecordingRequestPending] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [pendingRecordingRequest, setPendingRecordingRequest] = useState<any>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [screenShareError, setScreenShareError] = useState<string>('');
  const [recordingError, setRecordingError] = useState<string>('');
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [isStartingScreenShare, setIsStartingScreenShare] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'>('idle');
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  
  // Enhanced screen sharing state
  const [activeScreenShares, setActiveScreenShares] = useState<Map<string, ScreenShareSession>>(new Map());
  const [mostRecentScreenShare, setMostRecentScreenShare] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const signalingManagerRef = useRef<WebRTCSignalingManager | null>(null);
  const recordingStartTime = useRef<number>(0);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Enhanced stream state tracking
  const streamStateRef = useRef<StreamState>({
    status: 'idle',
    timestamp: 0,
    setupComplete: false,
    userInitiatedStop: false
  });
  
  // Track cleanup functions
  const streamCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Test audio capabilities
    AudioNotificationService.testAudio();

    // Initialize signaling manager
    signalingManagerRef.current = new WebRTCSignalingManager(roomId, userId);
    
    signalingManagerRef.current.setOnRemoteStream((stream, fromUserId) => {
      setRemoteStreams(prev => new Map(prev.set(fromUserId, stream)));
      
      // Update screen share session with stream
      setActiveScreenShares(prev => {
        const updated = new Map(prev);
        const session = updated.get(fromUserId);
        if (session) {
          updated.set(fromUserId, { ...session, stream });
        }
        return updated;
      });
    });

    // Track peer connections for status display
    const updateConnectedPeers = () => {
      if (signalingManagerRef.current) {
        const peers = signalingManagerRef.current.getConnectedPeers();
        setConnectedPeers(peers);
      }
    };

    // Set up connection state callbacks for all participants
    const setupConnectionCallbacks = async () => {
      try {
        const participants = await ParticipantService.getRoomParticipants(roomId);
        setTotalParticipants(participants.length);
        
        participants.forEach(participant => {
          if (participant.userId !== userId && signalingManagerRef.current) {
            signalingManagerRef.current.setConnectionStateCallback(
              participant.userId,
              (state) => {
                updateConnectedPeers();
                
                if (state === 'connected') {
                  setConnectionStatus('connected');
                } else if (state === 'connecting') {
                  setConnectionStatus('connecting');
                } else if (state === 'failed') {
                  setConnectionStatus('reconnecting');
                }
              }
            );
          }
        });
      } catch (error) {
        // Silently fail connection setup
      }
    };

    setupConnectionCallbacks();

    // Start signal polling
    const stopPolling = signalingManagerRef.current.startSignalPolling();

    // Subscribe to WebRTC events
    const channel = subscribeToWebRTCEvents(roomId, {
      onScreenShareStarted: (session) => {
        // Play sound notification for screen sharing
        if (session.hostUserId !== userId) {
          // Someone else started sharing - play notification sound
          AudioNotificationService.playFirstTimeScreenShareSound();
        }
        
        // Get participant info for the session
        const getParticipantInfo = async () => {
          try {
            // In a real app, you'd fetch this from your participant service
            // For now, we'll use placeholder data
            const newSession: ScreenShareSession = {
              sessionId: session.id,
              hostUserId: session.hostUserId,
              hostName: session.metadata?.hostName || 'Unknown User',
              userColor: '#4ECDC4', // Default color, should come from participant data
              startedAt: Date.now()
            };

            setActiveScreenShares(prev => {
              const updated = new Map(prev);
              updated.set(session.hostUserId, newSession);
              return updated;
            });

            // Set as most recent if it's not the current user
            if (session.hostUserId !== userId) {
              setMostRecentScreenShare(session.hostUserId);
              
              // If we're the signaling manager, connect to this peer
              if (signalingManagerRef.current && !isScreenSharing) {
                // Don't auto-connect, let the screen sharer initiate connections
              }
            } else {
              setIsScreenSharing(true);
              setCurrentScreenShareSessionId(session.id);
              setConnectionStatus('connected');
              
              // Connect to all other participants when we start sharing
              connectToAllParticipants();
            }
          } catch (error) {
            // Silently fail
          }
        };

        getParticipantInfo();
      },
      onScreenShareStopped: (sessionId) => {
        // Play stop sound notification
        AudioNotificationService.playScreenShareStopSound();
        
        // Find and remove the session
        setActiveScreenShares(prev => {
          const updated = new Map(prev);
          let removedUserId: string | null = null;
          
          for (const [userId, session] of updated.entries()) {
            if (session.sessionId === sessionId) {
              updated.delete(userId);
              removedUserId = userId;
              break;
            }
          }
          
          // Update most recent if the removed session was the most recent
          if (removedUserId === mostRecentScreenShare) {
            // Find the next most recent session
            let nextMostRecent: string | null = null;
            let latestTime = 0;
            
            for (const [userId, session] of updated.entries()) {
              if (session.startedAt > latestTime) {
                latestTime = session.startedAt;
                nextMostRecent = userId;
              }
            }
            
            setMostRecentScreenShare(nextMostRecent);
          }
          
          return updated;
        });

        // Clean up local state if it was our session
        if (sessionId === currentScreenShareSessionId) {
          setCurrentScreenShareSessionId(null);
          setIsScreenSharing(false);
          setIsMicMuted(false);
          setConnectionStatus('idle');
        }
        
        // Clean up remote streams for stopped session
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          // Remove stream for the user who stopped sharing
          for (const [streamUserId, stream] of updated.entries()) {
            // Check if this stream belongs to the stopped session
            const session = activeScreenShares.get(streamUserId);
            if (session?.sessionId === sessionId) {
              updated.delete(streamUserId);
              break;
            }
          }
          return updated;
        });
      },
      onRecordingRequested: (session) => {
        if (session.startedBy !== userId) {
          setPendingRecordingRequest(session);
        }
        setIsRecordingRequestPending(false);
      },
      onRecordingStarted: (sessionId) => {
        setIsRecording(true);
        setRecordingSessionId(sessionId);
        recordingStartTime.current = Date.now();
        setPendingRecordingRequest(null);
        setIsRecordingRequestPending(false);
      },
      onRecordingStopped: (sessionId) => {
        setIsRecording(false);
        setRecordingSessionId(null);
        setPendingRecordingRequest(null);
        setIsRecordingRequestPending(false);
        recordingStartTime.current = 0;
      }
    });

    // Cleanup function
    return () => {
      stopPolling();
      channel.unsubscribe();
      
      if (signalingManagerRef.current) {
        signalingManagerRef.current.cleanup();
        signalingManagerRef.current = null;
      }
      
      // Clean up local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [isOpen, roomId, userId]);

  // Function to connect to all participants when starting screen share
  const connectToAllParticipants = async () => {
    if (!signalingManagerRef.current) return;
    
    try {
      // Get all participants in the room
      const participants = await ParticipantService.getRoomParticipants(roomId);
      const otherParticipants = participants.filter(p => p.userId !== userId && p.isOnline);
      
      // Connect to each participant
      for (const participant of otherParticipants) {
        try {
          await signalingManagerRef.current.connectToPeer(participant.userId);
        } catch (error) {
          // Silently fail individual connections
        }
      }
    } catch (error) {
      // Silently fail participant lookup
    }
  };

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when panel is open and user is screen sharing
      if (!isOpen || !isScreenSharing) return;

      // Prevent default only for our shortcuts
      if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
        event.preventDefault();
        toggleMicrophone();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleStopScreenShare();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleStopScreenShare();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isScreenSharing]);

  const setupStreamEndedHandler = (stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const handleEnded = () => {
        console.log('🎬 Track ended event fired', {
          streamState: streamStateRef.current,
          isScreenSharing,
          timestamp: Date.now()
        });

        // Enhanced conditions to prevent immediate cleanup
        const state = streamStateRef.current;
        const timeSinceSetup = Date.now() - state.timestamp;
        
        // Only handle track ended if:
        // 1. Setup is complete AND
        // 2. Stream has been active for at least 2 seconds AND
        // 3. User didn't manually stop AND
        // 4. Stream state is active
        if (state.setupComplete && 
            timeSinceSetup > 2000 && 
            !state.userInitiatedStop && 
            state.status === 'active') {
          
          console.log('🛑 Legitimate track ended - user stopped via browser');
          // Add delay to ensure this isn't a browser quirk
          setTimeout(() => {
            if (streamStateRef.current.status === 'active' && !streamStateRef.current.userInitiatedStop) {
              handleStopScreenShare();
            }
          }, 500);
        } else {
          console.log('🔧 Ignoring track ended event', {
            setupComplete: state.setupComplete,
            timeSinceSetup,
            userInitiatedStop: state.userInitiatedStop,
            status: state.status
          });
        }
      };

      // Add the event listener
      videoTrack.addEventListener('ended', handleEnded);
      
      // Store cleanup function
      const cleanup = () => {
        videoTrack.removeEventListener('ended', handleEnded);
        console.log('🧹 Track ended listener cleaned up');
      };
      
      streamCleanupRef.current = cleanup;
      return cleanup;
    }
    
    return null;
  };

  const toggleMicrophone = () => {
    if (!localStreamRef.current) return;

    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMutedState = !isMicMuted;
      audioTracks.forEach(track => {
        track.enabled = !newMutedState;
      });
      setIsMicMuted(newMutedState);
    }
  };

  // ENHANCED SCREEN SHARING with proper persistence and signaling integration
  const handleStartScreenShare = async () => {
    // Prevent multiple simultaneous attempts
    if (isStartingScreenShare || streamStateRef.current.status !== 'idle') {
      console.log('🚫 Screen share start blocked', { 
        isStarting: isStartingScreenShare, 
        status: streamStateRef.current.status 
      });
      return;
    }

    try {
      setIsStartingScreenShare(true);
      setConnectionStatus('connecting');
      setScreenShareError('');
      setShowPermissionHelp(false);
      
      // Update stream state to starting
      streamStateRef.current = {
        status: 'starting',
        timestamp: Date.now(),
        setupComplete: false,
        userInitiatedStop: false
      };
      
      console.log('🎬 Starting screen share sequence');
      
      // Get stream using the signaling manager for better integration
      let stream: MediaStream;
      
      if (signalingManagerRef.current) {
        stream = await signalingManagerRef.current.startScreenShare();
      } else {
        // Fallback to direct API call
        stream = await navigator.mediaDevices.getDisplayMedia(displayMediaConstraints);
      }

      console.log('🎬 Stream obtained, setting up...');

      // Store the stream reference FIRST
      localStreamRef.current = stream;
      
      // Set up video element BEFORE setting up ended handlers
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
          console.log('🎬 Video element playing');
        } catch (playError) {
          console.warn('Video play failed:', playError);
        }
      }

      // Play sound notification
      AudioNotificationService.playFirstTimeScreenShareSound();

      // Register with backend BEFORE setting up ended handlers
      try {
        const result = await WebRTCService.startScreenShare(roomId, userId, {
          resolution: '1920x1080',
          frameRate: 30,
          hasAudio: stream.getAudioTracks().length > 0,
          mediaSource: 'screen'
        });

        if (result && result.sessionId) {
          setCurrentScreenShareSessionId(result.sessionId);
          console.log('🎬 Backend registration successful');
        }
      } catch (backendError) {
        console.warn('Backend registration failed, continuing:', backendError);
      }

      // Set state BEFORE setting up ended handlers
      setIsScreenSharing(true);
      setIsMicMuted(stream.getAudioTracks().length === 0); // Muted if no audio track
      setConnectionStatus('connected');

      // Update stream state to active
      streamStateRef.current = {
        status: 'active',
        timestamp: Date.now(),
        setupComplete: false, // Will be set true after delay
        userInitiatedStop: false
      };

      console.log('🎬 State updated, setting up handlers...');

      // Set up stream ended handler AFTER everything is ready
      const cleanupHandler = setupStreamEndedHandler(stream);

      // CRITICAL: Mark setup as complete after a delay to prevent immediate triggers
      setTimeout(() => {
        if (streamStateRef.current.status === 'active') {
          streamStateRef.current.setupComplete = true;
          console.log('✅ Stream setup marked complete');
        }
      }, 2000); // 2 second delay

      // Connect to all participants
      connectToAllParticipants();

    } catch (error) {
      
      let errorMessage = 'Failed to start screen sharing.';
      let showHelp = false;
      
      // Update stream state to failed
      streamStateRef.current = {
        status: 'failed',
        timestamp: Date.now(),
        setupComplete: false,
        userInitiatedStop: false
      };
      
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Screen sharing permission denied. Please click "Allow" when prompted.';
            showHelp = true;
            break;
          case 'NotSupportedError':
            errorMessage = 'Screen sharing is not supported in this browser.';
            break;
          case 'NotFoundError':
            errorMessage = 'No screen available to share.';
            break;
          case 'AbortError':
            errorMessage = 'Screen sharing was cancelled.';
            break;
          case 'NotReadableError':
            errorMessage = 'Unable to access screen capture.';
            showHelp = true;
            break;
          default:
            errorMessage = `Screen sharing failed: ${error.message}`;
        }
      }
      
      setScreenShareError(errorMessage);
      setShowPermissionHelp(showHelp);
      setConnectionStatus('failed');
      
      console.error('🚫 Screen share start failed:', error);
    } finally {
      setIsStartingScreenShare(false);
    }
  };

  const handleStopScreenShare = async () => {
    try {
      console.log('🛑 Stopping screen share', { 
        currentState: streamStateRef.current,
        isScreenSharing 
      });

      // Set user stopped flag to prevent reconnection attempts
      streamStateRef.current = {
        ...streamStateRef.current,
        status: 'stopping',
        userInitiatedStop: true
      };
      
      // Play stop sound notification
      AudioNotificationService.playScreenShareStopSound();
      
      // Clean up stream ended handler first
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
        streamCleanupRef.current = null;
      }
      
      // Stop signaling manager
      if (signalingManagerRef.current) {
        signalingManagerRef.current.stopScreenShare();
      }
      
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`🛑 Stopped ${track.kind} track`);
        });
        localStreamRef.current = null;
      }

      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Notify backend
      if (currentScreenShareSessionId) {
        try {
          await WebRTCService.stopScreenShare(roomId, userId, currentScreenShareSessionId);
          console.log('🛑 Backend notified of stop');
        } catch (backendError) {
          console.warn('Backend stop notification failed:', backendError);
        }
      }

      console.log('✅ Screen share stopped successfully');

    } catch (error) {
      console.error('🚫 Screen share stop failed:', error);
    } finally {
      // Always reset state
      setCurrentScreenShareSessionId(null);
      setIsScreenSharing(false);
      setIsMicMuted(false);
      setConnectionStatus('idle');
      
      // Reset stream state to idle
      streamStateRef.current = {
        status: 'idle',
        timestamp: Date.now(),
        setupComplete: false,
        userInitiatedStop: false
      };
    }
  };

  const handleToggleRecording = async () => {
    if (isRecordingRequestPending) return;
    
    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  };

  const handleStartRecording = async () => {
    try {
      setIsRecordingRequestPending(true);
      
      const result = await WebRTCService.requestRecording(roomId, userId);
      
      // The recording will start automatically when all participants grant permission
      // The state will be updated via the real-time subscription
    } catch (error) {
      
      // Check if the error indicates a recording is already in progress
      if (error instanceof Error && error.message.includes('Recording already in progress or pending permission')) {
        // Sync client state with server state - there's already a recording session
        setIsRecording(true);
        alert('A recording session is already active in this room.');
      } else {
        alert('Failed to request recording permission.');
      }
      setIsRecordingRequestPending(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recordingSessionId) {
      setIsRecording(false);
      setRecordingSessionId(null);
      return;
    }

    try {
      setIsRecordingRequestPending(true);
      
      const duration = Math.floor((Date.now() - recordingStartTime.current) / 1000);
      
      await WebRTCService.stopRecording(
        recordingSessionId,
        userId,
        undefined, // fileUrl would be provided by actual recording implementation
        undefined, // fileSize
        duration
      );
      
    } catch (error) {
      alert('Failed to stop recording. The recording may have already ended.');
    } finally {
      // Always reset the state
      setIsRecording(false);
      setRecordingSessionId(null);
      recordingStartTime.current = 0;
      setIsRecordingRequestPending(false);
    }
  };

  const handleRecordingPermission = async (granted: boolean) => {
    if (!pendingRecordingRequest) return;

    try {
      await WebRTCService.grantRecordingPermission(
        pendingRecordingRequest.id,
        userId,
        granted
      );
      
      if (!granted) {
        setPendingRecordingRequest(null);
      }
    } catch (error) {
      // Silently fail permission response
    }
  };



  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-blue-600';
      case 'reconnecting': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'failed': return 'Connection Failed';
      default: return 'Ready';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-96 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-colors z-50"
        title="WebRTC Controls"
      >
        <Video className="w-6 h-6" />
        {(isScreenSharing || isRecording) && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-96 w-80 bg-white rounded-xl shadow-2xl border flex flex-col z-50 max-h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-green-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-gray-900">WebRTC</h3>
          {isRecording && (
            <div className="flex items-center gap-1 text-red-600">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium">REC</span>
            </div>
          )}
          {activeScreenShares.size > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <Monitor className="w-3 h-3" />
              <span className="text-xs font-medium">{activeScreenShares.size} sharing</span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Enhanced Screen Share Status Component */}
      {(isScreenSharing || connectionStatus !== 'idle') && (
        <div className="p-3 border-b">
          <ScreenShareStatus 
            isSharing={isScreenSharing}
            connectedPeers={connectedPeers}
            totalParticipants={totalParticipants}
            connectionStatus={connectionStatus}
          />
        </div>
      )}

      {/* Error Display */}
      {(screenShareError || recordingError) && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-red-800 font-medium">
                {screenShareError || recordingError}
              </div>
              {showPermissionHelp && (
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <p className="font-medium mb-1">Troubleshooting:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Make sure you're using HTTPS (required for screen sharing)</li>
                        <li>Try refreshing the page and allowing permissions</li>
                        <li>Check if other applications are using screen capture</li>
                        <li>Try sharing a specific window instead of entire screen</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setScreenShareError('');
                  setRecordingError('');
                  setShowPermissionHelp(false);
                }}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Permission Request */}
      {pendingRecordingRequest && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="text-sm font-medium text-yellow-800 mb-2">
            Recording Permission Request
          </div>
          <div className="text-xs text-yellow-700 mb-3">
            The host wants to record this session. Do you consent?
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleRecordingPermission(true)}
              className="flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600"
            >
              Allow
            </button>
            <button
              onClick={() => handleRecordingPermission(false)}
              className="flex-1 bg-red-500 text-white py-2 px-3 rounded text-sm hover:bg-red-600"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Controls with Microphone */}
      <div className="p-4 border-b">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
            disabled={isStartingScreenShare}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isScreenSharing
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isStartingScreenShare ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isScreenSharing ? (
              <MonitorOff className="w-4 h-4" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
            <span className="text-sm">
              {isStartingScreenShare 
                ? 'Starting...' 
                : isScreenSharing 
                ? 'Stop Share' 
                : 'Share Screen'}
            </span>
          </button>

          <button
            onClick={handleToggleRecording}
            disabled={isRecordingRequestPending || pendingRecordingRequest !== null}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-colors ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600'
                : isRecordingRequestPending || pendingRecordingRequest !== null
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
          >
            <div className={`w-4 h-4 ${isRecording ? 'bg-white' : 'bg-red-500'} rounded-full`} />
            <span className="text-sm">
              {isRecording ? 'Stop Rec' : isRecordingRequestPending ? 'Pending...' : 'Record'}
            </span>
          </button>
        </div>

        {/* Microphone Controls (only show when screen sharing) */}
        {isScreenSharing && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <button
              onClick={toggleMicrophone}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors ${
                isMicMuted
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              title={`${isMicMuted ? 'Unmute' : 'Mute'} microphone (Ctrl/Cmd + M)`}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="text-sm">{isMicMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <div className="flex-1 text-xs text-gray-600">
              <div>Audio: {isMicMuted ? 'Muted' : 'Active'}</div>
              <div className="text-gray-500">Press Ctrl/Cmd + M to toggle</div>
            </div>
          </div>
        )}
      </div>

      {/* Local Video */}
      {isScreenSharing && (
        <div className="p-4 border-b">
          <div className="text-sm font-medium text-gray-900 mb-2">Your Screen Share</div>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-32 bg-gray-900 rounded-lg object-contain"
          />
          <div className="mt-2 text-xs text-gray-600 flex items-center justify-between">
            <span>Status: {connectionStatus === 'connected' ? '🟢 Active' : connectionStatus === 'reconnecting' ? '🟡 Reconnecting' : '🔴 Stopped'}</span>
            <span>Audio: {isMicMuted ? '🔇 Muted' : '🔊 Active'}</span>
          </div>
        </div>
      )}

      {/* Remote Streams */}
      {remoteStreams.size > 0 && (
        <div className="p-4 border-b">
          <div className="text-sm font-medium text-gray-900 mb-2">Remote Streams</div>
          <div className="space-y-2">
            {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
              <div key={userId} className="relative">
                <video
                  autoPlay
                  playsInline
                  className="w-full h-32 bg-gray-900 rounded-lg object-contain"
                  ref={(video) => {
                    if (video) video.srcObject = stream;
                  }}
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  User {userId.slice(0, 8)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      <div className="p-4 bg-gray-50 rounded-b-xl border-t">
        <div className="text-xs text-gray-600">
          <p className="font-medium mb-1">🖥️ Fixed Screen Sharing:</p>
          <ul className="space-y-1">
            <li>• <strong>No more immediate disconnects</strong> - proper track handling</li>
            <li>• <strong>Microphone control</strong> - toggle with button or Ctrl/Cmd+M</li>
            <li>• High-quality video (1080p@30fps) with audio</li>
            <li>• Continues until you manually click "Stop Share"</li>
            <li>• Recording requires permission from all participants</li>
          </ul>
        </div>
      </div>


    </div>
  );
}