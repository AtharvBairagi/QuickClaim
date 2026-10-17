import mongoose from 'mongoose';
import { Product, ProductDocument } from '../models/product.model';
import { Ownership } from '../models/ownership.model';
import { AppError } from '../middleware/errorHandler';

/**
 * Ensures the authenticated user is the primary owner of the product.
 * - Primary owner -> returns Product
 * - Shared user -> throws 403 Forbidden
 * - Unrelated user (or non-existent product) -> throws 404 Not Found
 */
export const requireProductOwner = async (
  userId: string,
  productId: string
): Promise<ProductDocument> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError(400, 'Invalid product ID format');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  if (product.userId.toString() === userId.toString()) {
    return product;
  }

  // Check if user has shared view access
  const sharedOwnership = await Ownership.findOne({
    productId: new mongoose.Types.ObjectId(productId),
    sharedWithId: new mongoose.Types.ObjectId(userId),
  });

  if (sharedOwnership) {
    throw new AppError(403, 'Forbidden: Only the product owner can perform this action');
  }

  // Not owner and not shared -> 404 to avoid leaking product existence
  throw new AppError(404, 'Product not found');
};

/**
 * Ensures the authenticated user is either the primary owner or a shared user.
 * - Primary owner or shared user -> returns Product
 * - Unrelated user (or non-existent product) -> throws 404 Not Found
 */
export const requireProductViewer = async (
  userId: string,
  productId: string
): Promise<ProductDocument> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError(400, 'Invalid product ID format');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  if (product.userId.toString() === userId.toString()) {
    return product;
  }

  const sharedOwnership = await Ownership.findOne({
    productId: new mongoose.Types.ObjectId(productId),
    sharedWithId: new mongoose.Types.ObjectId(userId),
  });

  if (sharedOwnership) {
    return product;
  }

  throw new AppError(404, 'Product not found');
};

/**
 * Checks if user is the primary owner without throwing
 */
export const isProductOwner = async (
  userId: string,
  productId: string
): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return false;
  }

  const product = await Product.findOne({
    _id: new mongoose.Types.ObjectId(productId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  return !!product;
};
