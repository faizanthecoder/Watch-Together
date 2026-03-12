import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import type {
  JoinRoomPayload,
  CreateRoomPayload,
  ChatMessagePayload,
  SyncPlayPayload,
  SyncPausePayload,
  SyncSeekPayload,
  VideoLoadPayload,
} from "@shared/schema";
function log(message: string, source = "socket.io") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // REST: Create room
  app.post("/api/rooms", (req, res) => {
    const { username } = req.body as CreateRoomPayload;
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ message: "Username is required" });
    }
    // Room is created on socket join, this just validates
    res.json({ success: true });
  });

  // REST: Check if room exists
  app.get("/api/rooms/:roomId", (req, res) => {
    const room = storage.getRoom(req.params.roomId.toUpperCase());
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json({ exists: true, userCount: room.users.length });
  });

  io.on("connection", (socket) => {
    log(`Socket connected: ${socket.id}`, "socket.io");

    // Create a new room
    socket.on("createRoom", (payload: CreateRoomPayload) => {
      try {
        const { username } = payload;
        if (!username || username.trim().length === 0) {
          socket.emit("error", { message: "Username is required" });
          return;
        }
        const room = storage.createRoom(socket.id, username.trim());
        socket.join(room.id);
        socket.data.roomId = room.id;
        socket.data.username = username.trim();

        socket.emit("roomCreated", {
          room,
          currentUserId: socket.id,
        });

        log(`Room created: ${room.id} by ${username}`, "socket.io");
      } catch (err) {
        socket.emit("error", { message: "Failed to create room" });
      }
    });

    // Join an existing room
    socket.on("joinRoom", (payload: JoinRoomPayload) => {
      try {
        const { roomId, username } = payload;
        const normalizedRoomId = roomId.trim().toUpperCase();

        if (!username || username.trim().length === 0) {
          socket.emit("error", { message: "Username is required" });
          return;
        }

        const room = storage.getRoom(normalizedRoomId);
        if (!room) {
          socket.emit("error", { message: "Room not found. Check the room code and try again." });
          return;
        }

        const updatedRoom = storage.addUserToRoom(normalizedRoomId, {
          id: socket.id,
          username: username.trim(),
          joinedAt: Date.now(),
          isHost: false,
        });

        if (!updatedRoom) {
          socket.emit("error", { message: "Failed to join room" });
          return;
        }

        socket.join(normalizedRoomId);
        socket.data.roomId = normalizedRoomId;
        socket.data.username = username.trim();

        // Send room state to new user
        socket.emit("roomState", {
          room: updatedRoom,
          currentUserId: socket.id,
        });

        // Notify others
        socket.to(normalizedRoomId).emit("userJoined", {
          user: {
            id: socket.id,
            username: username.trim(),
            joinedAt: Date.now(),
            isHost: false,
          },
          room: updatedRoom,
        });

        log(`User ${username} joined room ${normalizedRoomId}`, "socket.io");
      } catch (err) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Load video
    socket.on("loadVideo", (payload: VideoLoadPayload) => {
      try {
        const { roomId } = socket.data;
        if (!roomId) return;
        const { url } = payload;

        const room = storage.updateVideoState(roomId, {
          url,
          isPlaying: false,
          currentTime: 0,
        });
        if (!room) return;

        io.to(roomId).emit("videoLoaded", {
          url,
          username: socket.data.username,
          room,
        });

        log(`Video loaded in room ${roomId}: ${url}`, "socket.io");
      } catch (err) {
        socket.emit("error", { message: "Failed to load video" });
      }
    });

    // Play
    socket.on("play", (payload: SyncPlayPayload) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const { currentTime } = payload;

      storage.updateVideoState(roomId, {
        isPlaying: true,
        currentTime,
      });

      socket.to(roomId).emit("syncPlay", {
        currentTime,
        username: socket.data.username,
      });
    });

    // Pause
    socket.on("pause", (payload: SyncPausePayload) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const { currentTime } = payload;

      storage.updateVideoState(roomId, {
        isPlaying: false,
        currentTime,
      });

      socket.to(roomId).emit("syncPause", {
        currentTime,
        username: socket.data.username,
      });
    });

    // Seek
    socket.on("seek", (payload: SyncSeekPayload) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const { currentTime } = payload;

      storage.updateVideoState(roomId, { currentTime });

      socket.to(roomId).emit("syncSeek", {
        currentTime,
        username: socket.data.username,
      });
    });

    // Chat message
    socket.on("sendMessage", (payload: ChatMessagePayload) => {
      const { roomId, username } = socket.data;
      if (!roomId || !username) return;

      const message = {
        id: randomUUID(),
        userId: socket.id,
        username,
        text: payload.text.trim().slice(0, 500),
        timestamp: Date.now(),
      };

      if (!message.text) return;

      storage.addMessage(roomId, message);
      io.to(roomId).emit("chatMessage", message);
    });

    // Request current room state (e.g., after page navigation)
    socket.on("requestRoomState", () => {
      const { roomId } = socket.data;
      if (!roomId) {
        socket.emit("error", { message: "Not in a room" });
        return;
      }
      const room = storage.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      socket.emit("roomState", { room, currentUserId: socket.id });
    });

    // Disconnect
    socket.on("disconnect", () => {
      const { roomId, username } = socket.data;
      if (!roomId) return;

      const updatedRoom = storage.removeUserFromRoom(roomId, socket.id);

      if (updatedRoom) {
        io.to(roomId).emit("userLeft", {
          userId: socket.id,
          username,
          room: updatedRoom,
        });
      }

      log(`Socket disconnected: ${socket.id} (${username}) from room ${roomId}`, "socket.io");
    });
  });

  return httpServer;
}
