import mongoose from 'mongoose';
import config from '../config';
import { Deal } from '../app/modules/deal/deal.model';
import { DealUsage } from '../app/modules/deal/dealUsage.model';
import { Vehicle } from '../app/modules/vehicle/vehicle.model';

const migrate = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    console.log('Connected to database successfully.');

    // 1. Deal Migration
    console.log('Starting Deal migration...');
    const deals = await Deal.find({}); // using find() instead of direct model.find to get lean if needed, but we need save
    let dealUsageCreated = 0;
    
    for (const deal of deals) {
      // Cast deal to any since we removed usedBy from the schema but it still exists in DB
      const dbDeal: any = deal;
      
      if (dbDeal.usedBy && Array.isArray(dbDeal.usedBy) && dbDeal.usedBy.length > 0) {
        console.log(`Migrating ${dbDeal.usedBy.length} usages for deal: ${deal.title}`);
        
        for (const userId of dbDeal.usedBy) {
          // Check if already exists just in case script is run twice
          const exists = await DealUsage.exists({ dealId: deal._id, userId });
          if (!exists) {
            await DealUsage.create({ dealId: deal._id, userId, usedAt: dbDeal.createdAt || new Date() });
            dealUsageCreated++;
          }
        }
        
        // Update usage count and strictly remove usedBy via $unset
        await Deal.findByIdAndUpdate(deal._id, {
          $set: { usageCount: dbDeal.usedBy.length },
          $unset: { usedBy: '' }
        });
      } else {
        // Just ensure usedBy is unset if it's empty
        await Deal.findByIdAndUpdate(deal._id, {
          $unset: { usedBy: '' }
        });
      }
    }
    console.log(`Deal migration complete. Created ${dealUsageCreated} DealUsage records.`);

    // 2. User Migration
    // We removed 'vehicles' array from User schema.
    // We just need to unset it from the DB.
    console.log('Starting User migration...');
    if (!mongoose.connection.db) throw new Error('DB not initialized');
    const userUpdateResult = await mongoose.connection.db.collection('users').updateMany(
      { vehicles: { $exists: true } },
      { $unset: { vehicles: '' } }
    );
    console.log(`User migration complete. Removed 'vehicles' array from ${userUpdateResult.modifiedCount} users.`);

    // 3. Verify Vehicles
    console.log('Verifying Vehicles...');
    const orphanedVehiclesCount = await Vehicle.countDocuments({ owner: { $exists: false } });
    if (orphanedVehiclesCount > 0) {
      console.warn(`WARNING: Found ${orphanedVehiclesCount} vehicles without an owner.`);
    } else {
      console.log('All vehicles have owners.');
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
