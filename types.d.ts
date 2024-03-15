import { JWTSignature } from './api/const';

declare module 'express' {
  export interface Request {
    jwt?: JWTSignature | undefined;
  }
}
