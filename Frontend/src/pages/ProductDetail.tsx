import { useState, useEffect, useCallback, useRef, type ReactNode, type FormEvent } from "react";
import StatusBadge from "../components/StatusBadge";
import { getProduct, deleteProduct } from "../api/products";
import type { ProductResponse } from "../api/products";
import {
  getReceipt,
  uploadReceipt,
  deleteReceipt,
  downloadReceipt,
  getReceiptBlobUrl,
  formatFileSize,
  deriveFileType,
  type ReceiptResponse,
} from "../api/receipts";
import {
  getOwnerships,
  shareProduct,
  removeSharedAccess,
} from "../api/ownership";
import { ApiError } from "../api/client";
import type { AppRoute, OwnershipRecord } from "../types";
import { formatDate, getDaysRemaining, formatDaysRemaining } from "../utils/date";

interface Props {
  productId: string;
  onNavigate: (route: AppRoute) => void;
}

export type PermissionState = "unknown" | "owner" | "viewer" | "error";

export default function ProductDetail({ productId, onNavigate }: Props) {
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Permission & ownership state: default unknown (never default to owner)
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");
  const [ownerships, setOwnerships] = useState<OwnershipRecord[]>([]);
  const [ownershipLoading, setOwnershipLoading] = useState(true);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch product details
  const fetchProduct = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProduct(productId)
      .then((p) => {
        if (!cancelled) {
          setProduct(p);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "Product not found."
              : err instanceof ApiError && err.status === 403
                ? "You do not have permission to view this product."
                : err?.message || "Failed to load product."
          );
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [productId]);

  // Check ownership permissions: 200 = owner, 403 = viewer, other = error
  const fetchOwnership = useCallback(() => {
    let cancelled = false;
    setOwnershipLoading(true);
    setOwnershipError(null);

    getOwnerships(productId)
      .then((records) => {
        if (!cancelled) {
          setPermissionState("owner");
          setOwnerships(records);
          setOwnershipLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 403) {
            // Authoritative confirmation from backend: user has shared view access
            setPermissionState("viewer");
            setOwnerships([]);
          } else {
            // Network failure or 500 server error — do NOT assume viewer
            setPermissionState("error");
            setOwnershipError(err?.message || "Failed to verify product permissions.");
          }
          setOwnershipLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    const cancelProduct = fetchProduct();
    const cancelOwnership = fetchOwnership();
    return () => {
      cancelProduct();
      cancelOwnership();
    };
  }, [fetchProduct, fetchOwnership]);

  async function handleDelete() {
    if (!product || permissionState !== "owner") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProduct(product.id);
      onNavigate({ page: "products" });
    } catch (err: any) {
      const msg =
        err instanceof ApiError && err.status === 403
          ? "Only the product owner can delete it."
          : err?.message || "Failed to delete product.";
      setDeleteError(msg);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !product) {
    return (
      <div className="px-8 py-8">
        <button
          onClick={() => onNavigate({ page: "products" })}
          className="flex items-center gap-1.5 text-[12px] text-[#71717a] hover:text-[#0d0d0d] transition-colors mb-5"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Products
        </button>
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
          </svg>
          {error ?? "Product not found."}
        </div>
      </div>
    );
  }

  const days = getDaysRemaining(product.warrantyExpiry);

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">
      {/* Back nav */}
      <button
        onClick={() => onNavigate({ page: permissionState === "viewer" ? "shared" : "products" })}
        className="flex items-center gap-1.5 text-[12px] text-[#71717a] hover:text-[#0d0d0d] transition-colors mb-5 group"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {permissionState === "viewer" ? "Back to Shared With Me" : "Back to Products"}
      </button>

      {/* Delete error */}
      {deleteError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c] mb-5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
          </svg>
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-auto text-[#b91c1c]" aria-label="Dismiss">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Permission check error notice */}
      {permissionState === "error" && ownershipError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fffbeb] border border-[#fef3c7] rounded-[4px] text-sm text-[#92400e] mb-5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#d97706" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#d97706" />
          </svg>
          <span>{ownershipError}</span>
          <button
            onClick={fetchOwnership}
            className="ml-auto text-xs font-medium text-[#92400e] underline underline-offset-2 hover:text-[#78350f]"
          >
            Retry Permission Check
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-start gap-4">
          <CategoryThumb category={product.category ?? "?"} large />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">
                {product.name}
              </h2>
              <StatusBadge status={product.status} />
              {permissionState === "viewer" && (
                <span className="text-[11px] font-medium text-[#52525b] bg-[#f4f4f5] border border-[#a1a1aa] px-2 py-0.5 rounded-[3px] mono">
                  Shared (View Only)
                </span>
              )}
            </div>
            <div className="text-sm text-[#71717a] mt-1">{product.category} · {product.brand}</div>
          </div>
        </div>

        {/* Action controls: Owner-only actions are hidden until ownership is confirmed */}
        <div className="flex items-center gap-2 shrink-0">
          {permissionState === "owner" ? (
            !confirmDelete ? (
              <>
                <button
                  onClick={() => onNavigate({ page: "add-product" })}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
                >
                  <EditIcon />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#b91c1c] border border-[#fecaca] px-3 py-1.5 rounded-[4px] hover:bg-[#fef2f2] transition-colors disabled:opacity-50"
                >
                  <TrashIcon />
                  Delete
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#71717a]">Delete this product?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#dc2626] px-3 py-1.5 rounded-[4px] hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )
          ) : permissionState === "viewer" ? (
            <div className="flex items-center gap-1.5 text-xs text-[#71717a] bg-[#fafafa] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px]">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="5" width="10" height="8" rx="1.5" stroke="#71717a" strokeWidth="1.3" />
                <path d="M4.5 5V3.5a2.5 2.5 0 015 0V5" stroke="#71717a" strokeWidth="1.3" />
              </svg>
              <span>Read-only viewer</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          <ProductInfoSection product={product} />
          <ReceiptSection
            productId={product.id}
            productName={product.name}
            permissionState={permissionState}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <WarrantySection product={product} days={days} />
          <SharingSection
            productId={product.id}
            permissionState={permissionState}
            ownerships={ownerships}
            loading={ownershipLoading}
            error={ownershipError}
            onRefresh={fetchOwnership}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */
function LoadingState() {
  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto animate-pulse">
      <div className="h-3.5 w-28 bg-[#f4f4f5] rounded mb-5" />
      <div className="flex items-start gap-4 mb-7">
        <div className="w-12 h-12 bg-[#a1a1aa] rounded-[4px]" />
        <div>
          <div className="h-5 w-48 bg-[#a1a1aa] rounded mb-2" />
          <div className="h-3.5 w-32 bg-[#f4f4f5] rounded" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-5">
          <div className="h-48 bg-white border border-[#a1a1aa] rounded-[4px]" />
          <div className="h-36 bg-white border border-[#a1a1aa] rounded-[4px]" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="h-40 bg-white border border-[#a1a1aa] rounded-[4px]" />
          <div className="h-36 bg-white border border-[#a1a1aa] rounded-[4px]" />
        </div>
      </div>
    </div>
  );
}

/* ── Product Information ── */
function ProductInfoSection({ product }: { product: ProductResponse }) {
  return (
    <Section title="Product Information">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <Field label="Product Name" value={product.name} />
        <Field label="Brand" value={product.brand ?? "—"} />
        <Field label="Model" value={product.model ?? "—"} />
        <Field label="Category" value={product.category ?? "—"} />
        <Field label="Purchase Date" value={formatDate(product.purchaseDate)} mono />
        <Field
          label="Purchase Price"
          value={product.price !== undefined ? `$${product.price.toLocaleString()}` : "—"}
          mono
        />
        <Field label="Store / Retailer" value={product.retailer ?? "—"} />
        {product.notes && (
          <div className="col-span-2">
            <Field label="Notes" value={product.notes} />
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Warranty Section ── */
function WarrantySection({ product, days }: { product: ProductResponse; days: number }) {
  const isExpired = product.status === "expired";
  const isExpiring = product.status === "expiring";

  const hasStartDate = !!product.warrantyStartDate;
  const totalDays = hasStartDate
    ? Math.ceil(
      (new Date(product.warrantyExpiry).getTime() - new Date(product.warrantyStartDate!).getTime()) /
      (1000 * 60 * 60 * 24)
    )
    : 0;
  const elapsed = totalDays > 0 ? totalDays - Math.max(0, days) : 0;
  const pct = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;

  const barColor = isExpired ? "bg-[#dc2626]" : isExpiring ? "bg-[#d97706]" : "bg-[#16a34a]";
  const bgBorder = isExpired
    ? "border-[#fecaca] bg-[#fff8f8]"
    : isExpiring
      ? "border-[#fde68a] bg-[#fffdf5]"
      : "border-[#bbf7d0] bg-[#f8fffe]";

  return (
    <Section title="Warranty">
      <div className={`rounded-[4px] border px-4 py-3.5 mb-5 ${bgBorder}`}>
        <div className="flex items-center justify-between mb-1">
          <StatusBadge status={product.status} />
          <span
            className={`mono text-[13px] font-semibold ${isExpired ? "text-[#b91c1c]" : isExpiring ? "text-[#b45309]" : "text-[#15803d]"
              }`}
          >
            {formatDaysRemaining(days)}
          </span>
        </div>
        {hasStartDate && (
          <div className="mt-3 mb-0.5">
            <div className="h-1.5 bg-[#a1a1aa] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[#52525b] mono">{formatDate(product.warrantyStartDate!)}</span>
              <span className="text-[10px] text-[#52525b] mono">{formatDate(product.warrantyExpiry)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {product.warrantyStartDate && (
          <Field label="Warranty Start" value={formatDate(product.warrantyStartDate)} mono />
        )}
        <Field label="Warranty End" value={formatDate(product.warrantyExpiry)} mono />
        <Field
          label="Remaining"
          value={isExpired ? "Expired" : formatDaysRemaining(days)}
          mono
          valueColor={isExpired ? "text-[#b91c1c]" : isExpiring ? "text-[#b45309]" : "text-[#15803d]"}
        />
      </div>
    </Section>
  );
}

/* ── Receipt Section (Aware of permission state) ── */
function ReceiptSection({
  productId,
  productName,
  permissionState,
}: {
  productId: string;
  productName: string;
  permissionState: PermissionState;
}) {
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<{
    url: string;
    mimeType: string;
    cleanup: () => void;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getReceipt(productId)
      .then((r) => {
        if (!cancelled) {
          setReceipt(r);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setReceipt(null);
          } else {
            setError(err?.message || "Failed to load receipt.");
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    return () => {
      if (previewData) {
        previewData.cleanup();
      }
    };
  }, [previewData]);

  async function handleFileSelected(file: File) {
    if (permissionState !== "owner") {
      setUploadError("Only the product owner can upload receipts.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds the maximum allowed size of 10 MB.");
      return;
    }

    const allowedMime = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp"];

    if (!allowedMime.includes(file.type) && !allowedExts.includes(ext)) {
      setUploadError("Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const created = await uploadReceipt(productId, file);
      setReceipt(created);
    } catch (err: any) {
      const msg =
        err instanceof ApiError && err.status === 403
          ? "Only the product owner can upload a receipt."
          : err instanceof ApiError && err.status === 409
            ? "A receipt already exists for this product. Delete it first."
            : err?.message || "Failed to upload receipt.";
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (permissionState !== "owner") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteReceipt(productId);
      setReceipt(null);
      setConfirmDelete(false);
    } catch (err: any) {
      const msg =
        err instanceof ApiError && err.status === 403
          ? "Only the product owner can delete this receipt."
          : err?.message || "Failed to delete receipt.";
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (!receipt) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReceipt(productId, receipt.originalName);
    } catch (err: any) {
      setDownloadError(err?.message || "Failed to download receipt.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleOpenPreview() {
    if (!receipt) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await getReceiptBlobUrl(productId);
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err?.message || "Failed to load receipt preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleClosePreview() {
    if (previewData) {
      previewData.cleanup();
      setPreviewData(null);
    }
  }

  const fileType = receipt ? deriveFileType(receipt.mimeType, receipt.originalName) : "PDF";
  const isOwner = permissionState === "owner";

  return (
    <Section title="Receipt">
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-xs text-[#71717a]">
          <svg className="animate-spin h-4 w-4 text-[#0d0d0d] mb-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Checking receipt...
        </div>
      ) : receipt ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3.5 border border-[#a1a1aa] rounded-[4px] bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-10 rounded-[3px] border border-[#a1a1aa] flex items-center justify-center shrink-0 ${fileType === "PDF"
                  ? "bg-[#fef2f2] text-[#b91c1c]"
                  : fileType === "JPG"
                    ? "bg-[#eff6ff] text-[#3b82f6]"
                    : "bg-[#f0fdf4] text-[#16a34a]"
                  }`}
              >
                <span className="text-[10px] font-bold mono">{fileType}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#0d0d0d] truncate max-w-[280px]">
                  {receipt.originalName}
                </div>
                <div className="text-[11px] text-[#52525b] mono mt-0.5">
                  {formatFileSize(receipt.fileSize)} · Uploaded {formatDate(receipt.uploadedAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleOpenPreview}
                disabled={previewLoading}
                className="text-[12px] font-medium text-[#3f3f46] hover:text-[#0d0d0d] border border-[#a1a1aa] px-2.5 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors disabled:opacity-50"
              >
                {previewLoading ? "Loading..." : "Preview"}
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="text-[12px] font-medium text-[#0d0d0d] bg-[#f4f4f5] border border-[#a1a1aa] px-2.5 py-1.5 rounded-[4px] hover:bg-[#a1a1aa] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {downloading ? "Downloading..." : "Download"}
              </button>

              {/* Delete button only shown to confirmed owner */}
              {isOwner && (
                !confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-[12px] text-[#b91c1c] hover:text-[#dc2626] border border-[#fecaca] hover:bg-[#fef2f2] px-2 py-1.5 rounded-[4px] transition-colors"
                    title="Delete Receipt"
                  >
                    <TrashIcon />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-[11px] font-medium text-white bg-[#dc2626] px-2 py-1.5 rounded-[4px] hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="text-[11px] text-[#71717a] border border-[#a1a1aa] px-2 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )
              )}
            </div>
          </div>

          {deleteError && (
            <div className="text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2 rounded-[4px]">
              {deleteError}
            </div>
          )}

          {downloadError && (
            <div className="text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2 rounded-[4px]">
              {downloadError}
            </div>
          )}

          {previewError && (
            <div className="text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2 rounded-[4px]">
              {previewError}
            </div>
          )}
        </div>
      ) : isOwner ? (
        /* Owner can upload */
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileSelected(f);
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center py-7 border-2 border-dashed rounded-[4px] text-center cursor-pointer transition-colors ${dragging
              ? "border-[#0d0d0d] bg-[#f4f4f5]"
              : "border-[#a1a1aa] hover:border-[#52525b] hover:bg-[#fafafa]"
              }`}
          >
            <div className="w-9 h-9 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mb-2.5">
              {uploading ? (
                <svg className="animate-spin h-4 w-4 text-[#0d0d0d]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <ReceiptIcon />
              )}
            </div>
            <div className="text-[13px] text-[#52525b] font-medium mb-0.5">
              {uploading ? "Uploading receipt..." : "Drag and drop, or browse to upload"}
            </div>
            <div className="text-[11px] text-[#52525b]">PDF, JPG, PNG, WEBP — up to 10 MB</div>
          </div>

          {uploadError && (
            <div className="mt-2.5 text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2.5 rounded-[4px]">
              {uploadError}
            </div>
          )}

          {error && (
            <div className="mt-2.5 text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2.5 rounded-[4px]">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Shared Viewer sees read-only empty state */
        <div className="py-7 px-4 text-center border border-dashed border-[#a1a1aa] rounded-[4px] bg-[#fafafa]">
          <div className="w-8 h-8 mx-auto mb-2 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center text-[#52525b]">
            <ReceiptIcon />
          </div>
          <div className="text-[12px] font-medium text-[#52525b]">No receipt uploaded</div>
          <p className="text-[11px] text-[#52525b] mt-0.5">
            The owner has not attached a receipt to this product.
          </p>
        </div>
      )}

      {/* Authenticated Receipt Preview Modal */}
      {previewData && receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[4px] border border-[#a1a1aa] shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#a1a1aa]">
              <div>
                <div className="text-sm font-semibold text-[#0d0d0d]">{receipt.originalName}</div>
                <div className="text-[11px] text-[#71717a] mono">
                  {formatFileSize(receipt.fileSize)} · {productName}
                </div>
              </div>
              <button
                onClick={handleClosePreview}
                className="w-7 h-7 flex items-center justify-center rounded-[4px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0d0d0d] transition-colors"
              >
                <XIcon />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-[#f9f9f9] p-4 flex items-center justify-center min-h-[300px]">
              {previewData.mimeType.startsWith("image/") ? (
                <img
                  src={previewData.url}
                  alt={receipt.originalName}
                  className="max-w-full max-h-[60vh] object-contain rounded-[2px] shadow-sm"
                />
              ) : (
                <iframe
                  src={previewData.url}
                  title={receipt.originalName}
                  className="w-full h-[60vh] rounded-[2px] border border-[#a1a1aa] bg-white"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#a1a1aa] bg-white">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="text-xs font-medium text-[#0d0d0d] bg-[#f4f4f5] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#a1a1aa] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {downloading ? "Downloading..." : "Download File"}
              </button>
              <button
                onClick={handleClosePreview}
                className="text-xs font-medium text-[#71717a] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] hover:text-[#0d0d0d] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Sharing Section (Live Shared Ownership Management) ── */
function SharingSection({
  productId,
  permissionState,
  ownerships,
  loading,
  error,
  onRefresh,
}: {
  productId: string;
  permissionState: PermissionState;
  ownerships: OwnershipRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemove(targetUserId: string) {
    setRemovingUserId(targetUserId);
    setRemoveError(null);
    try {
      await removeSharedAccess(productId, targetUserId);
      setConfirmUserId(null);
      onRefresh();
    } catch (err: any) {
      setRemoveError(err?.message || "Failed to remove shared access.");
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <Section title="Shared Ownership">
      {permissionState === "viewer" ? (
        <div className="p-3.5 bg-[#f9f9f9] border border-[#a1a1aa] rounded-[4px]">
          <div className="flex items-center gap-2 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-[#52525b]">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M7 4.5v3M7 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="text-[12px] font-semibold text-[#0d0d0d]">View-Only Access</span>
          </div>
          <p className="text-[11px] text-[#71717a] leading-relaxed">
            This product is shared with you. You have view-only access to its details and receipts. Only the owner can manage sharing permissions or delete the product.
          </p>
        </div>
      ) : permissionState === "unknown" || loading ? (
        <div className="py-5 text-center text-xs text-[#71717a] animate-pulse">
          Checking sharing permissions...
        </div>
      ) : permissionState === "error" ? (
        <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-xs text-[#b91c1c]">
          {error || "Could not load sharing records."}
        </div>
      ) : (
        /* Verified Primary Owner */
        <div className="flex flex-col gap-3">
          {removeError && (
            <div className="p-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-xs text-[#b91c1c]">
              {removeError}
            </div>
          )}

          {ownerships.length === 0 ? (
            <div className="py-4 text-center border border-dashed border-[#a1a1aa] rounded-[4px]">
              <div className="text-[12px] text-[#52525b]">No co-owners yet</div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#f4f4f5] border border-[#a1a1aa] rounded-[4px] bg-white overflow-hidden">
              {ownerships.map((o) => {
                const targetUserId = o.sharedWith.id;
                const initials = getInitials(o.sharedWith.name);
                const isConfirming = confirmUserId === targetUserId;
                const isRemoving = removingUserId === targetUserId;

                return (
                  <div key={o.id} className="p-3 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#0d0d0d] text-white flex items-center justify-center text-[9px] font-semibold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[#0d0d0d] truncate">
                          {o.sharedWith.name}
                        </div>
                        <div className="text-[10px] text-[#52525b] truncate">
                          {o.sharedWith.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase font-semibold mono text-[#71717a] bg-[#f4f4f5] px-1.5 py-0.5 rounded">
                        Viewer
                      </span>

                      {!isConfirming ? (
                        <button
                          onClick={() => {
                            setConfirmUserId(targetUserId);
                            setRemoveError(null);
                          }}
                          className="text-[11px] text-[#b91c1c] hover:text-[#991b1b] p-1 rounded hover:bg-[#fef2f2] transition-colors"
                          title="Revoke access"
                        >
                          <TrashIcon />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemove(targetUserId)}
                            disabled={isRemoving}
                            className="text-[10px] font-medium text-white bg-[#dc2626] px-1.5 py-0.5 rounded hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
                          >
                            {isRemoving ? "…" : "Remove"}
                          </button>
                          <button
                            onClick={() => setConfirmUserId(null)}
                            disabled={isRemoving}
                            className="text-[10px] text-[#71717a] border border-[#a1a1aa] px-1.5 py-0.5 rounded hover:bg-[#f4f4f5]"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#3f3f46] border border-[#a1a1aa] px-3 py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Share Product
          </button>
        </div>
      )}

      {modalOpen && (
        <ShareModal
          productId={productId}
          onClose={() => setModalOpen(false)}
          onShared={() => {
            setModalOpen(false);
            onRefresh();
          }}
        />
      )}
    </Section>
  );
}

/* ── Share Modal (Integrated with API & Duplicate Prevention) ── */
function ShareModal({
  productId,
  onClose,
  onShared,
}: {
  productId: string;
  onClose: () => void;
  onShared: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError("");
    setApiError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await shareProduct(productId, trimmed);
      onShared();
    } catch (err: any) {
      const msg =
        err instanceof ApiError && err.status === 404
          ? "User with this email does not exist."
          : err instanceof ApiError && err.status === 409
            ? "Product is already shared with this user."
            : err instanceof ApiError && err.status === 400
              ? err.message || "Cannot share product with this email."
              : err?.message || "Failed to share product.";
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-[#a1a1aa] rounded-[4px] shadow-xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#a1a1aa]">
            <div className="text-[13px] font-semibold text-[#0d0d0d]">Share Product</div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="w-7 h-7 flex items-center justify-center rounded-[4px] hover:bg-[#f4f4f5] text-[#71717a] hover:text-[#0d0d0d] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-5">
            {apiError && (
              <div className="mb-4 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-xs text-[#b91c1c]">
                {apiError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1.5">
                Email Address <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="email"
                value={email}
                disabled={submitting}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError("");
                  setApiError(null);
                }}
                placeholder="colleague@example.com"
                autoFocus
                className={`w-full text-[13px] border rounded-[4px] px-3 py-2 focus:outline-none transition-colors placeholder:text-[#71717a] disabled:bg-[#f4f4f5] ${fieldError
                  ? "border-[#fca5a5] bg-[#fff8f8] focus:border-[#dc2626]"
                  : "border-[#a1a1aa] bg-white focus:border-[#52525b]"
                  }`}
              />
              {fieldError && (
                <div className="flex items-center gap-1 mt-1.5">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="#dc2626" strokeWidth="1.2" />
                    <path d="M6 3.5v3" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="6" cy="8.5" r="0.6" fill="#dc2626" />
                  </svg>
                  <span className="text-[11px] text-[#b91c1c]">{fieldError}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 bg-[#f9f9f9] border border-[#a1a1aa] rounded-[4px] mb-5">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                <circle cx="7" cy="7" r="5.5" stroke="#52525b" strokeWidth="1.3" />
                <path d="M7 6v4" stroke="#52525b" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="7" cy="4.5" r="0.7" fill="#52525b" />
              </svg>
              <p className="text-[11px] text-[#71717a] leading-relaxed">
                This person will be able to <strong className="text-[#52525b]">view</strong> the product, preview receipts, and download documentation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#0d0d0d] text-white text-sm font-medium py-2 rounded-[4px] hover:bg-[#262626] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Sharing…</span>
                  </>
                ) : (
                  "Send Invite"
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ── Shared primitives ── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-[#a1a1aa] rounded-[4px] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#a1a1aa] bg-[#f9f9f9]">
        <h3 className="text-[11px] font-semibold text-[#52525b] mono uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-[13px] text-[#0d0d0d] ${mono ? "mono" : ""} ${valueColor ?? ""}`}>{value}</div>
    </div>
  );
}

function CategoryThumb({ category, large }: { category: string; large?: boolean }) {
  const colorMap: Record<string, string> = {
    "TV & Display": "bg-[#eff6ff] text-[#3b82f6]",
    Laptop: "bg-[#f5f3ff] text-[#8b5cf6]",
    Headphones: "bg-[#fdf4ff] text-[#c026d3]",
    Storage: "bg-[#fff7ed] text-[#ea580c]",
    Appliances: "bg-[#f0fdf4] text-[#16a34a]",
    Peripherals: "bg-[#f0f9ff] text-[#0284c7]",
    Tablet: "bg-[#fef9c3] text-[#a16207]",
    Camera: "bg-[#fef2f2] text-[#dc2626]",
  };
  const cls = colorMap[category] ?? "bg-[#f4f4f5] text-[#71717a]";
  const size = large ? "w-12 h-12 text-[13px]" : "w-8 h-8 text-[10px]";
  return (
    <div className={`${size} rounded-[4px] flex items-center justify-center shrink-0 font-bold mono ${cls}`}>
      {category.slice(0, 2).toUpperCase()}
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M5 4V2.5h4V4M5.5 4v6.5M8.5 4v6.5M3 4l.5 8h7l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 1h10v14l-2-1.5L9 15l-1-1.5L7 15l-2-1.5L3 15V1z" stroke="#52525b" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 5h4M6 8h4M6 11h2" stroke="#52525b" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
