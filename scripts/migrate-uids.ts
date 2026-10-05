import mongoose from 'mongoose';
import config from '../src/config';
import { User } from '../src/app/modules/user/user.model';

async function migrate() {
  try {
    console.log('--- Connected to MongoDB... ---');
    await mongoose.connect(config.database_url as string);
    console.log('--- MongoDB connected successfully! ---');

    console.log('--- Finding users without UID... ---');
    const usersToMigrate = await User.find({
      $or: [{ uid: { $exists: false } }, { uid: null }, { uid: '' }],
    });

    console.log(`--- Found ${usersToMigrate.length} users to migrate. ---`);

    let count = 0;
    for (const user of usersToMigrate) {
      try {
        // Saving the user will trigger the pre('save') hook which generates the UID
        await user.save();
        count++;
        console.log(`[${count}/${usersToMigrate.length}] Migrated user: ${user.email} (UID: ${user.uid})`);
      } catch (err: any) {
        console.error(`Failed to migrate user ${user.email}:`, err.message);
      }
    }

    console.log(`--- Migration completed! ${count} users updated. ---`);
    process.exit(0);
  } catch (error) {
    console.error('--- Migration failed: ---', error);
    process.exit(1);
  }
}

migrate();
