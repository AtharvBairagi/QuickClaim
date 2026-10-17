import { request } from './client';
import type { OwnershipRecord, SharedProductItem } from '../types';

export interface OwnershipResponse {
  ownership: OwnershipRecord;
}

export interface OwnershipListResponse {
  ownerships: OwnershipRecord[];
}

export interface SharedWithMeResponse {
  products: SharedProductItem[];
}

export interface ShareProductPayload {
  email: string;
}

/**
 * Share a product with another registered user by email address.
 * Owner-only endpoint. Backend returns 403 for shared viewers, 404 for unrelated users.
 */
export async function shareProduct(productId: string, email: string): Promise<OwnershipRecord> {
  const data = await request<OwnershipResponse>(`/api/products/${productId}/ownership`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  return data.ownership;
}

/**
 * Get all shared users for a product.
 * Owner-only endpoint. Backend returns 403 if the requesting user is a shared viewer.
 */
export async function getOwnerships(productId: string): Promise<OwnershipRecord[]> {
  const data = await request<OwnershipListResponse>(`/api/products/${productId}/ownership`);
  return data.ownerships;
}

/**
 * Remove a shared user's access to a product.
 * Owner-only endpoint. Note that targetUserId is the user ID (sharedWith.id), not the ownership record ID.
 */
export async function removeSharedAccess(productId: string, targetUserId: string): Promise<void> {
  await request<{ message: string }>(`/api/products/${productId}/ownership/${targetUserId}`, {
    method: 'DELETE',
  });
}

/**
 * Get all products shared with the authenticated user.
 * Available to any authenticated user.
 */
export async function getSharedWithMe(): Promise<SharedProductItem[]> {
  const data = await request<SharedWithMeResponse>('/api/products/shared-with-me');
  return data.products;
}
