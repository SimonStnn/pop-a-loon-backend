import mongoose from 'mongoose';

export type JWTSignature = {
  id: string;
};

export type SpawnTokenPayload = {
  sub: string;
  type: 'spawn';
  nonce: string; // Random UUID linking this JWT to its single-use DB schedule row.
  spawnAt: number;
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
    hasRecoveryCode?: boolean;
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

export type HistoryBucket = 'day' | 'week' | 'month';

export type HistoryNode = {
  date: Date;
  pops: {
    [key: string]: number;
  };
};

export type HistoryResponse = {
  history: HistoryNode[];
  bucket: HistoryBucket;
};

declare module 'express' {
  export interface Request {
    jwt?: JWTSignature | undefined;
  }
}
