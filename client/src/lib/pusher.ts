import PusherClient from "pusher-js";

let pusherInstance: PusherClient | null = null;

export function getPusher(): PusherClient {
  if (!pusherInstance) {
    pusherInstance = new PusherClient(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    });
  }
  return pusherInstance;
}

export function disconnectPusher(): void {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
