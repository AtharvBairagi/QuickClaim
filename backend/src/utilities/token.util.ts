import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';

export interface TokenPayload {
  userId: string;
}

export const generateToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwtSecret, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
};
