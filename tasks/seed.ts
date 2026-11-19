/**
 * Seed script: creates balloon types with value + spawn_chance/season,
 * and a default user. Idempotent — safe to run multiple times.
 *
 * Run: npx ts-node tasks/seed.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Balloon from '../api/schemas/balloon';
import User from '../api/schemas/user';

const balloonConfigs = [
  { name: 'default', value: 1, spawn_chance: 0.65 },
  { name: 'confetti', value: 1, spawn_chance: 0.1 },
  { name: 'gold', value: 1, spawn_chance: 0.05 },
  { name: 'splitter', value: 1, spawn_chance: 0.1 },
  {
    name: 'christmas',
    value: 1,
    spawn_chance: 0.3,
    season: {
      start: { month: 12, day: 1 },
      end: { month: 12, day: 31 },
      timeZone: 'Europe/Brussels',
    },
  },
  { name: 'fast', value: 1, spawn_chance: 0.1 },
  { name: 'ghost', value: 1, spawn_chance: 0.1 },
  { name: 'disco', value: 1, spawn_chance: 0.01 },
  { name: 'bubble', value: 1, spawn_chance: 0.1 },
];

(async () => {
  dotenv.config();
  await mongoose.connect(process.env.DATABASE_URL!);

  for (const config of balloonConfigs) {
    const balloon = await Balloon.findOneAndUpdate(
      { name: config.name },
      {
        $set: {
          value: config.value,
          spawn_chance: config.spawn_chance,
          ...(config.season ? { season: config.season } : {}),
        },
      },
      { new: true, upsert: true },
    );
    console.log(
      `Balloon ${balloon.name} → value=${balloon.value} spawn_chance=${balloon.spawn_chance}${balloon.season ? ' season=' + JSON.stringify(balloon.season) : ''}`,
    );
  }

  // Default user (used by the extension's dev mode / tests)
  const user = await User.findOneAndUpdate(
    { username: 'dev' },
    { $set: { username: 'dev' } },
    { new: true, upsert: true },
  );
  console.log(`User ${user.username} → id=${user._id}`);

  await mongoose.disconnect();
  console.log('Done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
