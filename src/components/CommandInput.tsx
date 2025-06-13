import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';

interface CommandInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  placeholder?: string;
}

export function CommandInput({ isOpen, onClose, onSend, placeholder = "Ask AI anything..." }: CommandInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <form 
        onSubmit={handleSubmit}
        className="relative bg-white rounded-lg shadow-xl border border-gray-200"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full p-4 pr-12 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] max-h-[200px]"
          style={{ 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 text-blue-500 hover:text-blue-600 rounded-full hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
} 