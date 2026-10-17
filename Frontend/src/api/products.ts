import { request } from './client';
import type { WarrantyStatus } from '../types';

// ── Backend response types (matching product.model.ts ProductResponse exactly) ──

export interface ProductResponse {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  purchaseDate: string;       // YYYY-MM-DD
  warrantyStartDate?: string; // YYYY-MM-DD
  warrantyExpiry: string;     // YYYY-MM-DD
  retailer?: string;
  price?: number;
  notes?: string;
  status: WarrantyStatus;
  createdAt: string;
  updatedAt: string;
}

/** Returned by /expiring and /search — includes receipt and sharing flags */
export interface ProductItem extends ProductResponse {
  hasReceipt: boolean;
  isShared: boolean;
}

// ── Request payload types ──

export interface CreateProductPayload {
  name: string;
  purchaseDate: string;       // YYYY-MM-DD
  warrantyExpiry: string;     // YYYY-MM-DD
  warrantyStartDate?: string; // YYYY-MM-DD
  category?: string;
  brand?: string;
  model?: string;
  retailer?: string;
  price?: number;
  notes?: string;
}

export interface UpdateProductPayload {
  name?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  warrantyStartDate?: string | null;
  category?: string;
  brand?: string;
  model?: string;
  retailer?: string;
  price?: number;
  notes?: string;
}

// ── API functions ──

/**
 * List all products owned by the authenticated user.
 * Note: backend GET /products does NOT include hasReceipt or isShared.
 */
export async function listProducts(): Promise<ProductResponse[]> {
  const data = await request<{ products: ProductResponse[] }>('/api/products');
  return data.products;
}

/**
 * Get a single product by ID.
 * Accessible to owner or shared viewer (backend enforces this).
 */
export async function getProduct(id: string): Promise<ProductResponse> {
  const data = await request<{ product: ProductResponse }>(`/api/products/${id}`);
  return data.product;
}

/**
 * Create a new product.
 * Required: name, purchaseDate, warrantyExpiry
 * Returns the created product with status computed by the backend.
 */
export async function createProduct(payload: CreateProductPayload): Promise<ProductResponse> {
  const data = await request<{ product: ProductResponse }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.product;
}

/**
 * Update an existing product. Only owners may update.
 */
export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductResponse> {
  const data = await request<{ product: ProductResponse }>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.product;
}

/**
 * Delete a product. Only owners may delete.
 */
export async function deleteProduct(id: string): Promise<void> {
  await request<{ message: string }>(`/api/products/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch products whose warranty status is "expiring" (within 180 days).
 * Includes hasReceipt and isShared flags.
 * Sorted by warrantyExpiry ascending (backend default).
 */
export async function getExpiringProducts(): Promise<{ products: ProductItem[]; count: number }> {
  return request<{ products: ProductItem[]; count: number }>('/api/products/expiring');
}

export interface SearchProductsParams {
  q?: string;
  name?: string;
  brand?: string;
  category?: string;
  model?: string;
  retailer?: string;
  status?: WarrantyStatus;
  expiryFrom?: string;
  expiryTo?: string;
  hasReceipt?: 'true' | 'false' | boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'purchaseDate' | 'warrantyExpiry' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchProductsResponse {
  products: ProductItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Search accessible products with filters, sorting, and pagination.
 * Supports filtering by hasReceipt='true' to find products with proof of purchase.
 */
export async function searchProducts(params: SearchProductsParams = {}): Promise<SearchProductsResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.set(key, String(val));
    }
  });
  const qs = query.toString();
  return request<SearchProductsResponse>(`/api/products/search${qs ? `?${qs}` : ''}`);
}
