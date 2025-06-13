import { useRef, useState, useCallback } from 'react';

export function useScreenRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setRecordedBlob(null);
      setRecordingDuration(0);
      setIsRecording(false);
      chunksRef.current = [];
      startTimeRef.current = 0;
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        startTimeRef.current = Date.now();
        setRecordingDuration(0);
        durationIntervalRef.current = setInterval(() => {
          setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          setRecordedBlob(blob);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        chunksRef.current = [];
        startTimeRef.current = 0;
        setRecordingDuration(0);
      };

      // Stop recording if the user stops sharing via browser controls
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      };

      mediaRecorder.start();
    } catch (err) {
      setIsRecording(false);
      setRecordingDuration(0);
      setRecordedBlob(null);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      throw err;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const clearRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingDuration(0);
    chunksRef.current = [];
    startTimeRef.current = 0;
  }, []);

  return {
    isRecording,
    recordingDuration,
    recordedBlob,
    startRecording,
    stopRecording,
    clearRecording,
  };
} 