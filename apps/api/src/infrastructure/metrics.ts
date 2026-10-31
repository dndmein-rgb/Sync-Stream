// apps/api/src/infrastructure/metrics.ts
export type MetricSnapshot = {
  uptimeSec: number;
  process: {
    pid: number;
    nodeVersion: string;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
  };
  sockets: { connected: number };
  rooms: { activeTracked: number };
  playback: {
    commandsAccepted: number;
    commandsRejected: number;
    commandsDuplicate: number;
  };
  chat: {
    messagesSent: number;
    messagesRejected: number;
  };
  auth: {
    httpUnauthorized: number;
    socketUnauthorized: number;
  };
  errors: {
    unhandled: number;
    redis: number;
    postgres: number;
  };
  rateLimits: { hits: number };
};

class MetricsRegistry {
  private readonly startedAt = Date.now();

  socketsConnected = 0;
  roomsTracked = 0;
  playbackCommandsAccepted = 0;
  playbackCommandsRejected = 0;
  playbackCommandsDuplicate = 0;
  chatMessagesSent = 0;
  chatMessagesRejected = 0;
  httpUnauthorized = 0;
  socketUnauthorized = 0;
  unhandledErrors = 0;
  redisErrors = 0;
  postgresErrors = 0;
  rateLimitHits = 0;

  incSockets(delta: number) {
    this.socketsConnected = Math.max(0, this.socketsConnected + delta);
  }

  setRoomsTracked(n: number) {
    this.roomsTracked = Math.max(0, n);
  }

  snapshot(): MetricSnapshot {
    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      },
      sockets: { connected: this.socketsConnected },
      rooms: { activeTracked: this.roomsTracked },
      playback: {
        commandsAccepted: this.playbackCommandsAccepted,
        commandsRejected: this.playbackCommandsRejected,
        commandsDuplicate: this.playbackCommandsDuplicate,
      },
      chat: {
        messagesSent: this.chatMessagesSent,
        messagesRejected: this.chatMessagesRejected,
      },
      auth: {
        httpUnauthorized: this.httpUnauthorized,
        socketUnauthorized: this.socketUnauthorized,
      },
      errors: {
        unhandled: this.unhandledErrors,
        redis: this.redisErrors,
        postgres: this.postgresErrors,
      },
      rateLimits: { hits: this.rateLimitHits },
    };
  }
}

export const metrics = new MetricsRegistry();