/**
 * Adds spawn_chance and season to each balloon type.
 *
 * Values mirror the extension's src/balloons/*.ts spawn_chance constants.
 * Run: npx ts-node tasks/migrations/balloon-spawn-chance.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Balloon from '../../api/schemas/balloon';

const balloonConfigs = [
  { name: 'default', spawn_chance: 0.65 },
  { name: 'confetti', spawn_chance: 0.1 },
  { name: 'gold', spawn_chance: 0.05 },
  { name: 'splitter', spawn_chance: 0.1 },
  {
    name: 'christmas',
    spawn_chance: 0.3,
    season: { start: { month: 12, day: 1 }, end: { month: 12, day: 31 } },
  },
  { name: 'fast', spawn_chance: 0.1 },
  { name: 'ghost', spawn_chance: 0.1 },
  { name: 'disco', spawn_chance: 0.01 },
  { name: 'bubble', spawn_chance: 0.1 },
];

(async () => {
  dotenv.config();
  await mongoose.connect(process.env.DATABASE_URL!);

  for (const config of balloonConfigs) {
    const balloon = await Balloon.findOneAndUpdate(
      { name: config.name },
      {
        $set: {
          spawn_chance: config.spawn_chance,
          ...(config.season ? { season: config.season } : {}),
        },
      },
      { new: true },
    );
    console.log(
      balloon
        ? `Updated ${config.name} → spawn_chance=${config.spawn_chance}${config.season ? ', season=' + JSON.stringify(config.season) : ''}`
        : `WARNING: Balloon '${config.name}' not found in DB`,
    );
  }

  await mongoose.disconnect();
  console.log('Done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
