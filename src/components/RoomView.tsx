import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Users, Share2, LogOut, Loader2 } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { FloatingToolbar } from './FloatingToolbar';
import { InfiniteCanvas } from './InfiniteCanvas';
import AIResponseObject from './AIResponseObject';
import { RoomService } from '../services/roomService';
import { RoomDetailsResponse, AIResponse } from '../types/room';
import { subscribeToRoomParticipants } from '../lib/supabase';
import { HybridCursorTracker } from '../lib/hybridCursorTracker';
import type { CursorPosition } from '../services/cursorService';
import WebRTCPanel from './WebRTCPanel';
import { useParams, useNavigate } from 'react-router-dom';
import { ParticipantService } from '../services/participantService';

interface RoomViewProps {
  roomCode: string;
  userId: string;
  onLeaveRoom: () => void;
}

export function RoomView({ roomCode, userId, onLeaveRoom }: RoomViewProps) {
  const [roomDetails, setRoomDetails] = useState<RoomDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState({
    webrtcConnected: false,
    usingFallback: true,
    activeChannels: 0,
    averageLatency: 0
  });
  const [aiResponses, setAIResponses] = useState<AIResponse[]>([]);

  // Hybrid cursor tracking state
  const hybridCursorTrackerRef = useRef<HybridCursorTracker | null>(null);
  const [otherCursors, setOtherCursors] = useState<CursorPosition[]>([]);
  const durationIntervalRef = useRef<number>();

  useEffect(() => {
    loadRoomDetails();
  }, [roomCode]);

  useEffect(() => {
    if (!roomDetails?.room.id) return;

    const channel = subscribeToRoomParticipants(roomDetails.room.id, () => {
      // Reload room details when participants change
      loadRoomDetails();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [roomDetails?.room.id]);

  // Initialize hybrid cursor tracking when room is loaded
  useEffect(() => {
    if (!roomDetails?.room.id || !userId) return;

    const currentUser = roomDetails.participants.find(p => p.userId === userId);
    if (!currentUser) return;

    // Initialize hybrid cursor tracker
    const tracker = new HybridCursorTracker(
      roomDetails.room.id, 
      userId,
      {
        displayName: currentUser.displayName,
        userColor: currentUser.userColor,
        avatarEmoji: currentUser.avatarEmoji,
        platform: 'Web Browser'
      }
    );
    
    hybridCursorTrackerRef.current = tracker;
    
    // Set up cursor update callback
    tracker.setOnCursorUpdate((cursor: CursorPosition) => {
      setOtherCursors(prev => {
        // Update or add the cursor
        const updated = prev.filter(c => c.userId !== cursor.userId);
        return [...updated, cursor];
      });
    });
    
    // Start tracking
    tracker.start();

    // Monitor connection status
    const statusInterval = setInterval(() => {
      if (tracker) {
        setConnectionStatus(tracker.getConnectionStatus());
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      tracker.stop();
      hybridCursorTrackerRef.current = null;
      clearInterval(statusInterval);
    };
  }, [roomDetails?.room.id, userId]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        window.clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const loadRoomDetails = async () => {
    console.log('Loading room details for room code:', roomCode);
    try {
      console.log('Calling RoomService.getRoomDetails...');
      const details = await RoomService.getRoomDetails(roomCode);
      console.log('Room details received:', details);
      setRoomDetails(details);
      setError('');
    } catch (err) {
      console.error('Error loading room details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load room details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareRoom = async () => {
    if (!roomDetails?.room.id) return;
    
    // If we don't have an invite link yet, generate one first
    if (!inviteLink) {
      try {
        setIsGeneratingInvite(true);
        setIsShareModalOpen(true); // Open modal immediately to show loading

        const response = await RoomService.createInviteLink({
          roomId: roomDetails.room.id,
          userId: userId,
          expirationHours: 24 // Link expires in 24 hours
        });
        
        setInviteLink(response.inviteLink);
        
      } catch {
        // If invite generation fails, close modal and fall back to room code sharing
        setIsShareModalOpen(false);
        const shareData = {
          title: 'Join my collaboration room',
          text: `Join my room with code: ${roomCode}`,
          url: window.location.href
        };

        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch {
            // User cancelled sharing
          }
        }
      } finally {
        setIsGeneratingInvite(false);
      }
    } else {
      // We already have an invite link, just open the modal
      setIsShareModalOpen(true);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await RoomService.leaveRoom(userId);
      onLeaveRoom();
    } catch {
      onLeaveRoom(); // Leave anyway
    }
  };

  const handleToggleRecording = (duration?: number) => {
    console.log('RoomView: handleToggleRecording called with duration:', duration);
    if (duration === 0) {
      // Stop recording
      console.log('RoomView: Stopping recording and timer');
      setIsRecording(false);
      if (durationIntervalRef.current) {
        window.clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = undefined;
      }
      setRecordingDuration(0);
    } else if (duration === 1) {
      // Start recording
      console.log('RoomView: Starting recording and timer');
      setIsRecording(true);
      setRecordingDuration(0); // Reset duration when starting
      if (!durationIntervalRef.current) {
        console.log('RoomView: Setting up timer interval');
        durationIntervalRef.current = window.setInterval(() => {
          setRecordingDuration(prev => {
            console.log('RoomView: Timer tick, new duration:', prev + 1);
            return prev + 1;
          });
        }, 1000);
      }
    }
  };

  // Add cleanup effect for recording timer
  useEffect(() => {
    return () => {
      console.log('RoomView: Cleaning up timer on unmount');
      if (durationIntervalRef.current) {
        window.clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = undefined;
      }
    };
  }, []);

  // Add cleanup when recording modal is closed
  const handleRecordingModalClose = () => {
    console.log('RoomView: Cleaning up timer on modal close');
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = undefined;
    }
    setRecordingDuration(0);
    setIsRecording(false);
  };

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const handleAIResponse = (response: { content: string; fromUserId: string }) => {
    const newResponse: AIResponse = {
      id: crypto.randomUUID(),
      content: response.content,
      position: {
        x: window.innerWidth / 2 - 200, // Center horizontally
        y: window.innerHeight - 300 // Position above chat input
      },
      rotation: 0,
      zIndex: aiResponses.length + 1,
      fromUserId: response.fromUserId
    };
    setAIResponses(prev => [...prev, newResponse]);
  };

  const handleMoveResponse = (id: string, position: { x: number; y: number }) => {
    setAIResponses(prev =>
      prev.map(response =>
        response.id === id ? { ...response, x: position.x, y: position.y } : response
      )
    );
  };

  const handleResizeResponse = (id: string, size: { width: number; height: number }) => {
    setAIResponses(prev =>
      prev.map(response =>
        response.id === id ? { ...response, width: size.width, height: size.height } : response
      )
    );
  };

  const handleCloseResponse = (id: string) => {
    setAIResponses(prev => prev.filter(response => response.id !== id));
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
          <p className="text-gray-600">Loading room details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-red-500 mb-4">
            <Users className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Room Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onLeaveRoom}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomDetails) return null;

  return (
    <div className="relative h-screen bg-gray-50">
      {/* Header Toolbar - Fixed at top */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Stacked Avatar Circles */}
          <div className="flex items-center">
            {roomDetails?.participants.slice(0, 5).map((participant, index) => (
              <div
                key={participant.userId}
                className="relative"
                style={{ marginLeft: index > 0 ? '-8px' : '0' }}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-sm relative z-10"
                  style={{ 
                    backgroundColor: participant.userColor,
                    zIndex: roomDetails.participants.length - index
                  }}
                  title={`${participant.displayName}${participant.isHost ? ' (Host)' : ''}${participant.isOnline ? ' - Online' : ' - Offline'}`}
                >
                  {participant.displayName.charAt(0).toUpperCase()}
                  {/* Online/Offline Indicator */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    participant.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  {/* Host Crown */}
                  {participant.isHost && (
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                      <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-800 text-xs font-bold border-2 border-white">
                        👑
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Show "+X more" if there are more than 5 participants */}
            {roomDetails?.participants.length > 5 && (
              <div
                className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white shadow-md flex items-center justify-center text-gray-600 font-bold text-xs relative z-10"
                style={{ marginLeft: '-8px' }}
                title={`+${roomDetails.participants.length - 5} more participants`}
              >
                +{roomDetails.participants.length - 5}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareRoom}
              disabled={isGeneratingInvite}
              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isGeneratingInvite ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>Share</span>
            </button>
            <button
              onClick={handleLeaveRoom}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-200 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recording Timer - Only show when actively recording */}
      {isRecording && recordingDuration > 0 && (
        <div className="absolute top-[60px] left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full shadow-sm border border-red-100">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-600">
              Recording {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div 
        className="absolute inset-0"
        style={{ 
          top: (isRecording && recordingDuration > 0) ? '100px' : '60px' // Only adjust when actively recording
        }}
      >
        <InfiniteCanvas 
          roomId={roomDetails?.room.id}
          userId={userId}
          currentUser={roomDetails?.participants.find(p => p.userId === userId)}
          cursorTracker={hybridCursorTrackerRef.current}
          otherCursors={otherCursors}
          onCursorUpdate={(cursors) => setOtherCursors(cursors)}
        >
          {/* AI Response Objects */}
          {aiResponses.map((response) => (
            <AIResponseObject
              key={response.id}
              id={response.id}
              content={response.content}
              position={response.position}
              rotation={response.rotation}
              zIndex={response.zIndex}
              fromUserId={response.fromUserId}
              onMove={handleMoveResponse}
              onResize={handleResizeResponse}
              onClose={handleCloseResponse}
            />
          ))}
        </InfiniteCanvas>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        inviteLink={inviteLink}
        roomCode={roomCode}
        isGenerating={isGeneratingInvite}
      />

      {/* Floating Toolbar */}
      <FloatingToolbar
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        isHost={roomDetails?.participants.find(p => p.userId === userId)?.isHost || false}
        roomId={roomDetails?.room.id}
        userId={userId}
        onAIResponse={handleAIResponse}
        recordingDuration={recordingDuration}
      />
    </div>
  );
}