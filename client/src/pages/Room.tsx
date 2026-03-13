import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { getPusher } from "@/lib/pusher";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ChatBox } from "@/components/ChatBox";
import { UserList } from "@/components/UserList";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Check,
  LogOut,
  Play,
  Link2,
  Upload,
  ChevronRight,
} from "lucide-react";
import type { Room as RoomType, ChatMessage, RoomUser, VideoState } from "@shared/schema";
import { Input } from "@/components/ui/input";

interface SyncTrigger {
  action: "play" | "pause" | "seek";
  time: number;
  id: number;
}

async function roomApi(roomId: string, action: string, body: object) {
  return fetch(`/api/rooms/${roomId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function Room() {
  const params = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [videoState, setVideoState] = useState<VideoState>({
    url: null,
    isPlaying: false,
    currentTime: 0,
    lastUpdated: Date.now(),
  });
  const [syncTrigger, setSyncTrigger] = useState<SyncTrigger | null>(null);
  const syncCounter = useRef(0);

  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");

  const roomId = params.roomId?.toUpperCase();
  const userIdRef = useRef<string>("");

  const addNotification = useCallback((msg: string) => {
    setNotifications((prev) => [...prev.slice(-4), msg]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n !== msg));
    }, 4000);
  }, []);

  useEffect(() => {
    if (!roomId) {
      setLocation("/");
      return;
    }

    const storedUserId = sessionStorage.getItem("watchParty_userId");
    const storedUsername = sessionStorage.getItem("watchParty_username");
    const storedRoom = sessionStorage.getItem("watchParty_room");

    if (!storedUsername) {
      setConnecting(false);
      setConnectionError("Please enter a username to join a room.");
      return;
    }

    const initRoom = async () => {
      try {
        let userId = storedUserId;
        let initialRoom: RoomType | null = null;

        if (storedUserId && storedRoom) {
          initialRoom = JSON.parse(storedRoom);
          userId = storedUserId;
        } else {
          const res = await fetch(`/api/rooms/${roomId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: storedUsername }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to join room");
          userId = data.userId;
          initialRoom = data.room;
          sessionStorage.setItem("watchParty_userId", userId!);
          sessionStorage.setItem("watchParty_room", JSON.stringify(initialRoom));
        }

        userIdRef.current = userId!;
        setCurrentUserId(userId!);
        setRoom(initialRoom);
        setUsers(initialRoom!.users);
        setMessages(initialRoom!.messages);
        setVideoState(initialRoom!.videoState);
        setConnecting(false);

        // Subscribe to Pusher channel
        const pusher = getPusher();
        const channel = pusher.subscribe(`room-${roomId}`);

        channel.bind("user-joined", ({ user, users }: { user: RoomUser; users: RoomUser[] }) => {
          setUsers(users);
          addNotification(`${user.username} joined the room`);
        });

        channel.bind("user-left", ({ username, users }: { userId: string; username: string; users: RoomUser[] }) => {
          setUsers(users);
          addNotification(`${username} left the room`);
        });

        channel.bind("video-loaded", ({ url, username, videoState: vs }: { url: string; username: string; videoState: VideoState }) => {
          if (vs) setVideoState(vs);
          else setVideoState({ url, isPlaying: false, currentTime: 0, lastUpdated: Date.now() });
          addNotification(`${username} loaded a video`);
        });

        channel.bind("sync-play", ({ currentTime, username }: { currentTime: number; username: string }) => {
          setSyncTrigger({ action: "play", time: currentTime, id: ++syncCounter.current });
          setVideoState((prev) => ({ ...prev, isPlaying: true, currentTime }));
          addNotification(`${username} pressed play`);
        });

        channel.bind("sync-pause", ({ currentTime, username }: { currentTime: number; username: string }) => {
          setSyncTrigger({ action: "pause", time: currentTime, id: ++syncCounter.current });
          setVideoState((prev) => ({ ...prev, isPlaying: false, currentTime }));
          addNotification(`${username} paused`);
        });

        channel.bind("sync-seek", ({ currentTime, username }: { currentTime: number; username: string }) => {
          setSyncTrigger({ action: "seek", time: currentTime, id: ++syncCounter.current });
          addNotification(`${username} skipped to ${Math.floor(currentTime)}s`);
        });

        channel.bind("chat-message", (message: ChatMessage) => {
          setMessages((prev) => [...prev, message]);
        });
      } catch (err: any) {
        setConnecting(false);
        setConnectionError(err.message || "Could not connect to room");
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    };

    initRoom();

    // Notify server when tab closes
    const handleUnload = () => {
      const uid = userIdRef.current;
      if (!uid) return;
      const blob = new Blob(
        [JSON.stringify({ userId: uid })],
        { type: "application/json" }
      );
      navigator.sendBeacon(`/api/rooms/${roomId}/leave`, blob);
      sessionStorage.removeItem("watchParty_userId");
      sessionStorage.removeItem("watchParty_room");
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      const pusher = getPusher();
      pusher.unsubscribe(`room-${roomId}`);
    };
  }, [roomId, setLocation, toast, addNotification]);

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLeave = () => {
    const uid = userIdRef.current;
    if (uid && roomId) {
      roomApi(roomId, "leave", { userId: uid });
    }
    sessionStorage.removeItem("watchParty_userId");
    sessionStorage.removeItem("watchParty_username");
    sessionStorage.removeItem("watchParty_room");
    const pusher = getPusher();
    pusher.unsubscribe(`room-${roomId}`);
    setLocation("/");
  };

  const handlePlay = useCallback((currentTime: number) => {
    if (!roomId) return;
    roomApi(roomId, "play", { userId: userIdRef.current, currentTime });
  }, [roomId]);

  const handlePause = useCallback((currentTime: number) => {
    if (!roomId) return;
    roomApi(roomId, "pause", { userId: userIdRef.current, currentTime });
  }, [roomId]);

  const handleSeek = useCallback((currentTime: number) => {
    if (!roomId) return;
    roomApi(roomId, "seek", { userId: userIdRef.current, currentTime });
  }, [roomId]);

  const handleLoadVideo = useCallback((url: string) => {
    if (!roomId) return;
    roomApi(roomId, "load-video", { userId: userIdRef.current, url });
  }, [roomId]);

  const handleSendMessage = useCallback((text: string) => {
    if (!roomId) return;
    roomApi(roomId, "chat", { userId: userIdRef.current, text });
  }, [roomId]);

  const isHost = users.find((u) => u.id === currentUserId)?.isHost ?? false;

  if (connecting) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">Connecting to room...</h3>
          <p className="text-sm text-muted-foreground">Getting everything ready</p>
        </div>
      </div>
    );
  }

  if (connectionError || (!room && !connecting)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center max-w-sm">
          <h3 className="text-xl font-bold mb-2">Couldn't connect to room</h3>
          <p className="text-muted-foreground text-sm mb-6">
            {connectionError || "The room may have closed or the code is invalid."}
          </p>
          <Button onClick={() => setLocation("/")} className="gap-2">
            <LogOut className="w-4 h-4" />
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  const currentUsername = users.find((u) => u.id === currentUserId)?.username || "";

  return (
    <div className="min-h-screen bg-background flex flex-col dark">
      <header className="bg-card border-b border-card-border shrink-0 z-10">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 mr-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Play className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="text-sm font-bold hidden sm:block">WatchParty</span>
          </div>

          <div className="flex items-center gap-2 bg-muted/60 rounded-md px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Room</span>
            <span data-testid="text-room-code" className="text-sm font-mono font-bold tracking-widest">
              {roomId}
            </span>
            <Button
              data-testid="button-copy-room-code"
              size="icon"
              variant="ghost"
              className="w-6 h-6 text-muted-foreground"
              onClick={handleCopyRoomCode}
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs text-muted-foreground font-medium">LIVE</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {users.length} watching
          </div>

          <div className="flex-1" />

          {currentUsername && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Watching as <span className="text-foreground font-medium">{currentUsername}</span>
              {isHost && <span className="text-amber-400 ml-1">(host)</span>}
            </span>
          )}

          {isHost && (
            <Button
              data-testid="button-open-load-video"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setShowVideoPanel(!showVideoPanel)}
            >
              <Upload className="w-3.5 h-3.5" />
              Load video
            </Button>
          )}

          <Button
            data-testid="button-leave-room"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={handleLeave}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>

        {isHost && showVideoPanel && (
          <div className="border-t border-border/50 px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2 max-w-xl">
              <Input
                data-testid="input-header-video-url"
                placeholder="Paste a video URL (mp4, webm...)"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && videoUrlInput.trim()) {
                    handleLoadVideo(videoUrlInput.trim());
                    setVideoUrlInput("");
                    setShowVideoPanel(false);
                  }
                }}
                className="text-sm h-8"
              />
              <Button
                data-testid="button-header-load-url"
                size="sm"
                onClick={() => {
                  if (videoUrlInput.trim()) {
                    handleLoadVideo(videoUrlInput.trim());
                    setVideoUrlInput("");
                    setShowVideoPanel(false);
                  }
                }}
                disabled={!videoUrlInput.trim()}
                className="gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                Load
              </Button>
              <label className="cursor-pointer">
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <span>
                    <Upload className="w-3.5 h-3.5" />
                    File
                  </span>
                </Button>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      handleLoadVideo(url);
                      setShowVideoPanel(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">
            <div className="w-full">
              <VideoPlayer
                videoUrl={videoState.url}
                isPlaying={videoState.isPlaying}
                currentTime={videoState.currentTime}
                isHost={isHost}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onLoadVideo={handleLoadVideo}
                syncTrigger={syncTrigger}
              />
            </div>

            {notifications.length > 0 && (
              <div className="space-y-1">
                {notifications.map((n, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5 animate-fade-in"
                  >
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {n}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-80 xl:w-96 flex flex-col border-l border-border/50 shrink-0 overflow-hidden">
          <div className="border-b border-border/50">
            <UserList users={users} currentUserId={currentUserId} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatBox
              messages={messages}
              currentUserId={currentUserId}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
