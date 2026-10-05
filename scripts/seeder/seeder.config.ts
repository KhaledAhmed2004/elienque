import mongoose from 'mongoose';
import config from '../../src/config';

const args = process.argv.slice(2);

/**
 * Production safety guard.
 * Blocks seeder from running in production unless --force is explicitly passed.
 */
export function enforceProductionGuard(): void {
  if (config.node_env === 'production' && !args.includes('--force')) {
    console.error(
      '\n⛔  SEEDER BLOCKED: Cannot run seeder in NODE_ENV=production.',
    );
    console.error(
      '    If you are absolutely sure, re-run with --force flag.\n',
    );
    process.exit(1);
  }
}

/**
 * Parse CLI args into a structured options object.
 */
export type SeederOptions = {
  only: string | null;   // --only=areas | --only=chauffeurs | --only=users
  fresh: boolean;        // --fresh  → drops seeded data and re-seeds
  verbose: boolean;      // --verbose → per-document detailed logging
  force: boolean;        // --force  → override production guard
}

export function parseArgs(): SeederOptions {
  const onlyArg = args.find((a) => a.startsWith('--only='));
  return {
    only: onlyArg ? onlyArg.split('=')[1] : null,
    fresh: args.includes('--fresh'),
    verbose: args.includes('--verbose'),
    force: args.includes('--force'),
  };
}

/**
 * Establish Mongoose connection.
 */
export async function connectDB(): Promise<void> {
  const dbUrl =
    (config.database_url as string) ||
    'mongodb://127.0.0.1:27018/moeb26?replicaSet=rs0';

  await mongoose.connect(dbUrl);
}

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
