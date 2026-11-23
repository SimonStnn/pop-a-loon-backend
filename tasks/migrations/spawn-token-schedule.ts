/**
 * Migrates spawn tokens to one server-owned schedule per user.
 *
 * The old model stored one document per token request with a
 * (userId, nonce) index. The new model keeps exactly one active schedule
 * per user (unique userId) and deletes it on consumption.
 *
 * Existing tokens are short-lived, so they are cleared instead of migrated.
 * Stop the API before running this so no request inserts while the unique
 * index is being built.
 *
 * Run: npx ts-node tasks/migrations/spawn-token-schedule.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

(async () => {
  dotenv.config();
  await mongoose.connect(process.env.DATABASE_URL!);

  const collection = mongoose.connection.collection('spawntokens');

  const deleted = await collection.deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} legacy spawn token(s)`);

  try {
    await collection.dropIndex('userId_1_nonce_1');
    console.log('Dropped legacy index userId_1_nonce_1');
  } catch {
    console.log('Legacy index userId_1_nonce_1 not present, skipping');
  }

  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await collection.createIndex({ userId: 1 }, { unique: true });
  console.log('Spawn schedule indexes ready');

  await mongoose.disconnect();
})();
