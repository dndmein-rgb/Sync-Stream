export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
  socketPath: process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/socket.io",
} as const;