import React from 'react';
import { Crown } from 'lucide-react';
import { getInitials } from '../utils/userUtils';

interface ParticipantAvatarProps {
  displayName: string;
  userColor: string;
  isHost?: boolean;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

const ParticipantAvatar = React.memo<ParticipantAvatarProps>(({
  displayName,
  userColor,
  isHost = false,
  isOnline = true,
  size = 'md',
  showStatus = true
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg'
  };

  const statusSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3', 
    lg: 'w-4 h-4'
  };

  const initials = React.useMemo(() => getInitials(displayName), [displayName]);

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium text-white shadow-lg relative overflow-hidden`}
        style={{ backgroundColor: userColor }}
      >
        {initials}
        {isHost && (
          <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
            <Crown className="w-3 h-3 text-yellow-800" />
          </div>
        )}
      </div>
      
      {showStatus && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${statusSizeClasses[size]} rounded-full border-2 border-white ${
          isOnline ? 'bg-green-400' : 'bg-gray-400'
        }`} />
      )}
    </div>
  );
});

ParticipantAvatar.displayName = 'ParticipantAvatar';

export { ParticipantAvatar };