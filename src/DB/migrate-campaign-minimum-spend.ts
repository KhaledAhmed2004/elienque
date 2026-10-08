import mongoose from 'mongoose';
import config from '../config';
import { logger } from '../shared/logger';
import { Campaign } from '../app/modules/campaign/campaign.model';

const migrateCampaignMinimumSpend = async () => {
  try {
    logger.info('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    logger.info('Connected to database.');

    logger.info('Starting migration: Setting minimumSpend to 0 for existing campaigns...');

    const result = await Campaign.updateMany(
      { minimumSpend: { $exists: false } },
      {
        $set: {
          minimumSpend: 0,
        },
      }
    );

    logger.info(`Migration completed successfully.`);
    logger.info(`Matched documents: ${result.matchedCount}`);
    logger.info(`Modified documents: ${result.modifiedCount}`);
  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from database.');
    process.exit(0);
  }
};

migrateCampaignMinimumSpend();
