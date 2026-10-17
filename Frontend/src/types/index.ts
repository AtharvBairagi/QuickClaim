export type WarrantyStatus = "active" | "expiring" | "expired";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  userId?: string;
  name: string;
  category: string;
  brand: string;
  model?: string;
  purchaseDate: string;
  warrantyStartDate?: string;
  warrantyExpiry: string;
  retailer?: string;
  price: number;
  notes?: string;
  status: WarrantyStatus;
  hasReceipt: boolean;
  isShared?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReceiptMetadata {
  id: string;
  productId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OwnershipRecord {
  id: string;
  productId?: string;
  sharedWith: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

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

export interface NotificationItem {
  id: string;
  productId: string;
  type: "warranty_expiring" | "warranty_expired";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

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

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface SearchParams {
  q?: string;
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  retailer?: string;
  status?: WarrantyStatus;
  expiryFrom?: string;
  expiryTo?: string;
  hasReceipt?: "true" | "false" | boolean;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "warrantyExpiry" | "name" | "purchaseDate";
  sortOrder?: "asc" | "desc";
}

export type AppRoute =
  | { page: "dashboard" }
  | { page: "products" }
  | { page: "product-detail"; productId: string }
  | { page: "add-product" }
  | { page: "expiring" }
  | { page: "shared" }
  | { page: "receipts" }
  | { page: "reports" }
  | { page: "settings" };
