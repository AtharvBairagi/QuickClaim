import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from '../services/auth.service';
import { setAuthCookie, clearAuthCookie } from '../utilities/cookie.util';
import { AppError } from '../middleware/errorHandler';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const user = await registerUser({ name, email, password });

    res.status(201).json({
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginUser({ email, password });

    // Set HTTP-only cookie
    setAuthCookie(res, token);

    // Return sanitized user object without token in body
    res.status(200).json({
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    clearAuthCookie(res);
    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const user = await getCurrentUser(userId);

    res.status(200).json({
      user,
    });
  } catch (error) {
    next(error);
  }
};
