import React, { useState, useRef } from 'react';
import { Video, VideoOff, Bot, Loader2 } from 'lucide-react';
import { CommandInput } from './CommandInput';
import { RecordingShareModal } from './RecordingShareModal';

interface FloatingToolbarProps {
  isRecording: boolean;
  onToggleRecording: (duration?: number) => void;
  isHost: boolean;
  roomId: string;
  userId: string;
  onAIResponse: (content: string) => void;
}

export default function FloatingToolbar({
  isRecording,
  onToggleRecording,
  isHost,
  roomId,
  userId,
  onAIResponse
}: FloatingToolbarProps) {
  const [isCommandInputOpen, setIsCommandInputOpen] = useState(false);
  const [isRecordingRequestPending, setIsRecordingRequestPending] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number>(0);

  const handleSendMessage = async (message: string) => {
    // For now, simulate an AI response
    setTimeout(() => {
      onAIResponse(`This is a simulated response to: "${message}"`);
    }, 1000);
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
      
      // Notify parent to start timer
      onToggleRecording(1);

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setRecordingError('Screen sharing permission denied. Please allow screen sharing to record.');
        } else {
          setRecordingError('Failed to start recording: ' + error.message);
        }
      }
      onToggleRecording(0); // Reset parent state
    } finally {
      setIsRecordingRequestPending(false);
    }
  };

  const handleStopRecording = async () => {
    if (!mediaRecorderRef.current) {
      onToggleRecording(0); // Reset parent state
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
      onToggleRecording(0); // Reset parent state
      recordingStartTime.current = 0;
      setIsRecordingRequestPending(false);
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }
  };

  const handleRecordingClick = async () => {
    if (isRecording) {
      await handleStopRecording();
    } else {
      await handleStartRecording();
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200 p-2 z-40">
        <button
          onClick={handleRecordingClick}
          disabled={isRecordingRequestPending}
          className={`p-2 rounded-full transition-colors ${
            isRecording 
              ? 'bg-red-100 text-red-600' 
              : isRecordingRequestPending
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecordingRequestPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRecording ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>

        {isHost && (
          <button
            onClick={() => setIsCommandInputOpen(true)}
            className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
            title="Ask AI"
          >
            <Bot className="w-5 h-5" />
          </button>
        )}
      </div>

      <CommandInput
        isOpen={isCommandInputOpen}
        onClose={() => setIsCommandInputOpen(false)}
        onSend={handleSendMessage}
        placeholder="Ask AI anything... (Press Enter to send, Esc to close)"
      />

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