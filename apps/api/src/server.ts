import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { prisma } from "./infrastructure/prisma.js";
import { closeRedis } from "./infrastructure/redis.js";
import { createSocketServer } from "./modules/realtime/socket-server.js";

async function main() {
  const app = createApp();
  const httpServer = createServer(app);

  const io = createSocketServer(httpServer);

  httpServer.listen(config.PORT, () => {
    logger.info(`syncstream-api listening on port ${config.PORT}`);
    logger.info(`Socket.IO path: ${config.SOCKET_PATH}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Shutting down API (${signal})`);

    io.close();

    httpServer.close(async () => {
      try {
        await prisma.$disconnect();
        await closeRedis();
        logger.info("API shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error(err, "Error during API shutdown");
        process.exit(1);
      }
    });

    setTimeout(() => process.exit(1), 15_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});