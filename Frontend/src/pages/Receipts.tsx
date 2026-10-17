import { useState, useEffect, type ReactNode } from "react";
import { searchProducts } from "../api/products";
import {
  getReceipt,
  downloadReceipt,
  getReceiptBlobUrl,
  formatFileSize,
  deriveFileType,
} from "../api/receipts";
import { formatDate } from "../utils/date";

export interface ReceiptItem {
  id: string;
  filename: string;
  fileType: "PDF" | "JPG" | "PNG" | "WEBP";
  fileSize: string;
  productId: string;
  productName: string;
  category: string;
  purchaseDate: string;
  store: string;
  uploadDate: string;
  mimeType: string;
}

const CATEGORIES = [
  "All Categories",
  "TV & Display",
  "Laptop",
  "Tablet",
  "Headphones",
  "Storage",
  "Appliances",
  "Peripherals",
  "Camera",
  "Other",
];

const PAGE_SIZE = 100;

export default function Receipts() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state (account for 100-product backend limit)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [viewing, setViewing] = useState<ReceiptItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    searchProducts({ hasReceipt: "true", page, limit: PAGE_SIZE })
      .then(async (res) => {
        if (cancelled) return;

        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);

        if (res.products.length === 0) {
          setReceipts([]);
          setLoading(false);
          return;
        }

        // Concurrently fetch metadata for each product that has a receipt
        const settled = await Promise.allSettled(
          res.products.map(async (p) => {
            const meta = await getReceipt(p.id);
            return {
              id: meta.id,
              filename: meta.originalName,
              fileType: deriveFileType(meta.mimeType, meta.originalName),
              fileSize: formatFileSize(meta.fileSize),
              productId: p.id,
              productName: p.name,
              category: p.category || "Other",
              purchaseDate: p.purchaseDate,
              store: p.retailer || "—",
              uploadDate: meta.uploadedAt,
              mimeType: meta.mimeType,
            } as ReceiptItem;
          })
        );

        if (cancelled) return;

        const loadedReceipts: ReceiptItem[] = [];
        for (const item of settled) {
          if (item.status === "fulfilled") {
            loadedReceipts.push(item.value);
          }
        }

        setReceipts(loadedReceipts);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load receipts.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.productName.toLowerCase().includes(q) ||
      r.filename.toLowerCase().includes(q) ||
      r.store.toLowerCase().includes(q);
    const matchCat = category === "All Categories" || r.category === category;
    return matchSearch && matchCat;
  });

  const hasFilters = search.trim() !== "" || category !== "All Categories";

  async function handleDownload(receipt: ReceiptItem) {
    setDownloadingId(receipt.id);
    setDownloadError(null);
    try {
      await downloadReceipt(receipt.productId, receipt.filename);
    } catch (err: any) {
      setDownloadError(err?.message || "Failed to download receipt.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader />
        <LoadingState />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader />
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c] mb-5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
          </svg>
          {error}
        </div>
      </PageShell>
    );
  }

  if (receipts.length === 0 && !hasFilters) {
    return (
      <PageShell>
        <PageHeader />
        <EmptyNoReceipts />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader />

      {downloadError && (
        <div className="mb-4 text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] p-2.5 rounded-[4px] flex items-center justify-between">
          <span>{downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="text-[#b91c1c] font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search receipts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-sm bg-white border border-[#a1a1aa] rounded-[4px] w-56 focus:outline-none focus:border-[#52525b] transition-colors placeholder:text-[#52525b]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#71717a]"
            >
              <XIcon />
            </button>
          )}
        </div>

        <FilterSelect
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              setCategory("All Categories");
            }}
            className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#0d0d0d] transition-colors"
          >
            <XIcon /> Clear filters
          </button>
        )}

        <span className="text-[11px] text-[#52525b] mono ml-auto">
          {filtered.length} {filtered.length === 1 ? "receipt" : "receipts"}
          {totalCount > PAGE_SIZE && ` (showing page ${page} of ${totalPages})`}
        </span>
      </div>

      {/* Table */}
      <div className="border border-[#a1a1aa] rounded-[4px] overflow-hidden bg-white mb-5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#a1a1aa] bg-[#f9f9f9]">
              <Th wide>Receipt</Th>
              <Th>Product</Th>
              <Th>Purchase Date</Th>
              <Th>Store</Th>
              <Th>Type</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center py-14 text-center px-8">
                    <div className="text-[13px] font-semibold text-[#0d0d0d] mb-1">No receipts found</div>
                    <p className="text-[12px] text-[#71717a] mb-4">
                      No receipts match your current search or filters.
                    </p>
                    <button
                      onClick={() => {
                        setSearch("");
                        setCategory("All Categories");
                      }}
                      className="text-sm font-medium text-[#0d0d0d] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <ReceiptRow
                  key={r.id}
                  receipt={r}
                  last={i === filtered.length - 1}
                  onView={() => setViewing(r)}
                  onDownload={() => handleDownload(r)}
                  downloading={downloadingId === r.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Multi-page pagination when total products with receipts exceed 100 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#a1a1aa] pt-4">
          <div className="text-xs text-[#71717a]">
            Page {page} of {totalPages} ({totalCount} total receipts)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-xs font-medium px-3 py-1.5 border border-[#a1a1aa] rounded-[4px] hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-xs font-medium px-3 py-1.5 border border-[#a1a1aa] rounded-[4px] hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Receipt viewer slide-over modal */}
      {viewing && (
        <ReceiptViewer
          receipt={viewing}
          onClose={() => setViewing(null)}
          onDownload={() => handleDownload(viewing)}
          downloading={downloadingId === viewing.id}
        />
      )}
    </PageShell>
  );
}

function ReceiptRow({
  receipt: r,
  last,
  onView,
  onDownload,
  downloading,
}: {
  receipt: ReceiptItem;
  last: boolean;
  onView: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <tr className={`${!last ? "border-b border-[#f4f4f5]" : ""} hover:bg-[#fafafa] transition-colors`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <FileThumb type={r.fileType} />
          <div>
            <div className="text-[13px] font-medium text-[#0d0d0d]">{r.filename}</div>
            <div className="text-[11px] text-[#52525b] mono mt-0.5">
              {r.fileSize} · Uploaded {formatDate(r.uploadDate)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="text-[13px] text-[#0d0d0d]">{r.productName}</div>
        <div className="text-[11px] text-[#52525b] mt-0.5">{r.category}</div>
      </td>
      <td className="px-5 py-3.5 mono text-[13px] text-[#52525b]">{formatDate(r.purchaseDate)}</td>
      <td className="px-5 py-3.5 text-[13px] text-[#52525b]">{r.store}</td>
      <td className="px-5 py-3.5">
        <span className="mono text-[10px] font-semibold px-2 py-0.5 rounded-[3px] bg-[#f4f4f5] text-[#71717a]">
          {r.fileType}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onView}
            className="text-[12px] font-medium text-[#52525b] hover:text-[#0d0d0d] transition-colors hover:underline underline-offset-2"
          >
            View
          </button>
          <button
            onClick={onDownload}
            disabled={downloading}
            className="text-[12px] font-medium text-[#52525b] hover:text-[#0d0d0d] transition-colors hover:underline underline-offset-2 disabled:opacity-50"
          >
            {downloading ? "Downloading..." : "Download"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function ReceiptViewer({
  receipt: r,
  onClose,
  onDownload,
  downloading,
}: {
  receipt: ReceiptItem;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [preview, setPreview] = useState<{ url: string; mimeType: string; cleanup: () => void } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getReceiptBlobUrl(r.productId)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setLoading(false);
        } else {
          data.cleanup();
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load receipt preview.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [r.productId]);

  // Clean up Blob URL when viewer closes or unmounts
  useEffect(() => {
    return () => {
      if (preview) {
        preview.cleanup();
      }
    };
  }, [preview]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l border-[#a1a1aa] z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#a1a1aa] shrink-0">
          <div>
            <div className="text-[13px] font-semibold text-[#0d0d0d]">Receipt</div>
            <div className="text-[11px] text-[#52525b] mono mt-0.5">{r.filename}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[4px] hover:bg-[#f4f4f5] text-[#71717a] hover:text-[#0d0d0d] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-5 mt-5 h-72 bg-[#f9f9f9] border border-[#a1a1aa] rounded-[4px] flex flex-col items-center justify-center overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-xs text-[#71717a]">
                <svg className="animate-spin h-5 w-5 text-[#0d0d0d]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Loading preview...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-xs text-[#b91c1c]">{error}</div>
            ) : preview ? (
              preview.mimeType.startsWith("image/") ? (
                <img
                  src={preview.url}
                  alt={r.filename}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <iframe
                  src={preview.url}
                  title={r.filename}
                  className="w-full h-full border-0 bg-white"
                />
              )
            ) : (
              <span className="text-[12px] text-[#52525b]">{r.fileType} preview</span>
            )}
          </div>

          {/* Metadata */}
          <div className="px-5 py-5">
            <div className="text-[10px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-3">
              Details
            </div>
            <div className="flex flex-col gap-3.5">
              <MetaRow label="Product" value={r.productName} />
              <MetaRow label="Purchase Date" value={formatDate(r.purchaseDate)} mono />
              <MetaRow label="Store" value={r.store} />
              <MetaRow label="File" value={`${r.fileType} · ${r.fileSize}`} mono />
              <MetaRow label="Uploaded" value={formatDate(r.uploadDate)} mono />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-[#a1a1aa] flex items-center gap-2 shrink-0">
          <button
            onClick={onDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 flex-1 justify-center text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] px-3 py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v8M4 6l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {downloading ? "Downloading..." : "Download"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] px-3 py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-[#52525b] mono uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-[13px] text-[#0d0d0d] ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}

function FileThumb({ type }: { type: string }) {
  const color =
    type === "PDF"
      ? "bg-[#fef2f2] text-[#b91c1c]"
      : type === "JPG"
        ? "bg-[#eff6ff] text-[#3b82f6]"
        : "bg-[#f0fdf4] text-[#16a34a]";
  return (
    <div
      className={`w-8 h-9 rounded-[3px] border border-[#a1a1aa] flex items-center justify-center shrink-0 ${color}`}
    >
      <span className="text-[9px] font-bold mono">{type}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="border border-[#a1a1aa] rounded-[4px] overflow-hidden bg-white p-8 animate-pulse">
      <div className="h-5 w-48 bg-[#a1a1aa] rounded mb-4" />
      <div className="space-y-3">
        <div className="h-12 bg-[#f4f4f5] rounded" />
        <div className="h-12 bg-[#f4f4f5] rounded" />
        <div className="h-12 bg-[#f4f4f5] rounded" />
      </div>
    </div>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 max-w-[1100px] mx-auto">{children}</div>;
}

function PageHeader() {
  return (
    <div className="mb-6">
      <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">
        Receipts
      </h2>
      <p className="text-sm text-[#71717a] mt-1">
        All receipts and proof-of-purchase documents attached to your products.
      </p>
    </div>
  );
}

function Th({
  children,
  wide,
  align,
}: {
  children: ReactNode;
  wide?: boolean;
  align?: "right";
}) {
  return (
    <th
      className={`text-[10px] font-semibold text-[#52525b] px-5 py-2.5 mono uppercase tracking-wider whitespace-nowrap ${wide ? "w-[30%]" : ""
        } ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-[#a1a1aa] rounded-[4px] pl-3 pr-7 py-1.5 text-sm text-[#3f3f46] focus:outline-none focus:border-[#52525b] transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="#52525b"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function EmptyNoReceipts() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-[#a1a1aa] rounded-[4px] bg-white">
      <div className="w-10 h-10 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mb-3">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M4 2h8l5 5v12H4V2z" stroke="#52525b" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M12 2v5h5" stroke="#52525b" strokeWidth="1.3" />
          <path d="M7 10h6M7 13h6M7 16h3" stroke="#52525b" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[13px] font-semibold text-[#0d0d0d] mb-1">No receipts yet</div>
      <p className="text-[12px] text-[#71717a] max-w-xs leading-relaxed">
        Upload receipts when adding or viewing a product. They&apos;ll appear here for easy access.
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#52525b" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
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
