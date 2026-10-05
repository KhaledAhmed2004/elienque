/**
 * Seeder CLI Orchestrator — Entry Point
 *
 * Execution Pipeline (dependency order):
 *   1. enforceProductionGuard()   — blocks on NODE_ENV=production without --force
 *   2. connectDB()                — establish Mongoose connection
 *   3. seedServiceAreas()         — upsert areas, build areaMap
 *   4. seedChauffeurs()           — create users + vehicles, build chauffeurIds
 *   5. seedOperators()            — create operators with pre-linked favorites
 *   6. seedEdgeCaseUsers()        — pending / suspended status variants
 *   7. printSummaryTable()        — formatted credential table
 *   8. disconnectDB()             — graceful shutdown
 *
 * CLI Flags:
 *   --only=areas       Seed only service areas
 *   --only=chauffeurs  Seed only chauffeurs + vehicles
 *   --only=operators   Seed only operators
 *   --only=edges       Seed only edge-case users
 *   --fresh            Drop ALL seeded users/vehicles before re-seeding (DEV only)
 *   --verbose          Show per-document skipped messages
 *   --force            Override production guard (dangerous — use with care)
 *
 * Usage:
 *   npm run seed
 *   npm run seed:fresh
 *   npm run seed -- --only=chauffeurs --verbose
 */

import chalk from 'chalk';
import {
  enforceProductionGuard,
  parseArgs,
  connectDB,
  disconnectDB,
} from './seeder.config';
import {
  printHeader,
  printSummaryTable,
  log,
  spinner,
  SeededUserRow,
} from './seeder.logger';
import { seedServiceAreas } from './seeders/service-area.seeder';
import {
  seedChauffeurs,
  seedOperators,
  seedEdgeCaseUsers,
} from './seeders/user.seeder';
import { seedChauffeurReviews } from './seeders/review.seeder';
import { seedJobsAndApplications } from './seeders/job.seeder';
import { seedMarketplaceItems } from './seeders/item.seeder';
import { seedAllDocuments } from './seeders/document.seeder';

// ─── Clean (fresh) helpers ────────────────────────────────────────────────────

async function dropSeedData(): Promise<void> {
  const { User } = await import('../../src/app/modules/user/user.model');
  const { Vehicle } = await import('../../src/app/modules/vehicle/vehicle.model');
  const { Job } = await import('../../src/app/modules/job/job.model');
  const { Chat } = await import('../../src/app/modules/chat/chat.model');
  const { Message } = await import('../../src/app/modules/message/message.model');
  const { Item } = await import('../../src/app/modules/item/item.model');
  const { ServiceArea } = await import('../../src/app/modules/service-area/service-area.model');
  const { Document } = await import('../../src/app/modules/document/document.model');

  // Only delete non-admin seed accounts (preserve super admin if any)
  await User.deleteMany({ role: 'USER' });
  await Vehicle.deleteMany({});
  await Job.deleteMany({});
  await Chat.deleteMany({});
  await Message.deleteMany({});
  await Item.deleteMany({});
  await Document.deleteMany({});
  await ServiceArea.deleteMany({});

  log.info('Dropped all seeded ServiceArea, User, Vehicle, Job, Chat, Message, Item, and Document records.');
}


// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  enforceProductionGuard();

  const opts = parseArgs();
  const only = opts.only;

  printHeader();

  // Connect
  spinner.start('Connecting to MongoDB...');
  try {
    await connectDB();
    spinner.succeed('Connected to MongoDB');
  } catch (err) {
    spinner.fail('Failed to connect to MongoDB');
    console.error(err);
    process.exit(1);
  }

  try {
    // Fresh mode — drop existing seed data first
    if (opts.fresh) {
      log.section('Fresh mode: dropping seeded data...');
      await dropSeedData();
    }

    const summaryRows: SeededUserRow[] = [];

    // 0. Super Admin
    log.section('Seeding Super Admin');
    const { seedSuperAdmin } = await import('../../src/DB/seedAdmin');
    await seedSuperAdmin();
    summaryRows.push({
      index: 1,
      role: 'Super Admin',
      email: 'admin@example.com',
      name: 'Administrator',
      note: 'Full system management access',
    });

    // 1. Service Areas
    if (!only || only === 'areas') {
      log.section('Seeding Service Areas');
      await seedServiceAreas(opts.verbose);
    }

    // We always need the areaMap for user seeding
    const areaMap = await seedServiceAreas(false);

    // 2. Chauffeurs + Vehicles
    if (!only || only === 'chauffeurs') {
      log.section('Seeding Chauffeurs & Vehicles');
      const { ids: chauffeurIds, rows } = await seedChauffeurs(areaMap, opts.verbose);

      // 3. Operators (depend on chauffeur IDs for favorites)
      if (!only || only === 'operators') {
        log.section('Seeding Fleet Operators');
        const opRows = await seedOperators(areaMap, chauffeurIds, opts.verbose);
        summaryRows.push(...rows, ...opRows);
      } else {
        summaryRows.push(...rows);
      }
    }

    // 4. Edge-case users
    if (!only || only === 'edges') {
      log.section('Seeding Status-Variant Users (Edge Cases)');
      const edgeRows = await seedEdgeCaseUsers(areaMap, opts.verbose);
      summaryRows.push(...edgeRows);
    }

    // 5. Documents Synchronization (Personal & Vehicle Documents)
    if (!only || only === 'chauffeurs' || only === 'documents') {
      log.section('Seeding Chauffeur & Vehicle Documents');
      const docsCount = await seedAllDocuments(opts.verbose);
      log.info(`Synchronized ${docsCount} records in MongoDB Document collection.`);
    }

    // 6. Chauffeur Reviews (completed jobs with ratings & reviews)
    if (!only || only === 'chauffeurs' || only === 'reviews') {
      log.section('Seeding Completed Ride Reviews & Ratings');
      const reviewsCount = await seedChauffeurReviews(opts.verbose);
      log.info(`Seeded ${reviewsCount} ride reviews & synchronized ratings across all chauffeurs.`);
    }

    // 7. Active & Pending Jobs + Driver Applications + Negotiation Chats
    if (!only || only === 'jobs' || only === 'chauffeurs') {
      log.section('Seeding Multi-City Jobs, Driver Applications & Chats');
      const { jobsCount, applicationsCount, chatsCount } = await seedJobsAndApplications(opts.verbose);
      log.info(`Seeded ${jobsCount} jobs, ${applicationsCount} applications, and ${chatsCount} negotiation chats across NY, Miami, and LA.`);
    }

    // 7. Marketplace Items & Listings
    if (!only || only === 'items' || only === 'chauffeurs') {
      log.section('Seeding Marketplace Item Listings');
      const itemsCount = await seedMarketplaceItems(opts.verbose);
      log.info(`Seeded ${itemsCount} marketplace listings across vehicle gear, tech & accessories.`);
    }

    // Summary
    if (summaryRows.length > 0) {
      // Re-index rows sequentially
      summaryRows.forEach((r, i) => (r.index = i + 1));
      printSummaryTable(summaryRows);
    } else {
      console.log('');
      console.log(chalk.green('  ✓  All seed data already up-to-date. Nothing new created.'));
      console.log('');
    }

    console.log(chalk.bold.green('  ✓  Seeding complete.\n'));
  } catch (err) {
    console.error(chalk.red('\n  ✗  Seeding failed:'), err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
    process.exit(process.exitCode ?? 0);
  }
}

main();
