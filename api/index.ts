import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors';

import { swaggerOptions } from './swagger';
import ApiRoutes from './routes/api';
import error_handler from './middleware/error_handler';
import logger from './logger';
import { testOrigin, validateEnv } from './utils';

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (origin && testOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);

app.use('/api', ApiRoutes);
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerJsdoc(swaggerOptions), {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Pop-a-loon API Documentation',
  }),
);
app.use(error_handler);

app.get('/', (req: Request, res: Response) => {
  res.redirect('/docs');
});

const main = async () => {
  const db = await mongoose.connect(process.env.DATABASE_URL!);
  logger.info('Connected to MongoDB at', db.connection.host);
};

if (require.main === module) {
  dotenv.config();
  validateEnv();
  main();

  app.listen(Number(process.env.PORT) || 3000, () => {
    logger.info(
      `Server is running on http://localhost:${process.env.PORT || 3000}`,
    );
  });
}

export default app;
