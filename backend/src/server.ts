import http from 'http';
import { app } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utilities/logger';

let server: http.Server | null = null;

export const startServer = async (): Promise<http.Server> => {
  try {
    // Connect to database before accepting requests
    await connectDatabase();

    server = app.listen(config.port, () => {
      logger.info(
        `Server running in [${config.nodeEnv}] mode on port ${config.port}`
      );
      logger.info(`Health check available at http://localhost:${config.port}/api/health`);
    });

    return server;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Server failed to start: ${errorMessage}`);
    process.exit(1);
  }
};

const handleShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      logger.info('Process terminated gracefully');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}
