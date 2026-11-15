import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { recoverAccount, recoverySchema } from '../services/recoverAccount.js';

try {
  const input = recoverySchema.safeParse({ email: process.env.RECOVERY_EMAIL, role: process.env.RECOVERY_ROLE,
    password: process.env.RECOVERY_PASSWORD });
  delete process.env.RECOVERY_PASSWORD;
  const database = process.env.RECOVERY_DATABASE;
  if (!input.success || !database || !env.MONGODB_URI || !process.argv.includes('--apply')) {
    console.error('Supply the exact email, role, database name and a valid new password privately, then use --apply.');
    process.exitCode = 1;
  } else {
    await connectDatabase(env.MONGODB_URI);
    if (mongoose.connection.name !== database) throw new Error('Unexpected database');
    if (await recoverAccount(input.data)) console.log('Password reset for the existing account. Earlier sessions were invalidated.');
    else {
      console.error('No matching non-demo account. No account changed.');
      process.exitCode = 1;
    }
  }
} catch {
  console.error('Account recovery failed. Check the database name and connection. No credentials were logged.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
