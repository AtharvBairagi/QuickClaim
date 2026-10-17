import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utilities/token.util';
import { AUTH_COOKIE_NAME } from '../utilities/cookie.util';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required',
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.user = { id: payload.userId };
    next();
  } catch (_error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired authentication token',
    });
  }
};
