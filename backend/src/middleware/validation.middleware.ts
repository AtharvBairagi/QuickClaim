import { Request, Response, NextFunction } from 'express';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Name is required and must be a valid non-empty string',
    });
    return;
  }

  if (name.trim().length < 2) {
    res.status(400).json({
      status: 'error',
      message: 'Name must be at least 2 characters long',
    });
    return;
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({
      status: 'error',
      message: 'Please provide a valid email address',
    });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'Password is required',
    });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({
      status: 'error',
      message: 'Password must be at least 8 characters long',
    });
    return;
  }

  next();
};

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({
      status: 'error',
      message: 'Please provide a valid email address',
    });
    return;
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Password is required',
    });
    return;
  }

  next();
};
