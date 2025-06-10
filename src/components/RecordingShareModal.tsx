import React, { useState } from 'react';
import { X, Download, Video, Check } from 'lucide-react';
import { RecordingService } from '../services/recordingService';

interface RecordingShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  duration: string;
  sessionId?: string;
}

export function RecordingShareModal({ 
  isOpen, 
  onClose, 
  recordingBlob, 
  recordingUrl, 
  duration,
  sessionId 
}: RecordingShareModalProps) {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'success'>('idle');

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (recordingUrl && recordingBlob) {
      setDownloadStatus('downloading');
      
      try {
        const link = document.createElement('a');
        link.href = recordingUrl;
        // Generate filename with timestamp for Twitter/X optimization
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.download = `screen-recording-${timestamp}.mp4`;
        
        // Add to DOM, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Track download in database
        if (sessionId) {
          await RecordingService.trackDownload(sessionId);
        }
        
        // Show success feedback
        setDownloadStatus('success');
        setTimeout(() => {
          setDownloadStatus('idle');
          onClose(); // Auto-close after successful download
        }, 2000);
      } catch (error) {
        console.error('Download failed:', error);
        setDownloadStatus('idle');
      }
    }
  };

  const formatFileSize = (blob: Blob) => {
    const bytes = blob.size;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTwitterOptimizationInfo = () => {
    if (recordingBlob) {
      const sizeInMB = recordingBlob.size / (1024 * 1024);
      const isOptimalSize = sizeInMB < 512; // Twitter/X works best under 512MB
      
      return {
        sizeInMB: sizeInMB.toFixed(1),
        isOptimalSize,
        recommendation: isOptimalSize 
          ? "✅ Perfect for Twitter/X" 
          : "⚠️ Large file - consider shorter recordings for social media"
      };
    }
    return null;
  };

  const twitterInfo = getTwitterOptimizationInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">Recording Complete</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-purple-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Screen recording ready for download!
            </h4>
            <p className="text-gray-600 text-sm">
              Your recording has been optimized and is ready to save.
            </p>
          </div>

          {/* Recording Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Duration:</span>
              <span className="text-sm font-medium text-gray-900">{duration}</span>
            </div>
            {recordingBlob && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">File size:</span>
                  <span className="text-sm font-medium text-gray-900">{formatFileSize(recordingBlob)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Format:</span>
                  <span className="text-sm font-medium text-gray-900">MP4 (H.264)</span>
                </div>
              </>
            )}
          </div>

          {/* Twitter/X Optimization Info */}
          {twitterInfo && (
            <div className={`rounded-lg p-3 mb-6 border ${
              twitterInfo.isOptimalSize 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">🐦 Social Media Ready</span>
              </div>
              <p className={`text-xs ${
                twitterInfo.isOptimalSize ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {twitterInfo.recommendation}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                File size: {twitterInfo.sizeInMB}MB • Format: MP4 • Quality: HD
              </p>
            </div>
          )}

          {/* Video Preview */}
          {recordingUrl && (
            <div className="mb-6">
              <video
                src={recordingUrl}
                controls
                className="w-full h-32 bg-gray-900 rounded-lg object-contain"
                preload="metadata"
              />
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloadStatus === 'downloading'}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-medium transition-all ${
              downloadStatus === 'success'
                ? 'bg-green-500 text-white'
                : downloadStatus === 'downloading'
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg'
            }`}
          >
            {downloadStatus === 'downloading' ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Downloading...</span>
              </>
            ) : downloadStatus === 'success' ? (
              <>
                <Check className="w-5 h-5" />
                <span>Downloaded Successfully!</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download Recording</span>
              </>
            )}
          </button>

          {/* Additional Info */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>High-quality MP4 recording optimized for social media platforms</p>
            <p className="mt-1">Ready to upload to Twitter/X, Instagram, TikTok, and more</p>
          </div>
        </div>
      </div>
    </div>
  );
} 