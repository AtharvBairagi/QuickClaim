import { Request, Response, NextFunction } from 'express';
import * as ownershipService from '../services/ownership.service';
import { AppError } from '../middleware/errorHandler';

export const shareProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const productId = typeof req.params.productId === 'string' ? req.params.productId : '';
    const ownership = await ownershipService.shareProduct(userId, productId, req.body?.email);

    res.status(201).json({
      ownership,
    });
  } catch (error) {
    next(error);
  }
};

export const getOwnerships = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const productId = typeof req.params.productId === 'string' ? req.params.productId : '';
    const ownerships = await ownershipService.getOwnerships(userId, productId);

    res.status(200).json({
      ownerships,
    });
  } catch (error) {
    next(error);
  }
};

export const removeSharedAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const productId = typeof req.params.productId === 'string' ? req.params.productId : '';
    const targetUserId = typeof req.params.userId === 'string' ? req.params.userId : '';

    await ownershipService.removeSharedAccess(userId, productId, targetUserId);

    res.status(200).json({
      message: 'Shared access removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getSharedWithMeProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const products = await ownershipService.getSharedWithMeProducts(userId);

    res.status(200).json({
      products,
    });
  } catch (error) {
    next(error);
  }
};
