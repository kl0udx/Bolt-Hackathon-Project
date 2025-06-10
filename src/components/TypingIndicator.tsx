import React from 'react';

interface TypingUser {
  userId: string;
  displayName: string;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].displayName} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`;
    } else {
      return `${typingUsers[0].displayName} and ${typingUsers.length - 1} others are typing...`;
    }
  };

  return (
    <div className="px-4 py-3 animate-fade-in">
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        {/* Animated dots */}
        <div className="flex gap-1">
          <div 
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '1.4s' }} 
          />
          <div 
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
            style={{ animationDelay: '0.2s', animationDuration: '1.4s' }} 
          />
          <div 
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
            style={{ animationDelay: '0.4s', animationDuration: '1.4s' }} 
          />
        </div>
        
        {/* Typing text */}
        <span className="text-sm text-blue-700 font-medium italic">
          {getTypingText()}
        </span>
        
        {/* User avatars for multiple typers */}
        {typingUsers.length > 1 && (
          <div className="flex -space-x-1 ml-auto">
            {typingUsers.slice(0, 3).map((user, index) => (
              <div
                key={user.userId}
                className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-medium"
                style={{ zIndex: typingUsers.length - index }}
                title={user.displayName}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
            {typingUsers.length > 3 && (
              <div className="w-6 h-6 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-medium">
                +{typingUsers.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}