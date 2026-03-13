import type { Express } from "express";
import { type Server } from "http";
import Pusher from "pusher";
import { storage } from "./storage";
import { randomUUID } from "crypto";

function log(message: string, source = "pusher") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

let pusher: Pusher;
function getPusherServer(): Pusher {
  if (!pusher) {
    if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET || !process.env.PUSHER_CLUSTER) {
      throw new Error("Pusher environment variables are not set. Please add PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, and PUSHER_CLUSTER.");
    }
    pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    });
  }
  return pusher;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Create room
  app.post("/api/rooms/create", (req, res) => {
    const { username } = req.body;
    if (!username?.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }
    const userId = randomUUID();
    const room = storage.createRoom(userId, username.trim());
    log(`Room created: ${room.id} by ${username}`);
    res.json({ roomId: room.id, userId, room });
  });

  // Join room
  app.post("/api/rooms/:roomId/join", (req, res) => {
    const { username } = req.body;
    const roomId = req.params.roomId.toUpperCase();

    if (!username?.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }

    const room = storage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found. Check the room code and try again." });
    }

    const userId = randomUUID();
    const user = {
      id: userId,
      username: username.trim(),
      joinedAt: Date.now(),
      isHost: false,
    };

    const updatedRoom = storage.addUserToRoom(roomId, user);
    if (!updatedRoom) {
      return res.status(500).json({ message: "Failed to join room" });
    }

    getPusherServer().trigger(`room-${roomId}`, "user-joined", {
      user,
      users: updatedRoom.users,
    });

    log(`User ${username} joined room ${roomId}`);
    res.json({ userId, room: updatedRoom });
  });

  // Get room
  app.get("/api/rooms/:roomId", (req, res) => {
    const room = storage.getRoom(req.params.roomId.toUpperCase());
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json({ exists: true, userCount: room.users.length, room });
  });

  // Play
  app.post("/api/rooms/:roomId/play", (req, res) => {
    const { userId, currentTime } = req.body;
    const roomId = req.params.roomId.toUpperCase();
    const room = storage.getRoom(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const user = room.users.find((u) => u.id === userId);
    storage.updateVideoState(roomId, { isPlaying: true, currentTime });

    getPusherServer().trigger(`room-${roomId}`, "sync-play", {
      currentTime,
      username: user?.username || "Someone",
    });

    res.json({ success: true });
  });

  // Pause
  app.post("/api/rooms/:roomId/pause", (req, res) => {
    const { userId, currentTime } = req.body;
    const roomId = req.params.roomId.toUpperCase();
    const room = storage.getRoom(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const user = room.users.find((u) => u.id === userId);
    storage.updateVideoState(roomId, { isPlaying: false, currentTime });

    getPusherServer().trigger(`room-${roomId}`, "sync-pause", {
      currentTime,
      username: user?.username || "Someone",
    });

    res.json({ success: true });
  });

  // Seek
  app.post("/api/rooms/:roomId/seek", (req, res) => {
    const { userId, currentTime } = req.body;
    const roomId = req.params.roomId.toUpperCase();
    const room = storage.getRoom(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const user = room.users.find((u) => u.id === userId);
    storage.updateVideoState(roomId, { currentTime });

    getPusherServer().trigger(`room-${roomId}`, "sync-seek", {
      currentTime,
      username: user?.username || "Someone",
    });

    res.json({ success: true });
  });

  // Load video
  app.post("/api/rooms/:roomId/load-video", (req, res) => {
    const { userId, url } = req.body;
    const roomId = req.params.roomId.toUpperCase();
    const room = storage.getRoom(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const user = room.users.find((u) => u.id === userId);
    const updatedRoom = storage.updateVideoState(roomId, {
      url,
      isPlaying: false,
      currentTime: 0,
    });

    getPusherServer().trigger(`room-${roomId}`, "video-loaded", {
      url,
      username: user?.username || "Someone",
      videoState: updatedRoom?.videoState,
    });

    res.json({ success: true });
  });

  // Chat
  app.post("/api/rooms/:roomId/chat", (req, res) => {
    const { userId, text } = req.body;
    const roomId = req.params.roomId.toUpperCase();
    const room = storage.getRoom(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const user = room.users.find((u) => u.id === userId);
    if (!user) return res.status(403).json({ message: "Not in room" });

    const trimmed = text?.trim().slice(0, 500);
    if (!trimmed) return res.status(400).json({ message: "Empty message" });

    const message = {
      id: randomUUID(),
      userId,
      username: user.username,
      text: trimmed,
      timestamp: Date.now(),
    };

    storage.addMessage(roomId, message);
    getPusherServer().trigger(`room-${roomId}`, "chat-message", message);

    res.json({ success: true });
  });

  // Leave
  app.post("/api/rooms/:roomId/leave", (req, res) => {
    const { userId } = req.body;
    const roomId = req.params.roomId.toUpperCase();
    const room = storage.getRoom(roomId);
    if (!room) return res.json({ success: true });

    const user = room.users.find((u) => u.id === userId);
    const updatedRoom = storage.removeUserFromRoom(roomId, userId);

    if (user) {
      getPusherServer().trigger(`room-${roomId}`, "user-left", {
        userId,
        username: user.username,
        users: updatedRoom?.users || [],
      });
    }

    log(`User ${user?.username} left room ${roomId}`);
    res.json({ success: true });
  });

  return httpServer;
}
