import { useState, useEffect, useCallback, type ReactNode } from "react";
import StatusBadge from "../components/StatusBadge";
import { listProducts, deleteProduct } from "../api/products";
import type { ProductResponse } from "../api/products";
import { ApiError } from "../api/client";
import type { AppRoute, WarrantyStatus } from "../types";
import { formatDate, getDaysRemaining, formatDaysRemaining } from "../utils/date";

const CATEGORIES = [
  "All Categories",
  "TV & Display",
  "Laptop",
  "Headphones",
  "Storage",
  "Appliances",
  "Peripherals",
  "Tablet",
  "Camera",
  "Other",
];

const STATUS_OPTIONS: { value: "all" | WarrantyStatus; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Recently Added" },
  { value: "expiry_asc", label: "Expiry: Soonest" },
  { value: "expiry_desc", label: "Expiry: Latest" },
  { value: "name_asc", label: "Name: A–Z" },
];

const PAGE_SIZE = 8;

// Category icon backgrounds
const categoryColor: Record<string, string> = {
  "TV & Display": "bg-[#eff6ff] text-[#3b82f6]",
  "Laptop": "bg-[#f5f3ff] text-[#8b5cf6]",
  "Headphones": "bg-[#fdf4ff] text-[#c026d3]",
  "Storage": "bg-[#fff7ed] text-[#ea580c]",
  "Appliances": "bg-[#f0fdf4] text-[#16a34a]",
  "Peripherals": "bg-[#f0f9ff] text-[#0284c7]",
  "Tablet": "bg-[#fef9c3] text-[#a16207]",
  "Camera": "bg-[#fef2f2] text-[#dc2626]",
};

function CategoryInitial({ category }: { category: string }) {
  const cls = categoryColor[category] ?? "bg-[#f4f4f5] text-[#71717a]";
  return (
    <div className={`w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 text-[11px] font-bold mono ${cls}`}>
      {(category ?? "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Products({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  const [allProducts, setAllProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState<"all" | WarrantyStatus>("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError(null);
    listProducts()
      .then((data) => {
        setAllProducts(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load products.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filter
  const filtered = allProducts.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      q === "" ||
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q);
    const matchCategory = category === "All Categories" || p.category === category;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "expiry_asc") return new Date(a.warrantyExpiry).getTime() - new Date(b.warrantyExpiry).getTime();
    if (sort === "expiry_desc") return new Date(b.warrantyExpiry).getTime() - new Date(a.warrantyExpiry).getTime();
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    // "recent" — by createdAt desc (backend creates ISO timestamp)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = search.trim() !== "" || category !== "All Categories" || statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCategory("All Categories");
    setStatusFilter("all");
    setPage(1);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleCategoryChange(v: string) {
    setCategory(v);
    setPage(1);
  }

  function handleStatusChange(v: "all" | WarrantyStatus) {
    setStatusFilter(v);
    setPage(1);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    setConfirmDeleteId(null);
    setOpenMenuId(null);
    try {
      await deleteProduct(id);
      setAllProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      const msg =
        err instanceof ApiError && err.status === 403
          ? "Only the product owner can delete it."
          : err?.message || "Failed to delete product.";
      setDeleteError(msg);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c] mb-5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
          </svg>
          {error}
          <button onClick={fetchProducts} className="ml-auto text-xs font-medium text-[#b91c1c] underline underline-offset-2">Retry</button>
        </div>
      </PageShell>
    );
  }

  if (allProducts.length === 0) {
    return (
      <PageShell>
        <EmptyNoProducts onNavigate={onNavigate} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Products</h2>
          <p className="text-sm text-[#71717a] mt-1">
            Manage your saved products, receipts, and warranty coverage.
          </p>
        </div>
        <button
          onClick={() => onNavigate({ page: "add-product" })}
          className="flex items-center gap-2 bg-[#0d0d0d] text-white text-sm font-medium px-4 py-2 rounded-[4px] hover:bg-[#262626] active:bg-[#1a1a1a] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c] mb-4">
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

      {/* Filter bar */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#52525b" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-sm bg-white border border-[#a1a1aa] rounded-[4px] w-56 focus:outline-none focus:border-[#52525b] transition-colors placeholder:text-[#52525b]"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#71717a]"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Category */}
        <FilterSelect
          value={category}
          onChange={handleCategoryChange}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

        {/* Status */}
        <FilterSelect
          value={statusFilter}
          onChange={(v) => handleStatusChange(v as "all" | WarrantyStatus)}
          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        />

        {/* Divider */}
        <div className="w-px h-5 bg-[#a1a1aa] mx-0.5" />

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#52525b] font-medium mono uppercase tracking-wide">Sort</span>
          <FilterSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#0d0d0d] transition-colors ml-1"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Clear filters
          </button>
        )}

        {/* Result count */}
        <span className="text-[11px] text-[#52525b] mono ml-auto">
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </span>
      </div>

      {/* Table */}
      <div className="border border-[#a1a1aa] rounded-[4px] overflow-hidden bg-white mb-5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#a1a1aa] bg-[#f9f9f9]">
              <Th wide>Product</Th>
              <Th>Category</Th>
              <Th>Purchase Date</Th>
              <Th>Warranty Expiry</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyFiltered onClear={clearFilters} />
                </td>
              </tr>
            ) : (
              paginated.map((product, i) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  last={i === paginated.length - 1}
                  menuOpen={openMenuId === product.id}
                  confirmingDelete={confirmDeleteId === product.id}
                  deleting={deletingId === product.id}
                  onMenuToggle={() => setOpenMenuId(openMenuId === product.id ? null : product.id)}
                  onMenuClose={() => setOpenMenuId(null)}
                  onView={() => onNavigate({ page: "product-detail", productId: product.id })}
                  onDeleteRequest={() => { setConfirmDeleteId(product.id); setOpenMenuId(null); }}
                  onDeleteConfirm={() => handleDelete(product.id)}
                  onDeleteCancel={() => setConfirmDeleteId(null)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination current={currentPage} total={totalPages} onChange={setPage} />
      )}

      {/* Delete confirm overlay — click away to cancel */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-40" onClick={() => setConfirmDeleteId(null)} />
      )}
    </PageShell>
  );
}

/* ---- Loading skeleton ---- */
function LoadingState() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-5 w-20 bg-[#a1a1aa] rounded mb-2" />
          <div className="h-3.5 w-72 bg-[#f4f4f5] rounded" />
        </div>
        <div className="h-8 w-28 bg-[#a1a1aa] rounded-[4px]" />
      </div>
      <div className="h-9 bg-[#f4f4f5] rounded mb-5" />
      <div className="bg-white border border-[#a1a1aa] rounded-[4px] overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-b border-[#f4f4f5] px-5 py-3.5 flex items-center gap-4 last:border-0">
            <div className="w-8 h-8 bg-[#f4f4f5] rounded-[4px]" />
            <div className="flex-1">
              <div className="h-3.5 w-40 bg-[#a1a1aa] rounded mb-1.5" />
              <div className="h-3 w-20 bg-[#f4f4f5] rounded" />
            </div>
            <div className="h-3.5 w-24 bg-[#f4f4f5] rounded" />
            <div className="h-3.5 w-24 bg-[#f4f4f5] rounded" />
            <div className="h-5 w-16 bg-[#f4f4f5] rounded-full" />
            <div className="h-6 w-16 bg-[#f4f4f5] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Layout wrapper ---- */
function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {children}
    </div>
  );
}

/* ---- Table header cell ---- */
function Th({ children, wide, align }: { children: ReactNode; wide?: boolean; align?: "right" }) {
  return (
    <th
      className={`text-[10px] font-semibold text-[#52525b] px-5 py-2.5 mono uppercase tracking-wider whitespace-nowrap ${wide ? "w-[30%]" : ""
        } ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

/* ---- Filter select ---- */
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
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/* ---- Product row ---- */
function ProductRow({
  product,
  last,
  menuOpen,
  confirmingDelete,
  deleting,
  onMenuToggle,
  onMenuClose,
  onView,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  product: ProductResponse;
  last: boolean;
  menuOpen: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onView: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const days = getDaysRemaining(product.warrantyExpiry);

  return (
    <tr
      className={`${!last ? "border-b border-[#f4f4f5]" : ""} hover:bg-[#fafafa] transition-colors ${deleting ? "opacity-50 pointer-events-none" : ""}`}
      onClick={() => { if (menuOpen) onMenuClose(); }}
    >
      {/* Product */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <CategoryInitial category={product.category ?? "?"} />
          <div>
            <div className="font-medium text-[#0d0d0d] text-[13px] leading-snug">{product.name}</div>
            <div className="text-[11px] text-[#52525b] mt-0.5">{product.brand}</div>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-5 py-3.5 text-[13px] text-[#52525b]">{product.category ?? "—"}</td>

      {/* Purchase Date */}
      <td className="px-5 py-3.5">
        <span className="mono text-[13px] text-[#52525b]">{formatDate(product.purchaseDate)}</span>
      </td>

      {/* Warranty Expiry */}
      <td className="px-5 py-3.5">
        <div className="mono text-[13px] text-[#52525b]">{formatDate(product.warrantyExpiry)}</div>
        <div
          className={`text-[11px] mono mt-0.5 ${days < 0
            ? "text-[#b91c1c]"
            : days < 30
              ? "text-[#b91c1c]"
              : days < 90
                ? "text-[#b45309]"
                : "text-[#52525b]"
            }`}
        >
          {formatDaysRemaining(days)}
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <StatusBadge status={product.status} size="sm" />
      </td>

      {/* Actions */}
      <td className="px-5 py-3.5 text-right">
        {confirmingDelete ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] text-[#71717a]">Delete?</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteConfirm(); }}
              className="text-[11px] font-medium text-[#b91c1c] hover:underline underline-offset-2"
            >
              Yes
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
              className="text-[11px] font-medium text-[#71717a] hover:underline underline-offset-2"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              className="text-[12px] font-medium text-[#52525b] hover:text-[#0d0d0d] transition-colors px-2 py-1 rounded-[3px] hover:bg-[#f4f4f5]"
              onClick={(e) => { e.stopPropagation(); onView(); }}
            >
              View
            </button>
            <div className="relative">
              <button
                className={`p-1.5 rounded-[3px] transition-colors ${menuOpen ? "bg-[#f4f4f5] text-[#0d0d0d]" : "text-[#52525b] hover:text-[#52525b] hover:bg-[#f4f4f5]"}`}
                onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
                aria-label="More actions"
              >
                <DotsIcon />
              </button>
              {menuOpen && (
                <ActionMenu
                  onClose={onMenuClose}
                  onView={onView}
                  onEdit={() => { onMenuClose(); onView(); }}
                  onDelete={() => { onMenuClose(); onDeleteRequest(); }}
                />
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

/* ---- Action dropdown menu ---- */
function ActionMenu({
  onClose,
  onView,
  onEdit,
  onDelete,
}: {
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-8 w-36 bg-white border border-[#a1a1aa] rounded-[4px] shadow-md z-20 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem label="View" icon={<ViewIcon />} onClick={onView} />
      <MenuItem label="Edit" icon={<EditIcon />} onClick={onEdit} />
      <div className="my-1 border-t border-[#f4f4f5]" />
      <MenuItem label="Delete" icon={<DeleteIcon />} onClick={onDelete} danger />
    </div>
  );
}

function MenuItem({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left ${danger
        ? "text-[#b91c1c] hover:bg-[#fef2f2]"
        : "text-[#3f3f46] hover:bg-[#f9f9f9] hover:text-[#0d0d0d]"
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---- Pagination ---- */
function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("…");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#52525b] mono">
        Page {current} of {total}
      </span>
      <div className="flex items-center gap-1">
        <PaginationBtn onClick={() => onChange(current - 1)} disabled={current === 1}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Prev
        </PaginationBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-[13px] text-[#52525b]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`w-8 h-8 rounded-[4px] text-[13px] font-medium transition-colors ${p === current
                ? "bg-[#0d0d0d] text-white"
                : "text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#0d0d0d]"
                }`}
            >
              {p}
            </button>
          )
        )}
        <PaginationBtn onClick={() => onChange(current + 1)} disabled={current === total}>
          Next
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5 2.5L8.5 6.5L5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PaginationBtn>
      </div>
    </div>
  );
}

function PaginationBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-2.5 h-8 rounded-[4px] text-[13px] font-medium text-[#52525b] border border-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0d0d0d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

/* ---- Empty: no products at all ---- */
function EmptyNoProducts({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="16" rx="1.5" stroke="#52525b" strokeWidth="1.5" />
          <path d="M7 5V4a5 5 0 0110 0v1" stroke="#52525b" strokeWidth="1.5" />
          <path d="M9 13h6M12 10v6" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-[#0d0d0d] mb-1">No products yet</h3>
      <p className="text-sm text-[#71717a] max-w-xs leading-relaxed mb-5">
        Add your first product to start tracking warranties and receipts. You&apos;ll get notified before any coverage lapses.
      </p>
      <button
        onClick={() => onNavigate({ page: "add-product" })}
        className="flex items-center gap-2 bg-[#0d0d0d] text-white text-sm font-medium px-4 py-2 rounded-[4px] hover:bg-[#262626] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Add Product
      </button>
    </div>
  );
}

/* ---- Empty: filters active, no results ---- */
function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <div className="w-10 h-10 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mb-3">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="7" stroke="#52525b" strokeWidth="1.5" />
          <path d="M13 13L18 18" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 9h4M9 7v4" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[13px] font-semibold text-[#0d0d0d] mb-1">No products found</div>
      <p className="text-[12px] text-[#71717a] mb-4">
        No products match your current search or filters.
      </p>
      <button
        onClick={onClear}
        className="text-sm font-medium text-[#0d0d0d] border border-[#a1a1aa] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
      >
        Clear all filters
      </button>
    </div>
  );
}

/* ---- Icons ---- */
function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M5 4V2.5h4V4M5.5 4v6.5M8.5 4v6.5M3 4l.5 8h7l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
