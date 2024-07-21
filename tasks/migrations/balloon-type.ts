import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Balloon from '../../api/schemas/balloon';
import CountHistory from '../../api/schemas/counthistory';

export const balloonTranslation = {
  default: 0x00,
  confetti: 0x01,
};

(async () => {
  dotenv.config();
  const db = await mongoose.connect(process.env.DATABASE_URL!);

  const balloons = await Balloon.find({});

  for (const [name, id] of Object.entries(balloonTranslation)) {
    console.log(name, id, balloons.find((b) => b.name === name)?._id);
    const balloon = await CountHistory.updateMany(
      { type: id },
      { type: balloons.find((b) => b.name === name)?._id },
    );
    console.log(balloon);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
