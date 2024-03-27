import https from 'https';
import fs from 'fs';
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
  console.log('Connected to MongoDB at', db.connection.host);
};

if (require.main === module) {
  dotenv.config();
  validateEnv();
  main();

  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV === 'development') {
    app.listen(port, () => {
      console.log(`Server is running on https://localhost:${port}`);
    });
  } else {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY!),
      cert: fs.readFileSync(process.env.SSL_CERT!),
    };

    https.createServer(options, app).listen(port, () => {
      console.log('SSL server started on port', port);
    });
  }
}

export default app;
