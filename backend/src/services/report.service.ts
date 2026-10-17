import mongoose from 'mongoose';
import { Product } from '../models/product.model';
import { Ownership } from '../models/ownership.model';
import { Receipt } from '../models/receipt.model';
import { calculateWarrantyStatus } from '../utilities/warrantyStatus.util';

export interface ReportsSummary {
  totalProducts: number;
  activeWarranties: number;
  expiringWarranties: number;
  expiredWarranties: number;
  withReceipts: number;
  withoutReceipts: number;
  ownedProducts: number;
  sharedProducts: number;
}

export interface ReportsSummaryResponse {
  summary: ReportsSummary;
}

export const getReportsSummary = async (
  userId: string
): Promise<ReportsSummaryResponse> => {
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

  if (allProductIds.length === 0) {
    return {
      summary: {
        totalProducts: 0,
        activeWarranties: 0,
        expiringWarranties: 0,
        expiredWarranties: 0,
        withReceipts: 0,
        withoutReceipts: 0,
        ownedProducts: 0,
        sharedProducts: 0,
      },
    };
  }

  // 2. Fetch accessible product documents
  const products = await Product.find({ _id: { $in: allProductIds } });

  // 3. Fetch receipts for accessible products
  const receipts = await Receipt.find({ productId: { $in: allProductIds } }).select('productId');
  const receiptSet = new Set(receipts.map((r) => r.productId.toString()));

  // 4. Calculate metrics exactly once per product
  let activeWarranties = 0;
  let expiringWarranties = 0;
  let expiredWarranties = 0;
  let withReceipts = 0;
  let withoutReceipts = 0;
  let ownedCount = 0;
  let sharedCount = 0;

  for (const product of products) {
    // Ownership split
    if (product.userId.toString() === userId.toString()) {
      ownedCount++;
    } else {
      sharedCount++;
    }

    // Warranty status (reusing the existing calculation)
    const status = calculateWarrantyStatus(product.warrantyExpiry);
    if (status === 'active') {
      activeWarranties++;
    } else if (status === 'expiring') {
      expiringWarranties++;
    } else if (status === 'expired') {
      expiredWarranties++;
    }

    // Receipt presence
    if (receiptSet.has(product._id.toString())) {
      withReceipts++;
    } else {
      withoutReceipts++;
    }
  }

  return {
    summary: {
      totalProducts: products.length,
      activeWarranties,
      expiringWarranties,
      expiredWarranties,
      withReceipts,
      withoutReceipts,
      ownedProducts: ownedCount,
      sharedProducts: sharedCount,
    },
  };
};
