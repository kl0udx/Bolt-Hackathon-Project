import React from 'react';
import { X, Download, CheckCircle, Video } from 'lucide-react';

interface RecordingShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  duration: string;
}

export function RecordingShareModal({
  isOpen,
  onClose,
  recordingBlob,
  recordingUrl,
  duration
}: RecordingShareModalProps) {
  if (!isOpen || !recordingBlob || !recordingUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900">Recording Complete</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Recording saved as MP4</span>
          </div>

          {/* Video Preview */}
          <div className="mb-6">
            <video
              src={recordingUrl}
              controls
              className="w-full h-48 bg-gray-900 rounded-lg object-contain"
              preload="metadata"
            />
          </div>
          
          {/* Recording Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600 space-y-2">
              <p>• <strong>Format:</strong> MP4 (Twitter optimized)</p>
              <p>• <strong>Duration:</strong> {duration}</p>
              <p>• <strong>Quality:</strong> 720p@30fps</p>
              <p>• <strong>Audio:</strong> 44.1kHz with noise reduction</p>
              <p>• <strong>File size:</strong> {formatFileSize(recordingBlob)}</p>
            </div>
          </div>

          {/* Twitter Optimization Info */}
          {twitterInfo && (
            <div className={`rounded-lg p-4 mb-6 border ${
              twitterInfo.isOptimalSize 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">🐦 Twitter/X Ready</span>
              </div>
              <p className={`text-sm ${
                twitterInfo.isOptimalSize ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {twitterInfo.recommendation}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                File size: {twitterInfo.sizeInMB}MB • Format: MP4 • Quality: HD
              </p>
            </div>
          )}

          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download Recording
          </button>
        </div>
      </div>
    </div>
  );
} 