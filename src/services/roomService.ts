import { apiService } from './api';
import { CreateRoomRequest, CreateRoomResponse, JoinRoomRequest, JoinRoomResponse, RoomDetailsResponse, CreateInviteLinkRequest, CreateInviteLinkResponse, InviteLink } from '../types/room';

export class RoomService {
  static async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    return apiService.createRoom(request);
  }

  static async getRoomDetails(roomCode: string): Promise<RoomDetailsResponse> {
    return apiService.getRoomDetails(roomCode);
  }

  static async joinRoom(roomCode: string, request: JoinRoomRequest): Promise<JoinRoomResponse> {
    return apiService.joinRoom(roomCode, request);
  }

  static async updateParticipant(userId: string, updates: { displayName?: string; isOnline?: boolean }): Promise<void> {
    return apiService.updateParticipant(userId, updates);
  }

  static async leaveRoom(userId: string): Promise<void> {
    return apiService.leaveRoom(userId);
  }

  static async createInviteLink(request: CreateInviteLinkRequest): Promise<CreateInviteLinkResponse> {
    return apiService.createInviteLink(request);
  }

  static async getInviteLinkInfo(inviteHash: string): Promise<InviteLink | null> {
    return apiService.getInviteLinkInfo(inviteHash);
  }
}