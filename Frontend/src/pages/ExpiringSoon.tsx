import { useState, useEffect, type ReactNode } from "react";
import StatusBadge from "../components/StatusBadge";
import { getExpiringProducts } from "../api/products";
import type { ProductItem } from "../api/products";
import type { AppRoute } from "../types";
import { formatDate, getDaysRemaining, formatDaysRemaining } from "../utils/date";

const PERIOD_OPTIONS = [
  { value: "all", label: "Any Time" },
  { value: "30", label: "Within 30 days" },
  { value: "60", label: "Within 60 days" },
  { value: "90", label: "Within 90 days" },
  { value: "180", label: "Within 6 months" },
];

const SORT_OPTIONS = [
  { value: "expiry_asc", label: "Expiry: Soonest" },
  { value: "expiry_desc", label: "Expiry: Latest" },
  { value: "name_asc", label: "Name: A–Z" },
];

export default function ExpiringSoon({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  const [allExpiring, setAllExpiring] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("expiry_asc");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getExpiringProducts()
      .then(({ products }) => {
        if (!cancelled) {
          setAllExpiring(products);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load expiring products.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Dynamic category list from loaded data
  const categories = ["All Categories", ...Array.from(new Set(allExpiring.map((p) => p.category ?? "Other")))];

  const filtered = allExpiring.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || p.name.toLowerCase().includes(q)
      || (p.brand ?? "").toLowerCase().includes(q)
      || (p.category ?? "").toLowerCase().includes(q);
    const matchCat = category === "All Categories" || p.category === category;
    const days = getDaysRemaining(p.warrantyExpiry);
    const matchPeriod = period === "all" || days <= parseInt(period);
    return matchSearch && matchCat && matchPeriod;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "expiry_desc") return new Date(b.warrantyExpiry).getTime() - new Date(a.warrantyExpiry).getTime();
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    return new Date(a.warrantyExpiry).getTime() - new Date(b.warrantyExpiry).getTime();
  });

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
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c]">
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

  return (
    <PageShell>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Expiring Soon</h2>
          <p className="text-sm text-[#71717a] mt-1">
            Products whose warranties expire within the next 180 days.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fffbeb] border border-[#fde68a] rounded-[4px]">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#b45309" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#b45309" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#b45309" />
          </svg>
          <span className="text-[11px] font-semibold mono text-[#b45309]">{allExpiring.length} expiring</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#a1a1aa" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-white border border-[#e4e4e7] rounded-[4px] w-48 focus:outline-none focus:border-[#a1a1aa] transition-colors placeholder:text-[#a1a1aa]"
          />
        </div>

        {/* Category */}
        <FilterSelect
          value={category}
          onChange={setCategory}
          options={categories.map((c) => ({ value: c, label: c }))}
        />

        {/* Period */}
        <FilterSelect
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />

        {/* Divider */}
        <div className="w-px h-5 bg-[#e4e4e7] mx-0.5" />

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#a1a1aa] font-medium mono uppercase tracking-wide">Sort</span>
          <FilterSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />
        </div>

        <span className="text-[11px] text-[#a1a1aa] mono ml-auto">
          {sorted.length} {sorted.length === 1 ? "product" : "products"}
        </span>
      </div>

      {/* Content */}
      {allExpiring.length === 0 ? (
        <EmptyNoExpiring />
      ) : sorted.length === 0 ? (
        <EmptyFiltered onClear={() => { setSearch(""); setCategory("All Categories"); setPeriod("all"); }} />
      ) : (
        <div className="border border-[#e4e4e7] rounded-[4px] overflow-hidden bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#f9f9f9]">
                <Th wide>Product</Th>
                <Th>Category</Th>
                <Th>Expiry Date</Th>
                <Th>Remaining</Th>
                <Th>Receipt</Th>
                <Th>Status</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((product, i) => (
                <ExpiringRow
                  key={product.id}
                  product={product}
                  last={i === sorted.length - 1}
                  onNavigate={onNavigate}
                />
              ))}
            </tbody>
          </table>
        </div>
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
          <div className="h-5 w-32 bg-[#e4e4e7] rounded mb-2" />
          <div className="h-3.5 w-64 bg-[#f4f4f5] rounded" />
        </div>
        <div className="h-7 w-24 bg-[#fde68a] rounded-[4px]" />
      </div>
      <div className="h-9 bg-[#f4f4f5] rounded mb-5" />
      <div className="bg-white border border-[#e4e4e7] rounded-[4px] overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-b border-[#f4f4f5] px-5 py-3.5 flex items-center gap-4 last:border-0">
            <div className="w-8 h-8 bg-[#f4f4f5] rounded-[4px]" />
            <div className="flex-1">
              <div className="h-3.5 w-40 bg-[#e4e4e7] rounded mb-1.5" />
              <div className="h-3 w-20 bg-[#f4f4f5] rounded" />
            </div>
            <div className="h-3.5 w-24 bg-[#f4f4f5] rounded" />
            <div className="h-5 w-16 bg-[#fde68a] rounded-full" />
            <div className="h-6 w-14 bg-[#f4f4f5] rounded" />
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
      className={`text-[10px] font-semibold text-[#a1a1aa] px-5 py-2.5 mono uppercase tracking-wider whitespace-nowrap ${
        wide ? "w-[28%]" : ""
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
        className="appearance-none bg-white border border-[#e4e4e7] rounded-[4px] pl-3 pr-7 py-1.5 text-sm text-[#3f3f46] focus:outline-none focus:border-[#a1a1aa] transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/* ---- Expiring product row ---- */
function ExpiringRow({
  product,
  last,
  onNavigate,
}: {
  product: ProductItem;
  last: boolean;
  onNavigate: (r: AppRoute) => void;
}) {
  const days = getDaysRemaining(product.warrantyExpiry);
  const urgencyColor =
    days < 30 ? "text-[#b91c1c]" : days < 90 ? "text-[#b45309]" : "text-[#52525b]";

  return (
    <tr
      className={`${!last ? "border-b border-[#f4f4f5]" : ""} hover:bg-[#fafafa] transition-colors cursor-pointer`}
      onClick={() => onNavigate({ page: "product-detail", productId: product.id })}
    >
      {/* Product */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {product.isShared && (
            <span title="Shared with you" className="text-[9px] font-semibold mono px-1.5 py-0.5 rounded-[3px] bg-[#eff6ff] text-[#3b82f6] shrink-0">
              SHARED
            </span>
          )}
          <div>
            <div className="font-medium text-[#0d0d0d] text-[13px]">{product.name}</div>
            <div className="text-[11px] text-[#a1a1aa] mt-0.5">{product.brand}</div>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-5 py-3.5">
        <span className="text-[13px] text-[#52525b]">{product.category ?? "—"}</span>
      </td>

      {/* Expiry Date */}
      <td className="px-5 py-3.5">
        <span className="mono text-[13px] text-[#52525b]">{formatDate(product.warrantyExpiry)}</span>
      </td>

      {/* Remaining */}
      <td className="px-5 py-3.5">
        <span className={`mono text-[13px] font-medium ${urgencyColor}`}>
          {formatDaysRemaining(days)}
        </span>
      </td>

      {/* Receipt */}
      <td className="px-5 py-3.5">
        {product.hasReceipt ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#15803d] font-medium">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Available
          </span>
        ) : (
          <span className="text-[12px] text-[#a1a1aa]">Not uploaded</span>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <StatusBadge status={product.status} size="sm" />
      </td>

      {/* View */}
      <td className="px-5 py-3.5 text-right">
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate({ page: "product-detail", productId: product.id }); }}
          className="text-[12px] font-medium text-[#52525b] hover:text-[#0d0d0d] hover:underline underline-offset-2 transition-colors"
        >
          View
        </button>
      </td>
    </tr>
  );
}

/* ---- Empty states ---- */
function EmptyNoExpiring() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 bg-[#f0fdf4] rounded-[4px] flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-[#0d0d0d] mb-1">All warranties are in good standing</h3>
      <p className="text-sm text-[#71717a] max-w-xs leading-relaxed">
        No warranties are expiring within the next 180 days. Great job keeping your coverage up to date.
      </p>
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-[#e4e4e7] rounded-[4px] bg-white">
      <div className="text-[13px] font-semibold text-[#0d0d0d] mb-1">No matches</div>
      <p className="text-[12px] text-[#71717a] mb-4">Try adjusting your search or filters.</p>
      <button
        onClick={onClear}
        className="text-sm font-medium text-[#0d0d0d] border border-[#e4e4e7] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}
