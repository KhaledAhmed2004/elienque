import mongoose from 'mongoose';
import config from '../config';
import { logger } from '../shared/logger';
import { User } from '../app/modules/user/user.model';

const migrateLegacyUserFields = async () => {
  try {
    logger.info('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    logger.info('Connected to database.');

    logger.info('Starting migration: Unsetting legacy fields from users collection...');

    const result = await User.updateMany(
      {},
      {
        $unset: {
          serviceAreaId: 1,
          serviceArea: 1,
          companyName: 1,
          company: 1,
          vehicles: 1,
          selectedVehicle: 1,
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

migrateLegacyUserFields();
