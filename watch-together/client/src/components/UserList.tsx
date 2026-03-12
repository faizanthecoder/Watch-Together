import { Users, Crown } from "lucide-react";
import type { RoomUser } from "@shared/schema";

interface UserListProps {
  users: RoomUser[];
  currentUserId: string;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function getAvatarColor(username: string): string {
  const colors = [
    "from-violet-500/30 to-violet-600/20",
    "from-blue-500/30 to-blue-600/20",
    "from-emerald-500/30 to-emerald-600/20",
    "from-amber-500/30 to-amber-600/20",
    "from-rose-500/30 to-rose-600/20",
    "from-cyan-500/30 to-cyan-600/20",
    "from-fuchsia-500/30 to-fuchsia-600/20",
    "from-orange-500/30 to-orange-600/20",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getTextColor(username: string): string {
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

export function UserList({ users, currentUserId }: UserListProps) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 shrink-0">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Viewers</span>
        <span
          data-testid="text-viewer-count"
          className="ml-auto inline-flex items-center gap-1"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-muted-foreground">{users.length} online</span>
        </span>
      </div>

      {/* User list */}
      <div data-testid="user-list" className="px-3 py-2 space-y-1">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          return (
            <div
              key={user.id}
              data-testid={`user-item-${user.id}`}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover-elevate group"
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(user.username)} flex items-center justify-center shrink-0 relative`}
              >
                <span className={`text-xs font-bold ${getTextColor(user.username)}`}>
                  {getInitials(user.username)}
                </span>
                {/* Online dot */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid={`text-username-${user.id}`}
                    className="text-sm font-medium truncate"
                  >
                    {user.username}
                  </span>
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground shrink-0">(you)</span>
                  )}
                </div>
                {user.isHost && (
                  <div className="flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">Host</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
