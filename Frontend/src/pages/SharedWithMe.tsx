import { useState, useEffect, useCallback, type ReactNode } from "react";
import StatusBadge from "../components/StatusBadge";
import { getSharedWithMe } from "../api/ownership";
import type { AppRoute, SharedProductItem } from "../types";
import { formatDate } from "../utils/date";

export default function SharedWithMe({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  const [products, setProducts] = useState<SharedProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchSharedProducts = useCallback(() => {
    setLoading(true);
    setError(null);
    getSharedWithMe()
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load shared products.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSharedProducts();
  }, [fetchSharedProducts]);

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q) ||
      p.owner.name.toLowerCase().includes(q) ||
      p.owner.email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <PageShell>
        <PageHeader />
        <LoadingSkeleton />
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
          <span>{error}</span>
          <button
            onClick={fetchSharedProducts}
            className="ml-auto text-xs font-medium text-[#b91c1c] underline underline-offset-2 hover:text-[#991b1b]"
          >
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  if (products.length === 0) {
    return (
      <PageShell>
        <PageHeader />
        <EmptyNoShared />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader />

      {/* Filter bar */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#a1a1aa" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search shared products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-sm bg-white border border-[#e4e4e7] rounded-[4px] w-64 focus:outline-none focus:border-[#a1a1aa] transition-colors placeholder:text-[#a1a1aa]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#71717a]"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <span className="text-[11px] text-[#a1a1aa] mono ml-auto">
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </span>
      </div>

      {/* Table */}
      <div className="border border-[#e4e4e7] rounded-[4px] overflow-hidden bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#e4e4e7] bg-[#f9f9f9]">
              <Th wide>Product</Th>
              <Th>Shared By</Th>
              <Th>Category</Th>
              <Th>Warranty Expiry</Th>
              <Th>Status</Th>
              <Th align="right">{""}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center py-14 text-center px-8">
                    <div className="text-[13px] font-semibold text-[#0d0d0d] mb-1">No products found</div>
                    <p className="text-[12px] text-[#71717a] mb-3">No shared products match your search.</p>
                    <button
                      onClick={() => setSearch("")}
                      className="text-sm font-medium text-[#0d0d0d] border border-[#e4e4e7] px-3 py-1.5 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
                    >
                      Clear search
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <SharedRow
                  key={p.id}
                  product={p}
                  last={i === filtered.length - 1}
                  onView={() => onNavigate({ page: "product-detail", productId: p.id })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SharedRow({
  product: p,
  last,
  onView,
}: {
  product: SharedProductItem;
  last: boolean;
  onView: () => void;
}) {
  const initials = getInitials(p.owner.name);

  return (
    <tr className={`${!last ? "border-b border-[#f4f4f5]" : ""} hover:bg-[#fafafa] transition-colors`}>
      <td className="px-5 py-3.5">
        <div className="font-medium text-[#0d0d0d] text-[13px]">{p.name}</div>
        <div className="text-[11px] text-[#a1a1aa] mt-0.5">{p.brand || "—"}</div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#0d0d0d] text-white flex items-center justify-center text-[9px] font-semibold shrink-0">
            {initials}
          </div>
          <div>
            <div className="text-[13px] text-[#0d0d0d] font-medium">{p.owner.name}</div>
            <div className="text-[11px] text-[#a1a1aa]">{p.owner.email}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-[13px] text-[#52525b]">{p.category || "—"}</td>
      <td className="px-5 py-3.5 mono text-[13px] text-[#52525b]">{formatDate(p.warrantyExpiry)}</td>
      <td className="px-5 py-3.5">
        <StatusBadge status={p.status} size="sm" />
      </td>
      <td className="px-5 py-3.5 text-right">
        <button
          onClick={onView}
          className="text-[12px] font-medium text-[#52525b] hover:text-[#0d0d0d] hover:underline underline-offset-2 transition-colors"
        >
          View
        </button>
      </td>
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <div className="border border-[#e4e4e7] rounded-[4px] overflow-hidden bg-white animate-pulse">
      <div className="h-10 bg-[#f9f9f9] border-b border-[#e4e4e7]" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-5 py-4 border-b border-[#f4f4f5] flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-40 bg-[#e4e4e7] rounded" />
            <div className="h-3 w-20 bg-[#f4f4f5] rounded" />
          </div>
          <div className="h-4 w-32 bg-[#f4f4f5] rounded" />
          <div className="h-4 w-20 bg-[#f4f4f5] rounded" />
          <div className="h-6 w-16 bg-[#f4f4f5] rounded-full" />
          <div className="h-4 w-10 bg-[#e4e4e7] rounded" />
        </div>
      ))}
    </div>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 max-w-[1100px] mx-auto">{children}</div>;
}

function PageHeader() {
  return (
    <div className="mb-6">
      <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Shared With Me</h2>
      <p className="text-sm text-[#71717a] mt-1">
        Products and warranties that other users have shared with you. You can view details but cannot edit them.
      </p>
    </div>
  );
}

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

function EmptyNoShared() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-[#e4e4e7] rounded-[4px] bg-white">
      <div className="w-10 h-10 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mb-3">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <circle cx="7" cy="6" r="3" stroke="#a1a1aa" strokeWidth="1.3" />
          <path d="M2 16c0-3.31 2.24-6 5-6" stroke="#a1a1aa" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="14" cy="6" r="2.5" stroke="#a1a1aa" strokeWidth="1.3" />
          <path d="M14 11c2.76 0 5 2.24 5 5" stroke="#a1a1aa" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[13px] font-semibold text-[#0d0d0d] mb-1">No products shared with you yet</div>
      <p className="text-[12px] text-[#71717a] max-w-xs leading-relaxed">
        When another user shares a product with you, it will appear here. You can be invited from the product&apos;s details page.
      </p>
    </div>
  );
}
