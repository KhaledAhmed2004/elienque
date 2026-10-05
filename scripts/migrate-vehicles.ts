import mongoose from 'mongoose';
import config from '../src/config';
import { User } from '../src/app/modules/user/user.model';
import { Vehicle } from '../src/app/modules/vehicle/vehicle.model';

const migrateVehicles = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    console.log('Connected.');

    const users = await User.find({ vehicles: { $exists: true, $not: { $size: 0 } } });
    console.log(`Found ${users.length} users with potential embedded vehicles...`);

    let migratedCount = 0;

    for (const user of users) {
      // Check if vehicles are embedded documents or object IDs
      const hasEmbeddedVehicles = user.vehicles.some(v => typeof v === 'object' && v !== null && !(v instanceof mongoose.Types.ObjectId));

      if (hasEmbeddedVehicles) {
        console.log(`Migrating vehicles for user: ${user._id}`);
        
        // At this point in a real run, mongoose might have already stripped fields not in the schema,
        // so to do a raw migration, we might need a raw query. We'll use lean() for raw data.
      }
    }

    // A better raw approach
    const rawUsers = await User.collection.find({ 
      vehicles: { $exists: true, $type: 'array' } 
    }).toArray();

    for (const rawUser of rawUsers) {
      const embeddedVehicles = rawUser.vehicles?.filter((v: any) => typeof v === 'object' && v !== null && !v._bsontype);
      
      if (embeddedVehicles && embeddedVehicles.length > 0) {
        console.log(`Migrating ${embeddedVehicles.length} vehicles for user: ${rawUser._id}`);
        
        const vehicleIds = [];
        for (const vData of embeddedVehicles) {
          vData.owner = rawUser._id;
          const newVehicle = await Vehicle.create(vData);
          vehicleIds.push(newVehicle._id);
        }

        // Keep any existing object ids as well
        const existingIds = rawUser.vehicles.filter((v: any) => v._bsontype === 'ObjectId' || (typeof v === 'object' && v instanceof mongoose.Types.ObjectId));
        const allVehicleIds = [...existingIds, ...vehicleIds];

        // Update the user
        await User.collection.updateOne(
          { _id: rawUser._id },
          { $set: { vehicles: allVehicleIds } }
        );
        migratedCount++;
      }
    }

    console.log(`Migration complete. Migrated vehicles for ${migratedCount} users.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
};

migrateVehicles();
