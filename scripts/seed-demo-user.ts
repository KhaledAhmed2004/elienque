import mongoose from 'mongoose';
import { User } from '../src/app/modules/user/user.model';
import config from '../src/config';

async function seedUser() {
  try {
    await mongoose.connect(config.database_url as string || 'mongodb://localhost:27017/moeb26');
    console.log('Connected to DB');

    const demoEmail = 'demo@example.com';
    const existing = await User.findOne({ email: demoEmail });
    if (existing) {
      console.log('Demo user already exists!');
      console.log('Email:', demoEmail);
      console.log('Password: Password123!');
      process.exit(0);
    }

    const demoUser = new User({
      name: 'Demo Driver',
      email: demoEmail,
      password: 'Password123!',
      phone: '+12345678901',
      serviceArea: 'NY',
      company: 'Demo Company',
      experience: 2,
      role: 'DRIVER',
      companyRole: 'DRIVER',
      status: 'ACTIVE',
      verified: true
    });

    await demoUser.save();
    console.log('Successfully seeded demo user!');
    console.log('Email: demo@example.com');
    console.log('Password: Password123!');
    console.log('Role: DRIVER');
  } catch (error) {
    console.error('Error seeding demo user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedUser();
