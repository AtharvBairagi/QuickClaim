import { request, ApiError } from './client';

export interface ReceiptResponse {
  id: string;
  productId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Format bytes to human readable format (e.g. 284 KB, 1.2 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Derive high-level file type for badges and thumbnails
 */
export function deriveFileType(mimeType: string, originalName?: string): 'PDF' | 'JPG' | 'PNG' | 'WEBP' {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/jpeg') return 'JPG';
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/webp') return 'WEBP';

  const ext = (originalName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'jpg' || ext === 'jpeg') return 'JPG';
  if (ext === 'png') return 'PNG';
  if (ext === 'webp') return 'WEBP';

  return 'PDF';
}

/**
 * Upload a receipt file (PDF, JPEG, PNG, WEBP, max 10MB) for a product.
 * Restricted to product owner by backend.
 */
export async function uploadReceipt(productId: string, file: File): Promise<ReceiptResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const data = await request<{ receipt: ReceiptResponse }>(`/api/products/${productId}/receipt`, {
    method: 'POST',
    body: formData,
  });

  return data.receipt;
}

/**
 * Fetch receipt metadata for a product.
 * Accessible to product owner and shared viewers.
 */
export async function getReceipt(productId: string): Promise<ReceiptResponse> {
  const data = await request<{ receipt: ReceiptResponse }>(`/api/products/${productId}/receipt`);
  return data.receipt;
}

/**
 * Delete a receipt and its associated physical file.
 * Restricted to product owner by backend.
 */
export async function deleteReceipt(productId: string): Promise<void> {
  await request<{ message: string }>(`/api/products/${productId}/receipt`, {
    method: 'DELETE',
  });
}

/**
 * Authenticated download of the receipt file.
 * Automatically transmits HttpOnly session cookies.
 * Delays URL revocation to ensure the browser successfully finishes saving the file.
 */
export async function downloadReceipt(productId: string, filename: string): Promise<void> {
  const response = await fetch(`/api/products/${productId}/receipt/download`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = 'Failed to download receipt';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || 'receipt';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Safely delay revocation so browser download manager has completed stream read
  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 60000);
}

/**
 * Obtain an authenticated object URL for in-browser previewing (images / PDF iframe).
 * Returns the URL, detected MIME type, and a cleanup function to revoke the URL on close.
 */
export async function getReceiptBlobUrl(
  productId: string
): Promise<{ url: string; mimeType: string; cleanup: () => void }> {
  const response = await fetch(`/api/products/${productId}/receipt/download`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = 'Failed to load receipt preview';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  const blob = await response.blob();
  const mimeType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
  const url = window.URL.createObjectURL(blob);

  let cleaned = false;
  return {
    url,
    mimeType,
    cleanup: () => {
      if (!cleaned) {
        cleaned = true;
        window.URL.revokeObjectURL(url);
      }
    },
  };
}
