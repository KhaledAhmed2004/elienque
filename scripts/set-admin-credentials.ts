/**
 * Out-of-Band Admin Setup CLI Script
 *
 * Usage:
 *   npx tsx scripts/set-admin-credentials.ts --email=admin@company.com --password=NewSecurePassword123!
 *   npm run admin:set-credentials -- --email=admin@company.com --password=NewSecurePassword123!
 */

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import config from '../src/config';
import { ACCOUNT_STATE, APP_STATE, USER_ROLES } from '../src/enums/user';
import { User } from '../src/app/modules/user/user.model';

async function setAdminCredentials() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const passwordArg = args.find((a) => a.startsWith('--password='));

  const email = emailArg ? emailArg.split('=')[1]?.trim().toLowerCase() : null;
  const password = passwordArg ? passwordArg.split('=')[1]?.trim() : null;

  if (!email || !password) {
    console.error('\n❌ Missing required arguments.');
    console.log('Usage:');
    console.log('  npm run admin:set-credentials -- --email=<email> --password=<newPassword>\n');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n❌ Password must be at least 8 characters long.\n');
    process.exit(1);
  }

  const dbUrl =
    (config.database_url as string) ||
    'mongodb://127.0.0.1:27018/moeb26?replicaSet=rs0';

  console.log('Connecting to database...');
  await mongoose.connect(dbUrl);

  try {
    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds) || 12,
    );

    // Look for existing admin by role or email
    let admin = await User.findOne({
      $or: [{ role: USER_ROLES.ADMIN }, { email }],
    });

    if (admin) {
      admin.email = email;
      admin.password = hashedPassword;
      admin.role = USER_ROLES.ADMIN;
      admin.accountState = ACCOUNT_STATE.VERIFIED;
      admin.appState = APP_STATE.ACTIVE;
      admin.mustChangePassword = false;
      admin.loginAttempts = 0;
      admin.lockUntil = undefined;
      await admin.save();
      console.log(`\n✅ Admin account (${email}) updated successfully.`);
    } else {
      admin = await User.create({
        name: 'System Administrator',
        email,
        password: hashedPassword,
        role: USER_ROLES.ADMIN,
        accountState: ACCOUNT_STATE.VERIFIED,
        appState: APP_STATE.ACTIVE,
        mustChangePassword: false,
        isOnboard: true,
      });
      console.log(`\n✅ New Admin account (${email}) created successfully.`);
    }
  } catch (error) {
    console.error('\n❌ Failed to set admin credentials:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.\n');
  }
}

setAdminCredentials();
