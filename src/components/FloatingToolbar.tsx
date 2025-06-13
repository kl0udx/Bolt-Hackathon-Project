import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Bot, Loader2 } from 'lucide-react';
import { CommandInput } from './CommandInput';
import { RecordingShareModal } from './RecordingShareModal';
import { AIService } from '../services/apiService';
import { useScreenRecording } from '../hooks/useScreenRecording';

interface FloatingToolbarProps {
  isHost: boolean;
  roomId: string;
  userId: string;
  onAIResponse: (response: { content: string; fromUserId: string }) => void;
  apiKey?: string; // Optional API key for host
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  isHost,
  roomId,
  userId,
  onAIResponse,
  apiKey
}) => {
  const [isCommandInputOpen, setIsCommandInputOpen] = useState(false);
  const aiService = useRef<AIService | null>(null);

  // Use the new screen recording hook
  const {
    isRecording,
    recordingDuration,
    recordedBlob,
    startRecording,
    stopRecording,
    clearRecording
  } = useScreenRecording();

  useEffect(() => {
    // Initialize AI service
    aiService.current = new AIService(roomId, userId, isHost, apiKey);
    return () => {
      aiService.current?.cleanup();
    };
  }, [roomId, userId, isHost, apiKey]);

  // Add a handler for when the modal is closed
  const handleRecordingModalClose = () => {
    clearRecording();
  };

  // Update StopRecordingButton to accept timer
  const StopRecordingButton = ({ onClick, duration }: { onClick: () => void; duration?: number }) => {
    return (
      <div className="flex flex-col items-center">
        <button
          onClick={onClick}
          className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-lg text-lg font-semibold flex items-center gap-2 animate-pulse"
          style={{ minWidth: 180 }}
        >
          <VideoOff className="w-5 h-5" />
          Stop Recording
        </button>
        {typeof duration === 'number' && duration > 0 && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full shadow-sm border border-red-100">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-600">
                Recording {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Stop Recording Button and Timer - only visible while recording */}
      {isRecording && (
        <StopRecordingButton onClick={stopRecording} duration={recordingDuration} />
      )}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200 p-2 z-40">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-2 rounded-full transition-colors ${
            isRecording
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? (
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
      {isCommandInputOpen && (
        <CommandInput
          onSubmit={async (message: string) => {
            if (import.meta.env.DEV) {
              onAIResponse({ content: `Test response card: ${message}`, fromUserId: userId });
              return;
            }
            try {
              if (!aiService.current) throw new Error('AI service not initialized');
              const response = await aiService.current.sendRequest(message);
              onAIResponse({ content: response, fromUserId: userId });
            } catch (error) {
              console.error('Failed to send AI request:', error);
              alert('Failed to send AI request. Please try again.');
            }
          }}
          onClose={() => setIsCommandInputOpen(false)}
          roomId={roomId}
          userId={userId}
        />
      )}
      {recordedBlob && (
        <RecordingShareModal
          isOpen={!!recordedBlob}
          onClose={handleRecordingModalClose}
          recordingBlob={recordedBlob}
          recordingUrl={URL.createObjectURL(recordedBlob)}
          duration={`${recordingDuration}s`}
        />
      )}
    </>
  );
}; 