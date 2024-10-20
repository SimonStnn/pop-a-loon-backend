/**
 * This script will add a value to each balloon typ in the databse.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Balloon from '../../api/schemas/balloon';

(async () => {
  dotenv.config();
  const db = await mongoose.connect(process.env.DATABASE_URL!);

  await Balloon.updateMany({}, { value: 1 });

  console.log('Gave all balloons a value of 1');
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
