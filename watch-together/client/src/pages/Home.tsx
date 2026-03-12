import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Film, Users, Zap, Play, Link2, Monitor } from "lucide-react";
import type { Room } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    socket.on("roomCreated", ({ room, currentUserId }: { room: Room; currentUserId: string }) => {
      sessionStorage.setItem("watchParty_userId", currentUserId);
      sessionStorage.setItem("watchParty_username", username);
      setLocation(`/room/${room.id}`);
    });

    socket.on("roomState", ({ room, currentUserId }: { room: Room; currentUserId: string }) => {
      sessionStorage.setItem("watchParty_userId", currentUserId);
      sessionStorage.setItem("watchParty_username", username);
      setLocation(`/room/${room.id}`);
    });

    socket.on("error", ({ message }: { message: string }) => {
      setIsConnecting(false);
      toast({
        title: "Something went wrong",
        description: message,
        variant: "destructive",
      });
    });

    return () => {
      socket.off("roomCreated");
      socket.off("roomState");
      socket.off("error");
    };
  }, [username, setLocation, toast]);

  const handleCreateRoom = () => {
    if (!username.trim()) {
      toast({ title: "Username required", description: "Please enter a username to continue.", variant: "destructive" });
      return;
    }
    setIsConnecting(true);
    const socket = getSocket();
    socket.emit("createRoom", { username: username.trim() });
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      toast({ title: "Username required", description: "Please enter a username to continue.", variant: "destructive" });
      return;
    }
    if (!roomCode.trim()) {
      toast({ title: "Room code required", description: "Please enter a room code to join.", variant: "destructive" });
      return;
    }
    setIsConnecting(true);
    const socket = getSocket();
    socket.emit("joinRoom", { roomId: roomCode.trim(), username: username.trim() });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">WatchParty</span>
          </div>
          <div className="ml-auto">
            <span className="text-xs text-muted-foreground">Watch videos together, in sync</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Real-time video sync
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            Watch videos{" "}
            <span className="text-primary">together</span>,{" "}
            perfectly in sync
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Create a room, invite your friends, and watch any video together. Every play, pause, and seek stays synchronized in real time.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-12">
          {[
            { icon: Monitor, title: "Sync playback", desc: "Play, pause & seek together" },
            { icon: Users, title: "Live chat", desc: "Chat while you watch" },
            { icon: Link2, title: "Easy sharing", desc: "Share a room code instantly" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-card-border rounded-lg p-4 text-center hover-elevate">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm font-semibold mb-1">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>

        {/* Main card */}
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6">
            <div className="mb-5">
              <Label htmlFor="username" className="text-sm font-medium mb-2 block">
                Your display name
              </Label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="e.g. Alex, Jordan, Sam..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                maxLength={30}
                className="text-sm"
                disabled={isConnecting}
              />
            </div>

            <Tabs defaultValue="create">
              <TabsList className="w-full mb-5" data-testid="tabs-room-mode">
                <TabsTrigger value="create" className="flex-1" data-testid="tab-create-room">
                  Create room
                </TabsTrigger>
                <TabsTrigger value="join" className="flex-1" data-testid="tab-join-room">
                  Join room
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-0">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Start a new room and invite others with the room code. You'll be the host.
                  </p>
                  <Button
                    data-testid="button-create-room"
                    className="w-full"
                    size="lg"
                    onClick={handleCreateRoom}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Creating room...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Film className="w-4 h-4" />
                        Create a room
                      </span>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="join" className="mt-0">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="roomCode" className="text-sm font-medium mb-2 block">
                      Room code
                    </Label>
                    <Input
                      id="roomCode"
                      data-testid="input-room-code"
                      placeholder="e.g. ABC123"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                      maxLength={6}
                      className="font-mono tracking-widest text-center text-sm uppercase"
                      disabled={isConnecting}
                    />
                  </div>
                  <Button
                    data-testid="button-join-room"
                    className="w-full"
                    size="lg"
                    onClick={handleJoinRoom}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Joining...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Join room
                      </span>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        No account needed &mdash; just a username
      </footer>
    </div>
  );
}
