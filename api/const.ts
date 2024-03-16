export type JWTSignature = {
  id: string;
};

import mongoose from 'mongoose';

export type MongooseDocumentType<T> = mongoose.Document<unknown, {}, T> &
  T & {
    _id: mongoose.Types.ObjectId;
  };

declare module 'express' {
  export interface Request {
    jwt?: JWTSignature | undefined;
  }
}
