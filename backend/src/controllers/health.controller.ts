import { Request, Response, NextFunction } from 'express';
import { getHealthStatus } from '../services/health.service';

export const getHealth = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const health = getHealthStatus();
    res.status(200).json(health);
  } catch (error) {
    next(error);
  }
};
