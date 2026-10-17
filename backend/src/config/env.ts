import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  corsOrigin: string | string[];
  jwtSecret: string;
  jwtExpiresIn: string;
  uploadDir: string;
}

const parseCorsOrigins = (originStr?: string): string | string[] => {
  if (!originStr || originStr.trim() === '*' || originStr.trim() === '') {
    return '*';
  }
  const origins = originStr
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
};

export const config: Config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quikclaim',
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  jwtSecret: process.env.JWT_SECRET || 'quickclaim-dev-fallback-secret-key-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
