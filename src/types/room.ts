export interface Room {
  id: string;
  room_code: string;
  host_user_id?: string;
  created_at: string;
  expires_at: string;
  max_participants: number;
  is_active: boolean;
}

export interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  user_color: string;
  is_host: boolean;
  joined_at: string;
  last_seen: string;
  is_online: boolean;
}

export interface CreateRoomRequest {
  hostName?: string;
}

export interface CreateRoomResponse {
  roomCode: string;
  roomId: string;
  userId: string;
  displayName: string;
  userColor: string;
}

export interface JoinRoomRequest {
  displayName?: string;
}

export interface JoinRoomResponse {
  userId: string;
  displayName: string;
  userColor: string;
  roomId: string;
  settings?: any;
  maxParticipants?: number;
}

export interface RoomDetailsResponse {
  room: {
    id: string;
    roomCode: string;
    createdAt: string;
    expiresAt: string;
    participantCount: number;
    isActive: boolean;
  };
  participants: Array<{
    userId: string;
    displayName: string;
    userColor: string;
    avatarEmoji?: string;
    isHost: boolean;
    isOnline: boolean;
  }>;
}

export interface InviteLink {
  id: string;
  roomId: string;
  roomCode: string;
  inviteHash: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  clickCount: number;
  isActive: boolean;
  metadata?: {
    roomName?: string;
    hostName?: string;
    participantCount?: number;
  };
}

export interface CreateInviteLinkRequest {
  roomId: string;
  userId: string;
  expirationHours?: number;
}

export interface CreateInviteLinkResponse {
  inviteLink: string;
  inviteHash: string;
  expiresAt?: string;
}