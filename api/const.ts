import mongoose from 'mongoose';

export type JWTSignature = {
  id: string;
};

export type MongooseDocumentType<T> = mongoose.Document<unknown, {}, T> &
  T & {
    _id: mongoose.Types.ObjectId;
  };

export type ResponseSchema = {
  user: {
    id: string;
    username?: string;
    email?: string;
    count: number;
    updatedAt: Date;
    createdAt: Date;
  };
  config: {
    spawnInterval: [number, number];
    badge: {
      color: string;
      backgroundColor: string;
    };
  };
  error: {
    message: string;
  };
};

declare module 'express' {
  export interface Request {
    jwt?: JWTSignature | undefined;
  }
}

export const balloonTranslation = {
  default: 0x00,
  confetti: 0x01,
};
