import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Balloon from '../api/schemas/balloon';

// get the name of the balloon from the command line
const name = process.argv[2];

console.log(`Adding balloon with name: "${name}"`);

(async () => {
  dotenv.config();
  const db = await mongoose.connect(process.env.DATABASE_URL!);

  // create a new balloon document
  const balloon = new Balloon({ name });

  // save the balloon document
  await balloon.save();

  console.log('Balloon added successfully');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
