import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Bot, Loader2 } from 'lucide-react';
import { CommandInput } from './CommandInput';
import { RecordingShareModal } from './RecordingShareModal';
import { AIService } from '../services/apiService';

interface FloatingToolbarProps {
  isRecording: boolean;
  onToggleRecording: (duration?: number) => void;
  isHost: boolean;
  roomId: string;
  userId: string;
  onAIResponse: (response: { content: string; fromUserId: string }) => void;
  apiKey?: string; // Optional API key for host
  recordingDuration?: number; // <-- add this
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  isRecording,
  onToggleRecording,
  isHost,
  roomId,
  userId,
  onAIResponse,
  apiKey,
  recordingDuration
}) => {
  const [isCommandInputOpen, setIsCommandInputOpen] = useState(false);
  const [isRecordingRequestPending, setIsRecordingRequestPending] = useState(false);
  const [recordingError, setRecordingError] = useState<string>('');
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number>(0);
  const aiService = useRef<AIService | null>(null);

  useEffect(() => {
    // Initialize AI service
    aiService.current = new AIService(roomId, userId, isHost, apiKey);
    return () => {
      aiService.current?.cleanup();
    };
  }, [roomId, userId, isHost, apiKey]);

  const handleStartRecording = async () => {
    let stream: MediaStream | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let hiddenVideo: HTMLVideoElement | null = null;
    try {
      console.log("[ScreenRecord] Start: Requesting screen capture...");
      setIsRecordingRequestPending(true);
      setRecordingError("");
      setRecordingBlob(null);
      setRecordingUrl(null);

      // Request screen capture
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 30 }, aspectRatio: 16 / 9 },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100 }
      });

      console.log("[ScreenRecord] Stream obtained:", stream);
      if (!stream || stream.getTracks().length === 0) {
        throw new Error("No media tracks available.");
      }

      // Create and set up hidden video element
      hiddenVideo = document.createElement("video");
      hiddenVideo.style.display = "none";
      hiddenVideo.srcObject = stream;
      hiddenVideo.muted = true;
      document.body.appendChild(hiddenVideo);

      // Wait for video to be ready and handle play() properly
      try {
        // Wait for metadata to load
        await new Promise((resolve, reject) => {
          if (!hiddenVideo) return reject(new Error("No video element"));
          hiddenVideo.onloadedmetadata = resolve;
          hiddenVideo.onerror = reject;
        });

        // Try to play the video
        await hiddenVideo.play();
        console.log("[ScreenRecord] Hidden video playing successfully");
      } catch (playError) {
        console.warn("[ScreenRecord] Could not play hidden video:", playError);
        // Continue anyway - some browsers might still work
      }

      // Rest of the recording setup...
      const mimeTypes = ["video/mp4;codecs=h264,aac", "video/mp4;codecs=h264", "video/mp4", "video/webm;codecs=h264", "video/webm"];
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported video MIME types found in your browser.");
      }

      console.log("[ScreenRecord] Selected MIME type:", selectedMimeType);
      // Set up MediaRecorder
      mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 });
      console.log("[ScreenRecord] MediaRecorder created:", mediaRecorder);
      recordedChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      let hasData = false;
      // Data available
      mediaRecorder.ondataavailable = (event) => {
         console.log("[ScreenRecord] ondataavailable:", event.data.size, "bytes");
         if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
            hasData = true;
         }
      };
      // On stop
      mediaRecorder.onstop = async () => {
         console.log("[ScreenRecord] MediaRecorder stopped");
         try {
            if (recordedChunksRef.current.length > 0) {
               const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
               const url = URL.createObjectURL(blob);
               
               // Calculate actual duration
               const actualDuration = Math.floor((Date.now() - recordingStartTime.current) / 1000);
               console.log("[ScreenRecord] Recording duration:", actualDuration, "seconds");
               
               // Update state with recording data
               setRecordingBlob(blob);
               setRecordingUrl(url);
               setShowRecordingModal(true);
               console.log("[ScreenRecord] Recording complete, modal shown");
            } else {
               console.log("[ScreenRecord] No data recorded");
               setRecordingError("No recording data available. Please try again.");
            }
         } catch (error) {
            console.error("[ScreenRecord] Error processing recording:", error);
            setRecordingError("Failed to process recording. Please try again.");
         } finally {
            // Clean up
            if (hiddenVideo) {
               hiddenVideo.pause();
               hiddenVideo.srcObject = null;
               document.body.removeChild(hiddenVideo);
            }
            if (mediaRecorderRef.current?.stream) {
               mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
            mediaRecorderRef.current = null;
            recordedChunksRef.current = [];
            onToggleRecording(0); // Stop timer
            recordingStartTime.current = 0;
         }
      };
      // Start recording
      mediaRecorder.start(1000);
      console.log("[ScreenRecord] MediaRecorder started");
      recordingStartTime.current = Date.now();
      onToggleRecording(1); // Start timer
      console.log("[ScreenRecord] Timer started");
      // Handle user manually stopping share (via browser's "Stop sharing" bar)
      stream.getVideoTracks()[0].onended = () => {
         console.log("[ScreenRecord] Stream onended fired");
         if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
         }
         // (Browser handles track.stop() automatically.)
      };
    } catch (error) {
      console.error("[ScreenRecord] ERROR:", error);
      setRecordingError(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Screen sharing permission denied. Please allow screen sharing to record."
          : "Failed to start recording: " + (error instanceof Error ? error.message : String(error))
      );
      // Clean up on error
      if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        document.body.removeChild(hiddenVideo);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      onToggleRecording(0); // Ensure timer is stopped
      recordingStartTime.current = 0;
    } finally {
      setIsRecordingRequestPending(false);
      console.log("[ScreenRecord] handleStartRecording finished");
    }
  };

  const handleStopRecording = async () => {
    if (!mediaRecorderRef.current) {
      onToggleRecording(0);
      return;
    }
    try {
      setIsRecordingRequestPending(true);
      if (mediaRecorderRef.current.state !== "inactive") {
         mediaRecorderRef.current.stop();
      }
      // Stop all tracks (only if user stops from the app UI)
      if (mediaRecorderRef.current.stream) {
         mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      setRecordingError("Failed to stop recording. The recording may have already ended.");
    } finally {
      onToggleRecording(0);
      recordingStartTime.current = 0;
      setIsRecordingRequestPending(false);
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }
  };

  const handleRecordingClick = async () => {
    if (isRecordingRequestPending) {
      console.log("[ScreenRecord] Recording request pending, ignoring click");
      return;
    }

    if (isRecording) {
      console.log("[ScreenRecord] Stopping recording...");
      await handleStopRecording();
    } else {
      console.log("[ScreenRecord] Starting recording...");
      await handleStartRecording();
    }
  };

  const handleAIButtonClick = () => {
    setIsCommandInputOpen(true);
  };

  const handleCommandSubmit = async (message: string) => {
    // DEVELOPMENT ONLY: Instantly create a response card for testing purposes.
    // Remove this block when deploying to production.
    if (import.meta.env.DEV) {
      onAIResponse({
        content: `Test response card: ${message}`,
        fromUserId: userId
      });
      return;
    }

    try {
      if (!aiService.current) {
        throw new Error('AI service not initialized');
      }

      const response = await aiService.current.sendRequest(message);
      onAIResponse({
        content: response,
        fromUserId: userId
      });
    } catch (error) {
      console.error('Failed to send AI request:', error);
      alert('Failed to send AI request. Please try again.');
    }
  };

  // Add a handler for when the modal is closed
  const handleRecordingModalClose = () => {
    console.log("[ScreenRecord] Closing recording modal");
    setShowRecordingModal(false);
    
    // Clean up the recording URL to free memory
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    setRecordingBlob(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
      onToggleRecording(0);
      recordingStartTime.current = 0;
    };
  }, [onToggleRecording]);

  // Update StopRecordingButton to accept timer
  const StopRecordingButton = ({ onClick, duration }: { onClick: () => void; duration?: number }) => (
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

  return (
    <>
      {/* Stop Recording Button and Timer - only visible while recording */}
      {isRecording && (
        <StopRecordingButton onClick={handleStopRecording} duration={recordingDuration} />
      )}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white rounded-full shadow-lg border border-gray-200 p-2 z-40">
        <button
          onClick={handleRecordingClick}
          disabled={isRecordingRequestPending}
          className={`p-2 rounded-full transition-colors ${
            isRecordingRequestPending
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : isRecording
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          title={isRecording ? "Stop Recording" : "Start Recording"}
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
            onClick={handleAIButtonClick}
            className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
            title="Ask AI"
          >
            <Bot className="w-5 h-5" />
          </button>
        )}
      </div>

      {isCommandInputOpen && (
        <CommandInput
          onSubmit={handleCommandSubmit}
          onClose={() => setIsCommandInputOpen(false)}
          roomId={roomId}
          userId={userId}
        />
      )}

      {showRecordingModal && recordingBlob && recordingUrl && (
        <RecordingShareModal
          isOpen={showRecordingModal}
          onClose={handleRecordingModalClose}
          recordingBlob={recordingBlob}
          recordingUrl={recordingUrl}
          duration={`${Math.floor((Date.now() - recordingStartTime.current) / 1000)}s`}
        />
      )}
    </>
  );
}; 