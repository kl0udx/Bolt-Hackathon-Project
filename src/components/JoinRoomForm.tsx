import React, { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { RoomService } from '../services/roomService';
import { formatRoomCode, isValidRoomCode } from '../utils/roomUtils';

interface JoinRoomFormProps {
  onRoomJoined: (roomData: { userId: string; displayName: string; userColor: string; roomCode: string; roomId: string }) => void;
}

export function JoinRoomForm({ onRoomJoined }: JoinRoomFormProps) {
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatRoomCode(e.target.value);
    setRoomCode(value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      setIsLoading(false);
      return;
    }

    if (!isValidRoomCode(roomCode)) {
      setError('Room code must be 6 characters (letters and numbers)');
      setIsLoading(false);
      return;
    }

    try {
      const roomData = await RoomService.joinRoom(roomCode, {
        displayName: displayName.trim() || undefined
      });
      onRoomJoined({ ...roomData, roomCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Room</h2>
        <p className="text-gray-600">Enter a room code to join the session</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-2">
            Room Code *
          </label>
          <input
            type="text"
            id="roomCode"
            value={roomCode}
            onChange={handleRoomCodeChange}
            placeholder="ABC123"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center text-lg font-mono tracking-wider uppercase"
            maxLength={6}
            required
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
            Your Name (Optional)
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name or leave blank for auto-generated"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">
            If left blank, you'll get a fun name like "Red Eagle"
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !roomCode.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Joining Room...
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              Join Room
            </>
          )}
        </button>
      </form>
    </div>
  );
}