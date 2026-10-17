import { useState, useEffect, type ReactNode } from "react";
import { listProducts, getExpiringProducts } from "../api/products";
import type { ProductResponse, ProductItem } from "../api/products";
import { getReportsSummary } from "../api/reports";
import type { ReportsSummary } from "../types";
import StatusBadge from "../components/StatusBadge";
import type { AppRoute } from "../types";
import { formatDate, getDaysRemaining, formatDaysRemaining } from "../utils/date";

export default function Dashboard({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ProductItem[]>([]);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      getReportsSummary(),
      getExpiringProducts(),
      listProducts(),
    ]).then(([summaryResult, expiringResult, productsResult]) => {
      if (cancelled) return;

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      }
      if (expiringResult.status === "fulfilled") {
        setExpiringProducts(expiringResult.value.products || []);
      }
      if (productsResult.status === "fulfilled") {
        setProducts(productsResult.value || []);
      }

      // Only display fatal error if all essential product and summary fetches failed
      if (productsResult.status === "rejected" && summaryResult.status === "rejected") {
        setError("Failed to load dashboard data. Please try again.");
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error && products.length === 0 && !summary) {
    return (
      <div className="px-8 py-8 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
          </svg>
          {error}
        </div>
      </div>
    );
  }

  const totalCount = summary?.totalProducts ?? products.length;
  if (totalCount === 0) {
    return <EmptyState onNavigate={onNavigate} />;
  }

  // Use authoritative backend summary metrics, falling back to local list if report was unavailable
  const stats = {
    total: summary?.totalProducts ?? products.length,
    active: summary?.activeWarranties ?? products.filter((p) => p.status === "active").length,
    expiring: summary?.expiringWarranties ?? products.filter((p) => p.status === "expiring").length,
    expired: summary?.expiredWarranties ?? products.filter((p) => p.status === "expired").length,
  };

  const recentlyAdded = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {/* Page heading */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Dashboard</h2>
          <p className="text-sm text-[#71717a] mt-1">
            Here&apos;s an overview of your warranty coverage.
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Products" value={stats.total} sub="products tracked" />
        <StatCard label="Active Warranties" value={stats.active} sub="currently covered" color="green" />
        <StatCard label="Expiring Soon" value={stats.expiring} sub="within 6 months" color="amber" />
        <StatCard label="Expired" value={stats.expired} sub="no longer covered" color="red" />
      </div>

      {/* Expiring Soon table (includes accessible expiring products) */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[#0d0d0d] tracking-[-0.01em]">Warranty Expiring Soon</h3>
          <button
            onClick={() => onNavigate({ page: "expiring" })}
            className="text-xs text-[#71717a] hover:text-[#0d0d0d] transition-colors font-medium"
          >
            View all →
          </button>
        </div>
        <div className="border border-[#e4e4e7] rounded-[4px] overflow-hidden bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#f9f9f9]">
                <Th wide>Product</Th>
                <Th>Category</Th>
                <Th>Expiry Date</Th>
                <Th>Remaining</Th>
                <Th>Status</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {expiringProducts.map((product, i) => (
                <ExpiringRow
                  key={product.id}
                  product={product}
                  last={i === expiringProducts.length - 1}
                  onNavigate={onNavigate}
                />
              ))}
              {expiringProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#71717a]">
                    No warranties expiring soon.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recently Added */}
      <section className="pb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[#0d0d0d] tracking-[-0.01em]">Recently Added</h3>
          <button
            onClick={() => onNavigate({ page: "products" })}
            className="text-xs text-[#71717a] hover:text-[#0d0d0d] transition-colors font-medium"
          >
            View all products →
          </button>
        </div>
        <div className="border border-[#e4e4e7] rounded-[4px] overflow-hidden bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#f9f9f9]">
                <Th wide>Product</Th>
                <Th>Category</Th>
                <Th>Purchase Date</Th>
                <Th>Warranty Expiry</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {recentlyAdded.map((product, i) => (
                <RecentRow
                  key={product.id}
                  product={product}
                  last={i === recentlyAdded.length - 1}
                  onNavigate={onNavigate}
                />
              ))}
              {recentlyAdded.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#71717a]">
                    No products added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---- Loading skeleton ---- */
function LoadingState() {
  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-5 w-28 bg-[#e4e4e7] rounded mb-2" />
          <div className="h-3.5 w-64 bg-[#f4f4f5] rounded" />
        </div>
        <div className="h-8 w-28 bg-[#e4e4e7] rounded-[4px]" />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-[#e4e4e7] rounded-[4px] px-5 pt-4 pb-4 h-24" />
        ))}
      </div>
      <div className="h-40 bg-white border border-[#e4e4e7] rounded-[4px] mb-8" />
      <div className="h-40 bg-white border border-[#e4e4e7] rounded-[4px]" />
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

/* ---- Stat Card ---- */
type StatColor = "green" | "amber" | "red" | undefined;

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color?: StatColor }) {
  const valueColor =
    color === "green"
      ? "text-[#15803d]"
      : color === "amber"
      ? "text-[#b45309]"
      : color === "red"
      ? "text-[#b91c1c]"
      : "text-[#0d0d0d]";

  const accentBar =
    color === "green"
      ? "bg-[#16a34a]"
      : color === "amber"
      ? "bg-[#d97706]"
      : color === "red"
      ? "bg-[#dc2626]"
      : "bg-[#d4d4d8]";

  return (
    <div className="bg-white border border-[#e4e4e7] rounded-[4px] px-5 pt-4 pb-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-[#a1a1aa] mono uppercase tracking-wider">{label}</div>
        <div className={`w-1 h-4 rounded-full ${accentBar} opacity-70`} />
      </div>
      <div className={`text-[28px] font-bold mono leading-none ${valueColor}`}>{value}</div>
      <div className="text-[11px] text-[#a1a1aa]">{sub}</div>
    </div>
  );
}

/* ---- Expiring Row ---- */
function ExpiringRow({
  product,
  last,
  onNavigate,
}: {
  product: ProductItem | ProductResponse;
  last: boolean;
  onNavigate: (r: AppRoute) => void;
}) {
  const days = getDaysRemaining(product.warrantyExpiry);
  const remainingColor =
    days < 30 ? "text-[#b91c1c]" : days < 90 ? "text-[#b45309]" : "text-[#52525b]";

  return (
    <tr className={`${!last ? "border-b border-[#f4f4f5]" : ""} hover:bg-[#fafafa] transition-colors`}>
      <td className="px-5 py-3.5">
        <div className="font-medium text-[#0d0d0d] text-[13px]">{product.name}</div>
        <div className="text-[11px] text-[#a1a1aa] mt-0.5">{product.brand || "—"}</div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-[13px] text-[#52525b]">{product.category || "—"}</span>
      </td>
      <td className="px-5 py-3.5">
        <span className="mono text-[13px] text-[#52525b]">{formatDate(product.warrantyExpiry)}</span>
      </td>
      <td className="px-5 py-3.5">
        <span className={`mono text-[13px] font-medium ${remainingColor}`}>
          {formatDaysRemaining(days)}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={product.status} />
      </td>
      <td className="px-5 py-3.5 text-right">
        <button
          onClick={() => onNavigate({ page: "product-detail", productId: product.id })}
          className="text-[12px] font-medium text-[#52525b] hover:text-[#0d0d0d] hover:underline underline-offset-2 transition-colors"
        >
          View
        </button>
      </td>
    </tr>
  );
}

/* ---- Recent Row ---- */
function RecentRow({
  product,
  last,
  onNavigate,
}: {
  product: ProductResponse;
  last: boolean;
  onNavigate: (r: AppRoute) => void;
}) {
  return (
    <tr
      className={`${!last ? "border-b border-[#f4f4f5]" : ""} hover:bg-[#fafafa] transition-colors cursor-pointer`}
      onClick={() => onNavigate({ page: "product-detail", productId: product.id })}
    >
      <td className="px-5 py-3.5">
        <div className="font-medium text-[#0d0d0d] text-[13px]">{product.name}</div>
        <div className="text-[11px] text-[#a1a1aa] mt-0.5">{product.brand || "—"}</div>
      </td>
      <td className="px-5 py-3.5 text-[13px] text-[#52525b]">{product.category || "—"}</td>
      <td className="px-5 py-3.5">
        <span className="mono text-[13px] text-[#52525b]">{formatDate(product.purchaseDate)}</span>
      </td>
      <td className="px-5 py-3.5">
        <span className="mono text-[13px] text-[#52525b]">{formatDate(product.warrantyExpiry)}</span>
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={product.status} size="sm" />
      </td>
    </tr>
  );
}

/* ---- Empty State ---- */
function EmptyState({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  return (
    <div className="flex items-center justify-center h-full px-8 py-20">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="16" rx="1.5" stroke="#a1a1aa" strokeWidth="1.5" />
            <path d="M7 5V4a5 5 0 0110 0v1" stroke="#a1a1aa" strokeWidth="1.5" />
            <path d="M9 13h6M12 10v6" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[#0d0d0d] mb-1">No products yet</h3>
        <p className="text-sm text-[#71717a] leading-relaxed mb-5">
          Add your first product to start tracking warranties and receipts. You&apos;ll be able to see expiry dates
          and get notified before warranties lapse.
        </p>
        <button
          onClick={() => onNavigate({ page: "add-product" })}
          className="inline-flex items-center gap-2 bg-[#0d0d0d] text-white text-sm font-medium px-4 py-2.5 rounded-[4px] hover:bg-[#262626] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add your first product
        </button>
      </div>
    </div>
  );
}
