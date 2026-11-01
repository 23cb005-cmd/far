import type { Server } from 'node:http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env, isDevelopment } from './config/env';
import { logger } from './config/logger';
import { registerJobs, stopJobs } from './jobs';
import { version } from './version';

async function start(): Promise<void> {
  await connectDb();

  if (env.JOBS_ENABLED) {
    registerJobs();
  }

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, version },
      `FarmFair API listening on http://localhost:${env.PORT}${
        isDevelopment ? ' (docs at /api/docs)' : ''
      }`,
    );
  });

  // Fail fast if the port is taken, rather than hanging with no listener.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal({ port: env.PORT }, 'Port is already in use');
    } else {
      logger.fatal({ err: error.message }, 'HTTP server error');
    }
    process.exit(1);
  });

  /**
   * Graceful shutdown: stop accepting connections, let in-flight requests
   * finish, then close the database. A hard deadline guards against a wedged
   * connection keeping the process alive forever.
   */
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out; exiting immediately');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    try {
      stopJobs();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDb();
      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: (error as Error).message }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error.message, stack: error.stack }, 'Uncaught exception');
    void shutdown('uncaughtException');
  });
}

start().catch((error: unknown) => {
  logger.fatal(
    { err: error instanceof Error ? error.message : String(error) },
    'Failed to start the server',
  );
  process.exit(1);
});
