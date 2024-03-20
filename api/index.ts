import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors';

import { swaggerOptions } from './swagger';
import ApiRoutes from './routes/api';
import error_handler from './middleware/error_handler';
import { validateEnv } from './utils';

const app = express();
app.use(express.json());

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
  console.log('Connected to MongoDB');
};

if (require.main === module) {
  dotenv.config();
  validateEnv();
  main();

  app.listen(process.env.PORT || 3000, () => {
    console.log(
      `Server is running on http://localhost:${process.env.PORT || 3000}`,
    );
  });
}

export default app;
