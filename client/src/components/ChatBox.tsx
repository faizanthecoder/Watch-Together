import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

interface ChatBoxProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getColorForUser(username: string): string {
  const colors = [
    "text-violet-400",
    "text-blue-400",
    "text-emerald-400",
    "text-amber-400",
    "text-rose-400",
    "text-cyan-400",
    "text-fuchsia-400",
    "text-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function getAvatarColor(username: string): string {
  const colors = [
    "bg-violet-500/20",
    "bg-blue-500/20",
    "bg-emerald-500/20",
    "bg-amber-500/20",
    "bg-rose-500/20",
    "bg-cyan-500/20",
    "bg-fuchsia-500/20",
    "bg-orange-500/20",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function ChatBox({ messages, currentUserId, onSendMessage }: ChatBoxProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 shrink-0">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Live chat</span>
        <span
          data-testid="text-message-count"
          className="ml-auto text-xs text-muted-foreground"
        >
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        data-testid="chat-messages"
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 chat-scroll"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No messages yet. Say something!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                data-testid={`chat-message-${msg.id}`}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${getAvatarColor(msg.username)}`}
                >
                  <span className={getColorForUser(msg.username)}>
                    {getInitials(msg.username)}
                  </span>
                </div>

                <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
                  <div className="flex items-baseline gap-2">
                    {!isOwn && (
                      <span className={`text-xs font-semibold ${getColorForUser(msg.username)}`}>
                        {msg.username}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground/60">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-lg text-sm leading-relaxed break-words ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/50 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            data-testid="input-chat-message"
            placeholder="Send a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={500}
            className="resize-none text-sm min-h-0 leading-5"
            style={{ height: "36px", maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "36px";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <Button
            data-testid="button-send-message"
            size="icon"
            onClick={handleSend}
            disabled={!text.trim()}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/50 mt-1 pl-1">Enter to send, Shift+Enter for newline</p>
      </div>
    </div>
  );
}
