import mongoose from 'mongoose';
import { Product, ProductResponse } from '../models/product.model';
import { Ownership } from '../models/ownership.model';
import { Receipt } from '../models/receipt.model';
import { calculateWarrantyStatus, WarrantyStatus } from '../utilities/warrantyStatus.util';
import { AppError } from '../middleware/errorHandler';
import { requireProductOwner, requireProductViewer } from '../utilities/authorization.util';

export interface CreateProductInput {
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
}

export interface UpdateProductInput {
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  warrantyStartDate?: string | null;
  warrantyExpiry?: string;
  retailer?: string;
  price?: number;
  notes?: string;
}

export const createProduct = async (
  userId: string,
  data: CreateProductInput
): Promise<ProductResponse> => {
  const product = await Product.create({
    userId: new mongoose.Types.ObjectId(userId),
    name: data.name.trim(),
    category: data.category?.trim(),
    brand: data.brand?.trim(),
    model: data.model?.trim(),
    purchaseDate: new Date(data.purchaseDate),
    warrantyStartDate: data.warrantyStartDate ? new Date(data.warrantyStartDate) : undefined,
    warrantyExpiry: new Date(data.warrantyExpiry),
    retailer: data.retailer?.trim(),
    price: data.price !== undefined ? Number(data.price) : undefined,
    notes: data.notes?.trim(),
  });

  return product.toProductResponse();
};

export const getProducts = async (userId: string): Promise<ProductResponse[]> => {
  const products = await Product.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({
    createdAt: -1,
  });

  return products.map((product) => product.toProductResponse());
};

export const getProductById = async (
  userId: string,
  productId: string
): Promise<ProductResponse> => {
  const product = await requireProductViewer(userId, productId);
  return product.toProductResponse();
};

export const updateProduct = async (
  userId: string,
  productId: string,
  data: UpdateProductInput
): Promise<ProductResponse> => {
  const product = await requireProductOwner(userId, productId);

  // 1. Determine final date values for combined date consistency validation
  const finalPurchaseDate = data.purchaseDate
    ? new Date(data.purchaseDate)
    : product.purchaseDate;

  const finalWarrantyExpiry = data.warrantyExpiry
    ? new Date(data.warrantyExpiry)
    : product.warrantyExpiry;

  const finalWarrantyStartDate =
    data.warrantyStartDate !== undefined
      ? data.warrantyStartDate
        ? new Date(data.warrantyStartDate)
        : undefined
      : product.warrantyStartDate;

  // Normalize dates to midnight for comparison
  const pDate = new Date(finalPurchaseDate);
  pDate.setHours(0, 0, 0, 0);

  const wExpiry = new Date(finalWarrantyExpiry);
  wExpiry.setHours(0, 0, 0, 0);

  if (wExpiry < pDate) {
    throw new AppError(400, 'Warranty expiry date cannot be earlier than purchase date');
  }

  if (finalWarrantyStartDate) {
    const wStart = new Date(finalWarrantyStartDate);
    wStart.setHours(0, 0, 0, 0);

    if (wStart < pDate) {
      throw new AppError(400, 'Warranty start date cannot be earlier than purchase date');
    }
  }

  // 2. Apply field updates
  if (data.name !== undefined) product.name = data.name.trim();
  if (data.category !== undefined) product.category = data.category.trim();
  if (data.brand !== undefined) product.brand = data.brand.trim();
  if (data.model !== undefined) product.set('model', data.model.trim());
  if (data.purchaseDate !== undefined) product.purchaseDate = new Date(data.purchaseDate);
  if (data.warrantyStartDate !== undefined) {
    product.warrantyStartDate = data.warrantyStartDate
      ? new Date(data.warrantyStartDate)
      : undefined;
  }
  if (data.warrantyExpiry !== undefined) product.warrantyExpiry = new Date(data.warrantyExpiry);
  if (data.retailer !== undefined) product.retailer = data.retailer.trim();
  if (data.price !== undefined) product.price = Number(data.price);
  if (data.notes !== undefined) product.notes = data.notes.trim();

  await product.save();

  return product.toProductResponse();
};

export const deleteProduct = async (
  userId: string,
  productId: string
): Promise<void> => {
  await requireProductOwner(userId, productId);

  const result = await Product.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(productId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!result) {
    throw new AppError(404, 'Product not found');
  }

  await Ownership.deleteMany({ productId: new mongoose.Types.ObjectId(productId) });
};

export interface SearchProductsQuery {
  q?: string;
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  retailer?: string;
  status?: WarrantyStatus;
  expiryFrom?: string;
  expiryTo?: string;
  hasReceipt?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: 'createdAt' | 'warrantyExpiry' | 'name' | 'purchaseDate';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchProductItem extends ProductResponse {
  hasReceipt: boolean;
  isShared: boolean;
}

export interface SearchProductsResult {
  products: SearchProductItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const searchProducts = async (
  userId: string,
  query: SearchProductsQuery
): Promise<SearchProductsResult> => {
  const userObjId = new mongoose.Types.ObjectId(userId);

  // 1. Gather all accessible product IDs (owned + shared)
  const ownedProducts = await Product.find({ userId: userObjId }).select('_id');
  const ownedProductIds = ownedProducts.map((p) => p._id);

  const sharedOwnerships = await Ownership.find({ sharedWithId: userObjId }).select('productId');
  const sharedProductIds = sharedOwnerships.map((o) => o.productId);

  const allIdMap = new Map<string, mongoose.Types.ObjectId>();
  for (const id of ownedProductIds) allIdMap.set(id.toString(), id);
  for (const id of sharedProductIds) allIdMap.set(id.toString(), id);

  const allProductIds = Array.from(allIdMap.values());
  const defaultLimit = 20;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || defaultLimit));

  if (allProductIds.length === 0) {
    return {
      products: [],
      pagination: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  // 2. Build MongoDB query filter
  const filter: any = { _id: { $in: allProductIds } };

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (query.q && query.q.trim()) {
    const qRegex = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [
      { name: qRegex },
      { brand: qRegex },
      { model: qRegex },
      { category: qRegex },
      { retailer: qRegex },
    ];
  }

  if (query.name && query.name.trim()) {
    filter.name = new RegExp(escapeRegex(query.name.trim()), 'i');
  }
  if (query.brand && query.brand.trim()) {
    filter.brand = new RegExp(escapeRegex(query.brand.trim()), 'i');
  }
  if (query.category && query.category.trim()) {
    filter.category = new RegExp(escapeRegex(query.category.trim()), 'i');
  }
  if (query.model && query.model.trim()) {
    filter.model = new RegExp(escapeRegex(query.model.trim()), 'i');
  }
  if (query.retailer && query.retailer.trim()) {
    filter.retailer = new RegExp(escapeRegex(query.retailer.trim()), 'i');
  }

  // Date filters: expiryFrom, expiryTo
  if (query.expiryFrom || query.expiryTo) {
    filter.warrantyExpiry = {};
    if (query.expiryFrom) {
      filter.warrantyExpiry.$gte = new Date(query.expiryFrom);
    }
    if (query.expiryTo) {
      const toDate = new Date(query.expiryTo);
      toDate.setHours(23, 59, 59, 999);
      filter.warrantyExpiry.$lte = toDate;
    }
  }

  // Receipt filter
  const receipts = await Receipt.find({ productId: { $in: allProductIds } }).select('productId');
  const receiptProductIds = new Set(receipts.map((r) => r.productId.toString()));

  if (query.hasReceipt !== undefined) {
    const hasReceiptBool = query.hasReceipt === 'true' || query.hasReceipt === (true as any);
    if (hasReceiptBool) {
      filter._id = { $in: allProductIds.filter((id) => receiptProductIds.has(id.toString())) };
    } else {
      filter._id = { $in: allProductIds.filter((id) => !receiptProductIds.has(id.toString())) };
    }
  }

  // Sort criteria
  const allowedSortFields = ['createdAt', 'warrantyExpiry', 'name', 'purchaseDate'];
  const sortBy = allowedSortFields.includes(query.sortBy || '') ? query.sortBy! : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sortObj: any = { [sortBy]: sortOrder };

  // Fetch candidates from DB
  const matchedProducts = await Product.find(filter).sort(sortObj);

  // Status filtering using calculateWarrantyStatus utility
  let filteredProducts = matchedProducts;
  if (query.status) {
    filteredProducts = matchedProducts.filter(
      (p) => calculateWarrantyStatus(p.warrantyExpiry) === query.status
    );
  }

  const total = filteredProducts.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const paginatedDocs = filteredProducts.slice(skip, skip + limit);

  const productItems: SearchProductItem[] = paginatedDocs.map((doc) => {
    const base = doc.toProductResponse();
    return {
      ...base,
      hasReceipt: receiptProductIds.has(doc._id.toString()),
      isShared: doc.userId.toString() !== userId.toString(),
    };
  });

  return {
    products: productItems,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const getExpiringProducts = async (
  userId: string
): Promise<{ products: SearchProductItem[]; count: number }> => {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const ownedProducts = await Product.find({ userId: userObjId }).select('_id');
  const ownedProductIds = ownedProducts.map((p) => p._id);

  const sharedOwnerships = await Ownership.find({ sharedWithId: userObjId }).select('productId');
  const sharedProductIds = sharedOwnerships.map((o) => o.productId);

  const allIdMap = new Map<string, mongoose.Types.ObjectId>();
  for (const id of ownedProductIds) allIdMap.set(id.toString(), id);
  for (const id of sharedProductIds) allIdMap.set(id.toString(), id);

  const allProductIds = Array.from(allIdMap.values());
  if (allProductIds.length === 0) {
    return { products: [], count: 0 };
  }

  const products = await Product.find({ _id: { $in: allProductIds } }).sort({ warrantyExpiry: 1 });
  const receipts = await Receipt.find({ productId: { $in: allProductIds } }).select('productId');
  const receiptProductIds = new Set(receipts.map((r) => r.productId.toString()));

  const expiringProducts: SearchProductItem[] = [];

  for (const product of products) {
    const status = calculateWarrantyStatus(product.warrantyExpiry);
    if (status === 'expiring') {
      const base = product.toProductResponse();
      expiringProducts.push({
        ...base,
        status,
        hasReceipt: receiptProductIds.has(product._id.toString()),
        isShared: product.userId.toString() !== userId.toString(),
      });
    }
  }

  return {
    products: expiringProducts,
    count: expiringProducts.length,
  };
};
