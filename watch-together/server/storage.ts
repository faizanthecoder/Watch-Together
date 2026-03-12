import { randomUUID } from "crypto";
import type { Room, RoomUser, ChatMessage, VideoState } from "@shared/schema";

export interface IStorage {
  createRoom(hostId: string, hostUsername: string): Room;
  getRoom(roomId: string): Room | undefined;
  addUserToRoom(roomId: string, user: RoomUser): Room | undefined;
  removeUserFromRoom(roomId: string, userId: string): Room | undefined;
  updateVideoState(roomId: string, state: Partial<VideoState>): Room | undefined;
  addMessage(roomId: string, message: ChatMessage): Room | undefined;
  deleteRoom(roomId: string): void;
}

export class MemStorage implements IStorage {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, hostUsername: string): Room {
    const roomId = this.generateRoomId();
    const room: Room = {
      id: roomId,
      hostId,
      users: [{
        id: hostId,
        username: hostUsername,
        joinedAt: Date.now(),
        isHost: true,
      }],
      videoState: {
        url: null,
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
      },
      messages: [],
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId: string, user: RoomUser): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    if (!room.users.find(u => u.id === user.id)) {
      room.users.push(user);
    }
    return room;
  }

  removeUserFromRoom(roomId: string, userId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    room.users = room.users.filter(u => u.id !== userId);
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      return undefined;
    }
    if (room.hostId === userId && room.users.length > 0) {
      room.hostId = room.users[0].id;
      room.users[0].isHost = true;
    }
    return room;
  }

  updateVideoState(roomId: string, state: Partial<VideoState>): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    room.videoState = { ...room.videoState, ...state, lastUpdated: Date.now() };
    return room;
  }

  addMessage(roomId: string, message: ChatMessage): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    room.messages.push(message);
    if (room.messages.length > 200) {
      room.messages = room.messages.slice(-200);
    }
    return room;
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  private generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const storage = new MemStorage();
