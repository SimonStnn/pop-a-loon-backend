import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JWTSignature } from '@/const';

// Middleware function to authenticate user
export default (req: Request, res: Response, next: NextFunction) => {
  // Extract JWT token from request headers
  const token = req.headers.authorization;

  // Check if token is provided
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Verify JWT token
  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Failed to authenticate token' });
    }

    req.jwt = decoded as JWTSignature;

    // Move to the next middleware or route handler
    next();
  });
};
