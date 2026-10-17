import { Types } from 'mongoose';
import fs from 'fs';
import { Product } from '../models/product.model';
import { Receipt, ReceiptResponse, ReceiptDocument } from '../models/receipt.model';
import { AppError } from '../middleware/errorHandler';
import { requireProductOwner, requireProductViewer } from '../utilities/authorization.util';

export const verifyProductOwnership = async (userId: string, productId: string): Promise<void> => {
  await requireProductOwner(userId, productId);
};

export const verifyProductViewAccess = async (userId: string, productId: string): Promise<void> => {
  await requireProductViewer(userId, productId);
};

export interface CreateReceiptParams {
  productId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
}

export const createReceipt = async (userId: string, params: CreateReceiptParams): Promise<ReceiptResponse> => {
  await verifyProductOwnership(userId, params.productId);

  const existingReceipt = await Receipt.findOne({ productId: params.productId });
  if (existingReceipt) {
    // Before throwing, clean up the newly uploaded file to avoid orphans
    if (fs.existsSync(params.storagePath)) {
      fs.unlinkSync(params.storagePath);
    }
    throw new AppError(409, 'A receipt already exists for this product. Delete it first.');
  }

  try {
    const receipt = await Receipt.create({
      productId: params.productId,
      fileName: params.fileName,
      originalName: params.originalName,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      storagePath: params.storagePath,
    });
    return receipt.toReceiptResponse();
  } catch (error) {
    // If DB creation fails, clean up the physical file
    if (fs.existsSync(params.storagePath)) {
      fs.unlinkSync(params.storagePath);
    }
    throw error;
  }
};

export const getReceipt = async (userId: string, productId: string): Promise<ReceiptResponse> => {
  await verifyProductViewAccess(userId, productId);

  const receipt = await Receipt.findOne({ productId });
  if (!receipt) {
    throw new AppError(404, 'Receipt not found');
  }

  return receipt.toReceiptResponse();
};

export const getReceiptFileInfo = async (userId: string, productId: string): Promise<ReceiptDocument> => {
  await verifyProductViewAccess(userId, productId);

  const receipt = await Receipt.findOne({ productId });
  if (!receipt) {
    throw new AppError(404, 'Receipt not found');
  }

  return receipt;
};

export const deleteReceipt = async (userId: string, productId: string): Promise<void> => {
  await verifyProductOwnership(userId, productId);

  const receipt = await Receipt.findOne({ productId });
  if (!receipt) {
    throw new AppError(404, 'Receipt not found');
  }

  // Delete physical file if it exists
  if (fs.existsSync(receipt.storagePath)) {
    fs.unlinkSync(receipt.storagePath);
  }

  // Delete from database
  await Receipt.deleteOne({ _id: receipt._id });
};
