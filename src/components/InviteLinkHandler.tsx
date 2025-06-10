import React, { useState, useEffect } from 'react';
import { Users, Clock, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { RoomService } from '../services/roomService';
import { JoinRoomForm } from './JoinRoomForm';
import { InviteLink } from '../types/room';

interface InviteLinkHandlerProps {
  inviteHash: string;
  roomId: string;
  onRoomJoined: (roomData: { userId: string; displayName: string; userColor: string; roomCode: string; roomId: string }) => void;
  onBackToHome: () => void;
}

export function InviteLinkHandler({ inviteHash, onRoomJoined, onBackToHome }: InviteLinkHandlerProps) {
  const [inviteInfo, setInviteInfo] = useState<InviteLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [roomDetails, setRoomDetails] = useState<{ participants: unknown[] } | null>(null);

  useEffect(() => {
    loadInviteInfo();
  }, [inviteHash]);

  const loadInviteInfo = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Get invite link info
      const invite = await RoomService.getInviteLinkInfo(inviteHash);
      
      if (!invite) {
        setError('This invite link is invalid or has expired');
        return;
      }

      setInviteInfo(invite);

      // Try to get room details to show additional info
      try {
        // We don't have the room code yet, so we'll try to get basic room info
        // This might fail if the room code is required, which is expected
        const details = await RoomService.getRoomDetails('PLACEHOLDER');
        setRoomDetails(details);
      } catch {
        // Expected to fail without room code - that's fine
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite information');
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return 'No expiration';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md w-full mx-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Invite</h2>
          <p className="text-gray-600">Checking invite link details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md w-full mx-4">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onBackToHome}
            className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={onBackToHome}
          className="mb-8 text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to Home
        </button>

        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          {/* Invite Info Card */}
          <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md mb-8">
            <div className="text-center mb-6">
              <div className="bg-gradient-to-br from-purple-500 to-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Invited!</h2>
              <p className="text-gray-600">Someone invited you to join their collaboration room</p>
            </div>

            <div className="space-y-4 mb-6">
              {inviteInfo?.metadata?.hostName && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Users className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Invited by</p>
                    <p className="text-gray-900">{inviteInfo.metadata.hostName}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Invite Status</p>
                  <p className="text-gray-900">{getTimeRemaining(inviteInfo?.expiresAt)}</p>
                </div>
              </div>

              {roomDetails && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Users className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Current Participants</p>
                    <p className="text-gray-900">{roomDetails.participants.length} active</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">🔐 Security Notice</h3>
              <p className="text-sm text-blue-700">
                To join this room, you'll still need to enter the room code for security. 
                The person who invited you should provide this separately.
              </p>
            </div>
          </div>

          {/* Join Room Form */}
          <div className="w-full max-w-md">
            <JoinRoomForm onRoomJoined={onRoomJoined} />
          </div>
        </div>
      </div>
    </div>
  );
} 