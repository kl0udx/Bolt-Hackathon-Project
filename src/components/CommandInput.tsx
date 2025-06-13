import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

interface CommandInputProps {
  onSubmit: (message: string) => void;
  onClose: () => void;
  roomId: string;
  userId: string;
  isLocked?: boolean;
  lockedBy?: string | null;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  onSubmit,
  onClose,
  roomId,
  userId,
  isLocked = false,
  lockedBy = null
}) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLocked) return;
    onSubmit(message.trim());
    setMessage('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (message.trim() && !isLocked) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div
      className="fixed z-50 left-1/2 bottom-24 transform -translate-x-1/2 flex flex-col items-center w-full"
      style={{ minWidth: 0 }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex items-center w-full max-w-3xl bg-white rounded-lg shadow border border-gray-200 px-4 py-3"
        style={{ minWidth: 420, maxWidth: 700 }}
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLocked ? (lockedBy ? `Locked by ${lockedBy}` : 'Input locked') : 'Ask the AI assistant…'}
          disabled={isLocked}
          className="flex-1 bg-transparent outline-none border-none text-lg placeholder-gray-400 px-4 h-14"
          style={{ minWidth: 0 }}
        />
        <button
          type="submit"
          disabled={!message.trim() || isLocked}
          className="ml-2 p-3 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center h-12 w-12"
        >
          <Send className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 px-3 py-2 text-gray-400 hover:text-gray-700 text-base bg-transparent border-none rounded-lg"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}; 