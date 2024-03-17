import { Request, Response, NextFunction } from 'express';

// Middleware function to authenticate user
export default async (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);
  res.status(500).json({ error: err.message });
};
