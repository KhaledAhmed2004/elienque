import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const checkDatabase = async () => {
  const dbUri = process.env.DATABASE_URL;
  if (!dbUri) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully.');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('Failed to get database handle');
      process.exit(1);
    }

    const users = await db.collection('users').find({}).toArray();
    const vehicles = await db.collection('vehicles').find({}).toArray();

    console.log(`\n================ DATABASE AUDIT ================`);
    console.log(`Total Users in DB: ${users.length}`);
    console.log(`Total Vehicles in DB: ${vehicles.length}\n`);

    const usersWithoutVehicles: any[] = [];
    const usersWithVehicles: any[] = [];

    for (const user of users) {
      const userVehicles = vehicles.filter(
        v => v.owner?.toString() === user._id.toString()
      );

      const userInfo = {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        companyRole: user.companyRole,
        accountState: user.accountState,
        appState: user.appState,
        selectedVehicle: user.selectedVehicle ? user.selectedVehicle.toString() : null,
        vehicleCount: userVehicles.length,
        vehicles: userVehicles.map(v => ({
          _id: v._id.toString(),
          makeAndModel: v.makeAndModel,
          licensePlate: v.licensePlate,
          type: v.type,
          status: v.status,
        })),
      };

      if (userVehicles.length === 0) {
        usersWithoutVehicles.push(userInfo);
      } else {
        usersWithVehicles.push(userInfo);
      }
    }

    console.log(`---------------- USERS WITH VEHICLES (${usersWithVehicles.length}) ----------------`);
    usersWithVehicles.forEach(u => {
      console.log(`- ${u.name} (${u.email}) [Role: ${u.role}, AccountState: ${u.accountState}, AppState: ${u.appState}] -> ${u.vehicleCount} vehicle(s)`);
      u.vehicles.forEach((v: any) => {
        console.log(`    * ${v.makeAndModel} | Plate: ${v.licensePlate} | Type: ${v.type} | Status: ${v.status}`);
      });
    });

    console.log(`\n---------------- USERS WITHOUT VEHICLES (${usersWithoutVehicles.length}) ----------------`);
    usersWithoutVehicles.forEach(u => {
      console.log(`- ${u.name} (${u.email}) [Role: ${u.role}, CompanyRole: ${u.companyRole}, AccountState: ${u.accountState}, AppState: ${u.appState}]`);
    });

    console.log(`\n================================================\n`);
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

checkDatabase();
