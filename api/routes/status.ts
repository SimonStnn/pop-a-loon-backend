import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'up',
    version: process.env.npm_package_version,
  });
});

export default router;
