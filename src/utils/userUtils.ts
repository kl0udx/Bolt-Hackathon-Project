const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal  
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Purple
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Lavender
  '#85C1E9'  // Sky Blue
];

const ANIMALS = [
  'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Panda', 'Wolf', 'Fox', 'Bear',
  'Hawk', 'Whale', 'Rabbit', 'Deer', 'Owl', 'Shark', 'Falcon', 'Turtle',
  'Penguin', 'Elephant', 'Leopard', 'Octopus'
];

const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Gentle', 'Mighty', 'Wise', 'Bold', 'Kind',
  'Noble', 'Bright', 'Quick', 'Strong', 'Smart', 'Cool', 'Wild', 'Free'
];

const EMOJIS = [
  '🐘', '🦁', '🐯', '🐺', '🦊', '🐻', '🐼', '🐨', '🐸', '🐙',
  '🦅', '🦆', '🐧', '🦋', '🐝', '🐞', '🦄', '🐲', '🦖', '🐳'
];

export function generateUserIdentity(customName?: string) {
  const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const avatarEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  
  if (customName?.trim()) {
    return {
      displayName: customName.trim(),
      userColor,
      avatarEmoji
    };
  }
  
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  
  return {
    displayName: `${adjective} ${animal}`,
    userColor,
    avatarEmoji
  };
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function formatRoomCode(code: string): string {
  return code.toUpperCase().slice(0, 6);
}