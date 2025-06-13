import React, { useState, useRef } from 'react';
import { Video, VideoOff, X, Loader2, AlertCircle } from 'lucide-react';
import { RecordingShareModal } from './RecordingShareModal';

interface WebRTCPanelProps {
  roomId: string;
  userId: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function WebRTCPanel({ roomId, userId, isOpen, onToggle }: WebRTCPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingRequestPending, setIsRecordingRequestPending] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  
  const recordingStartTime = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);

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
      setRecordingError('');
      
      // Get screen capture stream with optimal settings for Twitter
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1920 }, // Twitter's max width is 1920px
          height: { ideal: 720, max: 1080 }, // 720p is optimal for Twitter
          frameRate: { ideal: 30, max: 30 }, // Twitter's max is 30fps
          aspectRatio: 16/9 // Twitter's preferred aspect ratio
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100 // Standard audio sample rate
        }
      });

      // Check for supported MIME types, prioritizing MP4
      const mimeTypes = [
        'video/mp4;codecs=h264,aac', // Preferred for Twitter
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264', // Fallback with H.264
        'video/webm' // Last resort
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported video MIME types found in your browser. Twitter requires MP4 format.');
      }

      // Set up MediaRecorder with Twitter-optimized settings
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps - Twitter's recommended bitrate
        audioBitsPerSecond: 128000 // 128 kbps - Good quality for audio
      });

      // Store chunks
      recordedChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Create blob with the correct MIME type
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/mp4' // Force MP4 for Twitter compatibility
        });
        
        // Create a download URL
        const url = URL.createObjectURL(blob);
        
        // Update state
        setRecordingBlob(blob);
        setRecordingUrl(url);
        setShowRecordingModal(true);
      };

      // Start recording with 1-second chunks for better memory management
      mediaRecorder.start(1000);
      recordingStartTime.current = Date.now();
      setIsRecording(true);
      
      // Handle stream ended (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setRecordingError('Screen sharing permission denied. Please allow screen sharing to record.');
        } else {
          setRecordingError('Failed to start recording: ' + error.message);
        }
      }
      setIsRecording(false);
    } finally {
      setIsRecordingRequestPending(false);
    }
  };

  const handleStopRecording = async () => {
    if (!mediaRecorderRef.current) {
      setIsRecording(false);
      return;
    }

    try {
      setIsRecordingRequestPending(true);
      
      // Stop the MediaRecorder
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
    } catch (error) {
      setRecordingError('Failed to stop recording. The recording may have already ended.');
    } finally {
      // Always reset the state
      setIsRecording(false);
      recordingStartTime.current = 0;
      setIsRecordingRequestPending(false);
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-full shadow-lg transition-colors z-50"
        title="Recording Controls"
      >
        <Video className="w-6 h-6" />
        {isRecording && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 w-80 bg-white rounded-xl shadow-2xl border flex flex-col z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-purple-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900">Recording</h3>
            {isRecording && (
              <div className="flex items-center gap-1 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium">REC</span>
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

        {/* Error Display */}
        {recordingError && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{recordingError}</span>
            </div>
          </div>
        )}

        {/* Recording Controls */}
        <div className="p-4">
          <button
            onClick={handleToggleRecording}
            disabled={isRecordingRequestPending}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-colors ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600'
                : isRecordingRequestPending
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
          >
            {isRecordingRequestPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <>
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Stop Recording
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                Start Recording
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-gray-50 rounded-b-xl border-t">
          <div className="text-xs text-gray-600">
            <p className="font-medium mb-1">🎥 Recording:</p>
            <ul className="space-y-1">
              <li>• <strong>High-quality video</strong> (720p@30fps)</li>
              <li>• <strong>System audio included</strong> - select in browser dialog</li>
              <li>• <strong>Twitter optimized</strong> - ready to share</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recording Share Modal */}
      {showRecordingModal && (
        <RecordingShareModal
          isOpen={showRecordingModal}
          onClose={() => setShowRecordingModal(false)}
          recordingBlob={recordingBlob}
          recordingUrl={recordingUrl}
          duration={`${Math.floor((Date.now() - recordingStartTime.current) / 1000)}s`}
        />
      )}
    </>
  );
}