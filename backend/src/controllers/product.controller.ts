import { Request, Response, NextFunction } from 'express';
import {
  createProduct as createProductService,
  getProducts as getProductsService,
  getProductById as getProductByIdService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  searchProducts as searchProductsService,
  getExpiringProducts as getExpiringProductsService,
} from '../services/product.service';
import { AppError } from '../middleware/errorHandler';

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const product = await createProductService(userId, req.body);
    res.status(201).json({
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const products = await getProductsService(userId);
    res.status(200).json({
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const productId = typeof req.params.id === 'string' ? req.params.id : '';
    const product = await getProductByIdService(userId, productId);
    res.status(200).json({
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const productId = typeof req.params.id === 'string' ? req.params.id : '';
    const product = await updateProductService(userId, productId, req.body);
    res.status(200).json({
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const productId = typeof req.params.id === 'string' ? req.params.id : '';
    await deleteProductService(userId, productId);
    res.status(200).json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const searchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const result = await searchProductsService(userId, req.query as any);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getExpiringProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const result = await getExpiringProductsService(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
