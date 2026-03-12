import { z } from "zod";

export interface RoomUser {
  id: string;
  username: string;
  joinedAt: number;
  isHost: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface VideoState {
  url: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
}

export interface Room {
  id: string;
  hostId: string;
  users: RoomUser[];
  videoState: VideoState;
  messages: ChatMessage[];
  createdAt: number;
}

export const joinRoomSchema = z.object({
  roomId: z.string().min(1),
  username: z.string().min(1).max(30),
});

export const createRoomSchema = z.object({
  username: z.string().min(1).max(30),
});

export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;

export interface RoomStatePayload {
  room: Room;
  currentUserId: string;
}

export interface SyncPlayPayload {
  currentTime: number;
  username: string;
}

export interface SyncPausePayload {
  currentTime: number;
  username: string;
}

export interface SyncSeekPayload {
  currentTime: number;
  username: string;
}

export interface VideoLoadPayload {
  url: string;
  username: string;
}

export interface ChatMessagePayload {
  text: string;
}
