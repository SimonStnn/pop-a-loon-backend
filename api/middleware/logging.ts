import { Request, Response, NextFunction } from 'express';

export default (req: Request, res: Response, next: NextFunction) => {
  console.log('API Request:', req.method, req.originalUrl);
  next();
};
