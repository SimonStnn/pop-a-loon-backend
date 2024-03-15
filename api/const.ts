export type JWTSignature = {
  id: string;
};

declare module 'express' {
  export interface Request {
    jwt?: JWTSignature | undefined;
  }
}
