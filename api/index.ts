import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { swaggerOptions } from './swagger';
import ApiRoutes from './routes/api';
import { validateEnv } from './utils';

const app = express();
app.use(express.json());

app.use('/api', ApiRoutes);
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerJsdoc(swaggerOptions), {
    customCss: '.swagger-ui .topbar { display: none }',
  }),
);

const main = async () => {
  const db = await mongoose.connect(process.env.DATABASE_URL!);
  console.log('Connected to MongoDB');
};

if (require.main === module) {
  dotenv.config();
  validateEnv();
  main();

  app.listen(3000, () => {
    console.log(`Server is running on http://localhost:${3000}`);
  });
}
