const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.DATABASE_URL;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to:', MONGO_URI);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Vehicle = mongoose.model('Vehicle', new mongoose.Schema({}, { strict: false }), 'vehicles');

  const user = await User.findOne({ email: 'alex.wright@chauffeur.com' }).lean();
  if (!user) {
    console.error('User not found: alex.wright@chauffeur.com');
    process.exit(1);
  }
  console.log('Found user:', user.name, '|', user._id.toString());

  const result = await Vehicle.updateMany(
    { owner: user._id },
    { $set: { status: 'APPROVED' } }
  );
  console.log(`Approved ${result.modifiedCount} vehicle(s)`);

  const vehicles = await Vehicle.find({ owner: user._id }).lean();
  vehicles.forEach(v => {
    console.log(`  [${v.status}] ${v.makeAndModel} — ${v.licensePlate}`);
  });

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
