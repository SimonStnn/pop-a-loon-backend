import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../api/schemas/user';
import { generateRecoveryCode, hashRecoveryCode } from '../api/utils';

// Usage: npx ts-node tasks/add-recovery-code.ts <userId | email | username>
// The user can be identified by MongoDB ID, email address, or username.
// The plaintext recovery code is printed once and is not stored anywhere.
const identifier = process.argv[2];

if (!identifier) {
  console.error('Usage: npx ts-node tasks/add-recovery-code.ts <user>');
  process.exit(1);
}

(async () => {
  dotenv.config();

  if (!process.env.DATABASE_URL) {
    throw new Error('No database URL provided');
  }

  await mongoose.connect(process.env.DATABASE_URL);

  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
  const filter = isObjectId
    ? { _id: new mongoose.Types.ObjectId(identifier) }
    : identifier.includes('@')
      ? { email: identifier }
      : { username: identifier };

  // Usernames and emails are not unique, so refuse ambiguous lookups.
  const users = await User.find(filter).limit(2);
  if (users.length === 0) {
    throw new Error(`No user found for "${identifier}"`);
  }
  if (users.length > 1) {
    throw new Error(
      `Multiple users found for "${identifier}"; use the user ID instead`,
    );
  }

  const user = users[0];
  const code = generateRecoveryCode();

  user.recoveryHash = hashRecoveryCode(code);
  user.recoveryCreatedAt = new Date();
  await user.save();

  // This is the only time the plaintext code exists outside this process.
  console.log(`Recovery code for ${user.username ?? user.id}: ${code}`);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
