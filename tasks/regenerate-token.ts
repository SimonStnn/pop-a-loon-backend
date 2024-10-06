import dotenv from 'dotenv';
import { generateToken } from '../api/utils';
import jwt from 'jsonwebtoken';

// get the name of the balloon from the command line
const id = process.argv[2];

console.log(`Regenerating token for: "${id}"`);

(async () => {
  dotenv.config();
  const new_token = generateToken(id);

  const verifying = jwt.verify(new_token, process.env.JWT_SECRET!) as {
    id: string;
  };
  if (verifying.id !== id) {
    throw new Error('Token is invalid');
  }
  console.log(new_token);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
