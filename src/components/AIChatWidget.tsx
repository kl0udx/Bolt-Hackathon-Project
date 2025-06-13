import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';

interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: string;
  provider?: string;
  isAI: boolean;
}

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  selectedProvider: string;
}

export function AIChatWidget({ isOpen, onClose, roomId, userId, selectedProvider }: AIChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, lastMessage } = useWebRTC(roomId, userId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        userId,
        content: lastMessage,
        timestamp: new Date().toISOString(),
        isAI: false
      }]);
    }
  }, [lastMessage, userId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      userId,
      content: inputMessage,
      timestamp: new Date().toISOString(),
      isAI: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send user message
      await sendMessage(inputMessage);

      // TODO: Send to AI provider and handle response
      // For now, just simulate an AI response
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          userId: 'ai',
          content: `This is a simulated response from ${selectedProvider}. In the next phase, we'll integrate with the actual AI provider.`,
          timestamp: new Date().toISOString(),
          provider: selectedProvider,
          isAI: true
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-lg shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">AI Chat</h3>
          <span className="text-sm text-gray-500">({selectedProvider})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isAI ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.isAI
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {message.isAI && (
                <div className="text-xs text-gray-500 mb-1">
                  {message.provider}
                </div>
              )}
              <div className="text-sm">{message.content}</div>
              <div className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
} 