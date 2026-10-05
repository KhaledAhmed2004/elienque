import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app';
import config from './config';
import { allowedOrigins } from './app/logging/corsLogger';
import { seedSuperAdmin } from './DB/seedAdmin';
import { seedVehicleConfigs } from './DB/seedVehicleConfig';
import { socketHelper } from './helpers/socketHelper';
import { errorLogger, logger, notifyCritical } from './shared/logger';
import { CacheHelper } from './app/shared/CacheHelper';
import {
  generateStartupSummary,
  type StartupStatus,
} from './shared/startupSummary';
import { createSpinner } from './shared/spinnerHelper';
import { startOutboxWorker } from './app/modules/emailOutbox/outboxWorker';

process.on('uncaughtException', error => {
  errorLogger.error('UncaughtException Detected', error);
  if (server && typeof server.close === 'function') {
    try {
      server.close(() => {
        setTimeout(() => process.exit(1), 500);
      });
    } catch (e) {
      setTimeout(() => process.exit(1), 500);
    }
  } else {
    process.exit(1);
  }
});

let server: any;
async function main() {
  try {
    // Track startup status for beautiful summary
    const startupStatus: Partial<StartupStatus> = {
      environment: config.node_env || 'unknown',
      debugMode: config.node_env === 'development',
      rateLimit: true, // Always active in this setup
      socketIO: false,
      database: { status: 'disconnected' },
      cache: { status: 'disabled' },
    };

    // Connect to database
    const dbSpinner = createSpinner({
      text: 'Connecting to MongoDB...',
      color: 'cyan',
    });
    try {
      await mongoose.connect(config.database_url as string);
      dbSpinner.succeed('MongoDB connected successfully');
      startupStatus.database = {
        status: 'connected',
        message: 'MongoDB connected successfully',
      };
    } catch (dbError) {
      dbSpinner.fail('MongoDB connection failed');
      throw dbError;
    }

    // Seed Super Admin and Vehicle Configs after database connection is successful
    const seedSpinner = createSpinner({
      text: 'Verifying super admin account & system seeds...',
      color: 'cyan',
    });
    await seedSuperAdmin();
    await seedVehicleConfigs();
    seedSpinner.succeed('Super admin & system seeds ready');

    // Initialize CacheHelper (in-memory)
    const cacheSpinner = createSpinner({
      text: 'Initializing cache system...',
      color: 'cyan',
    });
    const cache = CacheHelper.getInstance();
    cacheSpinner.succeed('In-memory cache initialized');
    startupStatus.cache = {
      status: 'initialized',
      message: 'In-memory cache ready',
    };

    if (config.tracing?.performance?.enabled) {
      const thresholdSpinner = createSpinner({
        text: 'Validating performance thresholds...',
        color: 'cyan',
      });
      try {
        const { validateAndWarnThresholds } =
          await import('./app/logging/thresholdValidator');
        validateAndWarnThresholds(config.tracing.performance.thresholds);
        thresholdSpinner.succeed('Performance config validated');
      } catch (err) {
        thresholdSpinner.warn('Threshold validation skipped');
        errorLogger.error('Threshold validation failed:', err);
      }
    }

    const port = Number(config.port) || 5001;
    const host =
      config.node_env === 'development'
        ? '0.0.0.0'
        : (config.ip_address && String(config.ip_address).trim()) || '0.0.0.0';

    const serverSpinner = createSpinner({
      text: `Starting HTTP server on ${host}:${port}...`,
      color: 'cyan',
    });

    server = app.listen(port, host, () => {
      const url = `http://${host}:${port}/`;
      serverSpinner.succeed(`Server is listening at ${url}`);

      startupStatus.server = { url, host, port };

      const socketSpinner = createSpinner({
        text: 'Initializing Socket.IO server...',
        color: 'cyan',
      });

      const io = new Server(server, {
        pingTimeout: 60000,
        cors: {
          origin: allowedOrigins,
          credentials: true,
          methods: ['GET', 'POST'],
        },
      });
      socketHelper.socket(io);
      global.io = io;
      socketSpinner.succeed('Socket.IO ready for real-time connections');

      startupStatus.socketIO = true;
      
      startOutboxWorker(5000); // Poll every 5s

      startupStatus.timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const summary = generateStartupSummary(startupStatus as StartupStatus, {
        style: 'compact',
        borderStyle: 'double',
        width: 63,
        colors: true,
      });

      console.log('\n' + summary + '\n');
    });

    server.on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE') {
        errorLogger.error(`⚠️ Port in use ${host}:${port} (EADDRINUSE)`);
        try {
          server.close(() => {
            setTimeout(() => {
              server = app.listen(port, host, () => {
                logger.info(
                  `♻️ Re-listened on ${host}:${port} after EADDRINUSE`,
                );
              });
            }, 1000);
          });
        } catch (closeErr) {
          errorLogger.error(
            'Failed to close server after EADDRINUSE',
            closeErr as any,
          );
        }
      }
    });
  } catch (error) {
    errorLogger.error('❌ Database connection failed');
    notifyCritical(
      'Database Connection Failed',
      (error as Error)?.message || 'Unknown error',
    );
  }

  process.on('unhandledRejection', error => {
    if (server) {
      server.close(() => {
        errorLogger.error('❌ UnhandledRejection Detected');
        notifyCritical(
          'Unhandled Rejection',
          (error as Error)?.message || 'Unknown error',
        );
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

//SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM IS RECEIVE');
  if (server) {
    server.close();
  }
});
