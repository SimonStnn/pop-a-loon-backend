import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

export default (req: Request, res: Response, next: NextFunction) => {
  logger.info({
    message: `API Request: ${req.method}, ${req.originalUrl}`,
    metadata: {
      method: req.method,
      url: req.url,
      body: req.body,
    },
  });
  next();
};
