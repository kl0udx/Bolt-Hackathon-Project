import React, { useState } from 'react';
import { X, Copy, Share2, ExternalLink, Check, Loader2, MessageCircle, Mail, Send } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteLink: string;
  roomCode: string;
  isGenerating?: boolean;
}

export function ShareModal({ isOpen, onClose, inviteLink, roomCode, isGenerating }: ShareModalProps) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [roomCodeCopyFeedback, setRoomCodeCopyFeedback] = useState('');

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setRoomCodeCopyFeedback('Copied!');
      setTimeout(() => setRoomCodeCopyFeedback(''), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setRoomCodeCopyFeedback('Copied!');
      setTimeout(() => setRoomCodeCopyFeedback(''), 2000);
    }
  };

  const handleNativeShare = async () => {
    const shareData = {
      title: 'Join my collaboration room',
      text: `Join my room: ${inviteLink || `Room code: ${roomCode}`}`,
      url: inviteLink || window.location.href
    };

    try {
      await navigator.share(shareData);
    } catch {
      // User cancelled or share not supported
      handleCopyLink();
    }
  };

  const handleSocialShare = (platform: string) => {
    const text = encodeURIComponent(`Join my collaboration room: ${inviteLink || `Room code: ${roomCode}`}`);
    const url = encodeURIComponent(inviteLink || window.location.href);
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter': {
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      }
      case 'facebook': {
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      }
      case 'linkedin': {
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      }
      case 'whatsapp': {
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
      }
      case 'telegram': {
        shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
        break;
      }
      case 'email': {
        const subject = encodeURIComponent('Join my collaboration room');
        const body = encodeURIComponent(`Hi! I'd like to invite you to join my collaboration room.\n\n${inviteLink ? `Click this link to join: ${inviteLink}` : `Use this room code: ${roomCode}`}\n\nSee you there!`);
        shareUrl = `mailto:?subject=${subject}&body=${body}`;
        break;
      }
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Share Invite Link</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-600">Generating invite link...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Share this link to invite others to your collaboration room. 
                  They'll still need to enter the room code for security.
                </p>
                
                {/* Link Display */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <code className="text-sm text-gray-700 break-all flex-1">
                      {inviteLink}
                    </code>
                  </div>
                </div>

                {/* Room Code Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Room Code (click to copy):</strong>
                  </p>
                  <button
                    onClick={handleCopyRoomCode}
                    className="bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg px-3 py-2 transition-colors group w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <code className="font-mono text-lg font-bold text-blue-900">{roomCode}</code>
                      <div className="flex items-center gap-2">
                        {roomCodeCopyFeedback ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600">{roomCodeCopyFeedback}</span>
                          </>
                        ) : (
                          <Copy className="w-4 h-4 text-blue-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                  </button>
                  <p className="text-xs text-blue-600 mt-2">
                    Recipients will need this code to join securely.
                  </p>
                </div>
              </div>

              {/* Platform Sharing Options */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Share on your favorite platform:</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSocialShare('whatsapp')}
                    className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('telegram')}
                    className="flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span>Telegram</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('email')}
                    className="flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('twitter')}
                    className="flex items-center justify-center gap-2 bg-blue-400 text-white px-4 py-3 rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Twitter</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('facebook')}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Facebook</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('linkedin')}
                    className="flex items-center justify-center gap-2 bg-blue-800 text-white px-4 py-3 rounded-lg hover:bg-blue-900 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </button>
                </div>
              </div>

              {/* Alternative Actions */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Or use these options:</h4>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copyFeedback ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">{copyFeedback}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleNativeShare}
                    className="flex-1 flex items-center justify-center gap-2 bg-purple-500 text-white px-4 py-3 rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>More Options</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 