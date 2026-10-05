import mongoose from 'mongoose';
import config from '../src/config';
import { User } from '../src/app/modules/user/user.model';
import { Vehicle } from '../src/app/modules/vehicle/vehicle.model';

const approveVehicles = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    console.log('Connected.');

    const user = await User.findOne({ email: 'alex.wright@chauffeur.com' });
    if (!user) {
      console.error('User not found: alex.wright@chauffeur.com');
      process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user._id})`);

    const result = await Vehicle.updateMany(
      { owner: user._id },
      { $set: { status: 'APPROVED' } }
    );

    console.log(`✅ Approved ${result.modifiedCount} vehicle(s) for alex.wright@chauffeur.com`);

    const vehicles = await Vehicle.find({ owner: user._id }).select('makeAndModel type licensePlate status');
    vehicles.forEach(v => {
      console.log(`  - [${v.status}] ${v.makeAndModel} (${v.type}) — ${v.licensePlate}`);
    });

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
};

approveVehicles();
