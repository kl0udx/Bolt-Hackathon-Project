import React, { useState } from 'react';
import { Users, Plus, Loader2 } from 'lucide-react';
import { RoomService } from '../services/roomService';

interface CreateRoomFormProps {
  onRoomCreated: (roomData: { userId: string; displayName: string; userColor: string; roomCode: string; roomId: string }) => void;
}

export function CreateRoomForm({ onRoomCreated }: CreateRoomFormProps) {
  const [hostName, setHostName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const roomData = await RoomService.createRoom({
        hostName: hostName.trim() || undefined
      });
      onRoomCreated(roomData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <div className="bg-gradient-to-br from-purple-500 to-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Room</h2>
        <p className="text-gray-600">Start a new collaboration session</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="hostName" className="block text-sm font-medium text-gray-700 mb-2">
            Your Name (Optional)
          </label>
          <input
            type="text"
            id="hostName"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Enter your name or leave blank for auto-generated"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">
            If left blank, you'll get a fun name like "Blue Tiger"
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Room...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Create Room
            </>
          )}
        </button>
      </form>
    </div>
  );
}