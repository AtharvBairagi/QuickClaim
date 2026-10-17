import { Response, CookieOptions } from 'express';
import { config } from '../config/env';

export const AUTH_COOKIE_NAME = 'token';

export const getAuthCookieOptions = (): CookieOptions => {
  const isProduction = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
};

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
};

export const clearAuthCookie = (res: Response): void => {
  const options = getAuthCookieOptions();
  // Clear cookie by overwriting with empty value and maxAge 0 / expired date
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
};
