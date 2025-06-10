import React, { useState, useEffect } from 'react';
import { Video, Square } from 'lucide-react';
import { useReactMediaRecorder } from 'react-media-recorder';
import { RecordingShareModal } from './RecordingShareModal';
import { RecordingService } from '../services/recordingService';

interface FloatingToolbarProps {
  roomId?: string;
  userId?: string;
}

export function FloatingToolbar({ roomId, userId }: FloatingToolbarProps) {
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  
  const {
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    clearBlobUrl
  } = useReactMediaRecorder({
    screen: true,
    audio: true,
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 }
    },
    askPermissionOnMount: false,
    blobPropertyBag: {
      type: 'video/mp4'
    },
    mediaRecorderOptions: {
      videoBitsPerSecond: 8000000, // 8 Mbps for good quality
      audioBitsPerSecond: 128000   // 128 kbps for audio
    },
    onStart: async () => {
      // Create recording session in database when recording starts
      if (roomId && userId) {
        try {
          const session = await RecordingService.createRecordingSession({
            roomId,
            userId,
            metadata: { twitter_optimized: true }
          });
          setRecordingSessionId(session.id);
        } catch (error) {
          console.error('Failed to create recording session:', error);
        }
      }
    },
    onStop: async (blobUrl, blob) => {
      setRecordingBlob(blob);
      setIsShareModalOpen(true);
      
      // Update recording session in database
      if (recordingSessionId && blob) {
        try {
          await RecordingService.updateRecordingSession({
            sessionId: recordingSessionId,
            status: 'completed',
            duration_seconds: recordingTimer,
            file_size: blob.size,
            twitter_optimized: true
          });
        } catch (error) {
          console.error('Failed to update recording session:', error);
        }
      }
      
      setRecordingTimer(0);
    }
  });

  // Timer for recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'recording') {
      interval = setInterval(() => {
        setRecordingTimer(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTimer(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleRecordClick = () => {
    if (status === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setRecordingBlob(null);
    clearBlobUrl();
  };

  return (
    <>
      {/* Recording Timer Overlay */}
      {status === 'recording' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span className="font-mono text-sm">REC {formatTime(recordingTimer)}</span>
          </div>
        </div>
      )}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/50 px-2 py-2 flex items-center">
          {/* Record Button */}
          <button
            onClick={handleRecordClick}
            className={`p-2 rounded-md transition-all duration-200 group relative ${
              status === 'recording'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
            title={status === 'recording' ? 'Stop Recording' : 'Start Recording'}
          >
            {status === 'recording' ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Video className="w-5 h-5" />
            )}
            {status === 'recording' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white animate-pulse"></div>
            )}
          </button>
        </div>
      </div>

    {/* Recording Download Modal */}
    <RecordingShareModal
      isOpen={isShareModalOpen}
      onClose={handleCloseShareModal}
      recordingBlob={recordingBlob}
      recordingUrl={mediaBlobUrl || null}
      duration={formatDuration(recordingTimer)}
      sessionId={recordingSessionId || undefined}
    />
  </>
  );
} 