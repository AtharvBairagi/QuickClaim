import { Request, Response, NextFunction } from 'express';
import { logger } from '../utilities/logger';
import { config } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

interface MongoDuplicateKeyError extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

export const errorHandler = (
  err: Error & { statusCode?: number; code?: number; name?: string },
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000 || (err as MongoDuplicateKeyError).code === 11000) {
    statusCode = 409;
    message = 'Email is already registered';
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Invalid input data';
  }

  // Handle Mongoose CastError (e.g. malformed ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  }

  // Handle Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.message === 'File too large') {
      message = 'File is too large. Maximum size is 10 MB.';
    } else {
      message = err.message;
    }
  }

  // For non-operational 500 errors in production, hide unexpected details
  if (statusCode === 500 && config.nodeEnv === 'production') {
    message = 'Internal Server Error';
  }

  logger.error(`[${req.method}] ${req.originalUrl} - Error: ${message}`, {
    statusCode,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};
