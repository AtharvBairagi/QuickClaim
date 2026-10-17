import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

const isValidDateString = (dateStr: unknown): boolean => {
  if (typeof dateStr !== 'string' && !(dateStr instanceof Date)) return false;
  const parsed = new Date(dateStr as string);
  return !isNaN(parsed.getTime());
};

export const validateObjectId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id = req.params.id || req.params.productId;
  const idStr = typeof id === 'string' ? id : '';

  if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid product ID format',
    });
    return;
  }

  next();
};

export const validateUserIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.params.userId;
  const idStr = typeof userId === 'string' ? userId : '';

  if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid user ID format',
    });
    return;
  }

  next();
};

export const validateNotificationId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id = req.params.id;
  const idStr = typeof id === 'string' ? id : '';

  if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid notification ID format',
    });
    return;
  }

  next();
};

export const validateSearchQuery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { status, expiryFrom, expiryTo, hasReceipt } = req.query;

  if (status !== undefined) {
    if (typeof status !== 'string' || !['active', 'expiring', 'expired'].includes(status)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid status filter. Allowed values: active, expiring, expired',
      });
      return;
    }
  }

  if (expiryFrom !== undefined) {
    if (!isValidDateString(expiryFrom)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid expiryFrom date format',
      });
      return;
    }
  }

  if (expiryTo !== undefined) {
    if (!isValidDateString(expiryTo)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid expiryTo date format',
      });
      return;
    }
  }

  if (hasReceipt !== undefined) {
    if (hasReceipt !== 'true' && hasReceipt !== 'false') {
      res.status(400).json({
        status: 'error',
        message: 'hasReceipt must be "true" or "false"',
      });
      return;
    }
  }

  next();
};

export const validateCreateProduct = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const {
    name,
    purchaseDate,
    warrantyStartDate,
    warrantyExpiry,
    price,
  } = req.body || {};

  // 1. Name validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Product name is required and must not be blank',
    });
    return;
  }

  // 2. Purchase date validation
  if (!purchaseDate || !isValidDateString(purchaseDate)) {
    res.status(400).json({
      status: 'error',
      message: 'A valid purchase date is required',
    });
    return;
  }

  // 3. Warranty expiry date validation
  if (!warrantyExpiry || !isValidDateString(warrantyExpiry)) {
    res.status(400).json({
      status: 'error',
      message: 'A valid warranty expiry date is required',
    });
    return;
  }

  const pDate = new Date(purchaseDate);
  const wExpiry = new Date(warrantyExpiry);

  // Normalize to date level
  pDate.setHours(0, 0, 0, 0);
  wExpiry.setHours(0, 0, 0, 0);

  if (wExpiry < pDate) {
    res.status(400).json({
      status: 'error',
      message: 'Warranty expiry date cannot be earlier than purchase date',
    });
    return;
  }

  // 4. Warranty start date validation (if provided)
  if (warrantyStartDate !== undefined && warrantyStartDate !== null && warrantyStartDate !== '') {
    if (!isValidDateString(warrantyStartDate)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid warranty start date format',
      });
      return;
    }

    const wStart = new Date(warrantyStartDate);
    wStart.setHours(0, 0, 0, 0);

    if (wStart < pDate) {
      res.status(400).json({
        status: 'error',
        message: 'Warranty start date cannot be earlier than purchase date',
      });
      return;
    }
  }

  // 5. Price validation (if provided)
  if (price !== undefined && price !== null && price !== '') {
    const numPrice = Number(price);
    if (typeof price !== 'number' || isNaN(numPrice) || numPrice < 0) {
      res.status(400).json({
        status: 'error',
        message: 'Price must be a valid non-negative number',
      });
      return;
    }
  }

  next();
};

export const validateUpdateProduct = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const {
    name,
    purchaseDate,
    warrantyStartDate,
    warrantyExpiry,
    price,
  } = req.body || {};

  // Disallow modifying system fields
  if ('_id' in req.body || 'userId' in req.body || 'createdAt' in req.body) {
    res.status(400).json({
      status: 'error',
      message: 'Cannot modify system fields (_id, userId, createdAt)',
    });
    return;
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Product name must not be blank',
      });
      return;
    }
  }

  if (purchaseDate !== undefined) {
    if (!isValidDateString(purchaseDate)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid purchase date format',
      });
      return;
    }
  }

  if (warrantyExpiry !== undefined) {
    if (!isValidDateString(warrantyExpiry)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid warranty expiry date format',
      });
      return;
    }
  }

  if (warrantyStartDate !== undefined && warrantyStartDate !== null && warrantyStartDate !== '') {
    if (!isValidDateString(warrantyStartDate)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid warranty start date format',
      });
      return;
    }
  }

  if (price !== undefined && price !== null && price !== '') {
    const numPrice = Number(price);
    if (typeof price !== 'number' || isNaN(numPrice) || numPrice < 0) {
      res.status(400).json({
        status: 'error',
        message: 'Price must be a valid non-negative number',
      });
      return;
    }
  }

  next();
};
