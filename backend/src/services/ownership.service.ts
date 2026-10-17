import mongoose from 'mongoose';
import { Ownership, OwnershipResponse } from '../models/ownership.model';
import { User } from '../models/user.model';
import { calculateWarrantyStatus, WarrantyStatus } from '../utilities/warrantyStatus.util';
import { requireProductOwner } from '../utilities/authorization.util';
import { AppError } from '../middleware/errorHandler';

export interface SharedProductItem {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  purchaseDate: string;
  warrantyStartDate?: string;
  warrantyExpiry: string;
  retailer?: string;
  price?: number;
  notes?: string;
  status: WarrantyStatus;
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SharedUserItem {
  id: string;
  sharedWith: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export const shareProduct = async (
  ownerId: string,
  productId: string,
  email: string
): Promise<OwnershipResponse> => {
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new AppError(400, 'Please enter a valid email address');
  }

  // Ensure requester is owner (will throw 403 for shared user, 404 for unrelated user)
  await requireProductOwner(ownerId, productId);

  const normalizedEmail = email.trim().toLowerCase();
  const targetUser = await User.findOne({ email: normalizedEmail });
  if (!targetUser) {
    throw new AppError(404, 'User with this email does not exist');
  }

  if (targetUser._id.toString() === ownerId.toString()) {
    throw new AppError(400, 'Cannot share product with yourself');
  }

  const existingShare = await Ownership.findOne({
    productId: new mongoose.Types.ObjectId(productId),
    sharedWithId: targetUser._id,
  });

  if (existingShare) {
    throw new AppError(409, 'Product is already shared with this user');
  }

  const ownership = await Ownership.create({
    productId: new mongoose.Types.ObjectId(productId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    sharedWithId: targetUser._id,
  });

  return {
    id: ownership._id.toString(),
    productId,
    sharedWith: {
      id: targetUser._id.toString(),
      name: targetUser.name,
      email: targetUser.email,
    },
    createdAt: ownership.createdAt ? ownership.createdAt.toISOString() : new Date().toISOString(),
  };
};

export const getOwnerships = async (
  ownerId: string,
  productId: string
): Promise<SharedUserItem[]> => {
  // Ensure requester is owner (will throw 403 for shared user, 404 for unrelated user)
  await requireProductOwner(ownerId, productId);

  const records = await Ownership.find({
    productId: new mongoose.Types.ObjectId(productId),
  })
    .populate('sharedWithId', 'name email')
    .sort({ createdAt: -1 });

  return records.map((record) => {
    const user = record.sharedWithId as any;
    return {
      id: record._id.toString(),
      sharedWith: {
        id: user?._id ? user._id.toString() : (user?.toString() || ''),
        name: user?.name || '',
        email: user?.email || '',
      },
      createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
    };
  });
};

export const removeSharedAccess = async (
  ownerId: string,
  productId: string,
  targetUserId: string
): Promise<void> => {
  // Ensure requester is owner (will throw 403 for shared user, 404 for unrelated user)
  await requireProductOwner(ownerId, productId);

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError(400, 'Invalid user ID format');
  }

  const deleted = await Ownership.findOneAndDelete({
    productId: new mongoose.Types.ObjectId(productId),
    sharedWithId: new mongoose.Types.ObjectId(targetUserId),
  });

  if (!deleted) {
    throw new AppError(404, 'Shared access record not found');
  }
};

export const getSharedWithMeProducts = async (
  userId: string
): Promise<SharedProductItem[]> => {
  const records = await Ownership.find({
    sharedWithId: new mongoose.Types.ObjectId(userId),
  })
    .populate({
      path: 'productId',
      populate: {
        path: 'userId',
        select: 'name email',
      },
    })
    .sort({ createdAt: -1 });

  const products: SharedProductItem[] = [];

  for (const record of records) {
    const prod = record.productId as any;
    if (!prod || !prod.name) continue;

    const status = calculateWarrantyStatus(prod.warrantyExpiry);
    const owner = prod.userId as any;

    const item: SharedProductItem = {
      id: prod._id.toString(),
      name: prod.name,
      purchaseDate: prod.purchaseDate ? new Date(prod.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: prod.warrantyExpiry ? new Date(prod.warrantyExpiry).toISOString().split('T')[0] : '',
      status,
      owner: {
        id: owner?._id ? owner._id.toString() : (owner?.toString() || ''),
        name: owner?.name || '',
        email: owner?.email || '',
      },
    };

    if (prod.category !== undefined && prod.category !== null) item.category = prod.category;
    if (prod.brand !== undefined && prod.brand !== null) item.brand = prod.brand;
    if (prod.model !== undefined && prod.model !== null) item.model = prod.model;
    if (prod.warrantyStartDate) {
      item.warrantyStartDate = new Date(prod.warrantyStartDate).toISOString().split('T')[0];
    }
    if (prod.retailer !== undefined && prod.retailer !== null) item.retailer = prod.retailer;
    if (prod.price !== undefined && prod.price !== null) item.price = prod.price;
    if (prod.notes !== undefined && prod.notes !== null) item.notes = prod.notes;

    products.push(item);
  }

  return products;
};
