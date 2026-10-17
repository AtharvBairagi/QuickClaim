import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';
import { AppError } from '../middleware/errorHandler';

export const generateNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const notifications = await notificationService.generateNotificationsForUser(userId);

    res.status(200).json({
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const notifications = await notificationService.getNotifications(userId);

    res.status(200).json({
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      count,
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const notificationId = typeof req.params.id === 'string' ? req.params.id : '';
    const result = await notificationService.markNotificationAsRead(userId, notificationId);

    res.status(200).json({
      notification: result,
    });
  } catch (error) {
    next(error);
  }
};
