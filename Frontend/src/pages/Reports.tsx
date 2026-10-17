import { useState, useEffect, useCallback, type ReactNode } from "react";
import { getReportsSummary } from "../api/reports";
import { searchProducts, type ProductItem } from "../api/products";
import type { ReportsSummary } from "../types";
import { formatDate } from "../utils/date";

export default function Reports() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Category breakdown state
  const [categoryData, setCategoryData] = useState<[string, number][]>([]);
  const [hasMoreCategories, setHasMoreCategories] = useState(false);

  // Paginated Product Summary table state
  const [tableProducts, setTableProducts] = useState<ProductItem[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);

  const fetchReportsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, searchRes] = await Promise.all([
        getReportsSummary(),
        searchProducts({ page: 1, limit: 100 }),
      ]);
      setSummary(sum);

      // Compute category breakdown from accessible products
      const map: Record<string, number> = {};
      (searchRes.products || []).forEach((p) => {
        const cat = p.category || "Uncategorized";
        map[cat] = (map[cat] ?? 0) + 1;
      });
      const sortedCats = Object.entries(map).sort((a, b) => b[1] - a[1]);
      setCategoryData(sortedCats);
      setHasMoreCategories(sum.totalProducts > 100);

      // Initialize table with first 10 items
      setTableProducts(searchRes.products.slice(0, 10));
      setTotalPages(Math.max(1, Math.ceil(sum.totalProducts / 10)));
      setTablePage(1);
    } catch (err: any) {
      setError(err?.message || "Failed to load reports summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  // Handle table pagination
  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === tablePage) return;
    setTableLoading(true);
    try {
      const res = await searchProducts({ page: newPage, limit: 10 });
      setTableProducts(res.products);
      setTablePage(newPage);
    } catch {
      // Keep existing page on error
    } finally {
      setTableLoading(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !summary) {
    return (
      <div className="px-8 py-8 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-[4px] text-sm text-[#b91c1c] mb-5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="5.5" stroke="#dc2626" strokeWidth="1.3" />
            <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#dc2626" />
          </svg>
          <span>{error || "Failed to load reports."}</span>
          <button
            onClick={fetchReportsData}
            className="ml-auto text-xs font-medium text-[#b91c1c] underline underline-offset-2 hover:text-[#991b1b]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (summary.totalProducts === 0) {
    return <EmptyReportsState />;
  }

  const total = summary.totalProducts;
  const active = summary.activeWarranties;
  const expiring = summary.expiringWarranties;
  const expired = summary.expiredWarranties;
  const maxCategoryCount = Math.max(1, ...categoryData.map(([, n]) => n));

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[17px] font-semibold text-[#0d0d0d] leading-tight tracking-[-0.01em]">Reports</h2>
          <p className="text-sm text-[#71717a] mt-1">A summary of your warranty coverage and product inventory.</p>
        </div>
        <button
          className="flex items-center gap-2 text-sm font-medium text-[#3f3f46] border border-[#a1a1aa] px-4 py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors"
          title="Export report"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Export Report
        </button>
      </div>

      {/* Stat cards backed authoritatively by ReportsSummary */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        <StatCard label="Total Products" value={total} sub="products tracked" />
        <StatCard label="Active Warranties" value={active} sub="currently covered" color="green" />
        <StatCard label="Expiring Soon" value={expiring} sub="within 6 months" color="amber" />
        <StatCard label="Expired" value={expired} sub="no longer covered" color="red" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-[1fr_1fr] gap-5 mb-7">
        {/* Donut: warranty status distribution */}
        <Section title="Warranty Status Distribution">
          <div className="flex flex-col gap-5 py-2">
            <div className="flex items-center justify-center gap-10">
              <DonutChart active={active} expiring={expiring} expired={expired} total={total} />
              <div className="flex flex-col gap-3">
                <LegendItem color="#16a34a" label="Active" count={active} pct={pct(active, total)} />
                <LegendItem color="#d97706" label="Expiring Soon" count={expiring} pct={pct(expiring, total)} />
                <LegendItem color="#dc2626" label="Expired" count={expired} pct={pct(expired, total)} />
              </div>
            </div>

            {/* Authoritative Receipts and Ownership Breakdown */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#f4f4f5]">
              <div>
                <div className="text-[10px] text-[#52525b] mono uppercase tracking-wider mb-0.5">Receipt Coverage</div>
                <div className="text-[12px] text-[#0d0d0d] font-medium">
                  {summary.withReceipts} with receipt · {summary.withoutReceipts} without
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#52525b] mono uppercase tracking-wider mb-0.5">Ownership Split</div>
                <div className="text-[12px] text-[#0d0d0d] font-medium">
                  {summary.ownedProducts} owned · {summary.sharedProducts} shared
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Bar: products by category */}
        <Section title="Products by Category">
          <div className="flex flex-col gap-2.5 py-1">
            {categoryData.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#71717a]">No categorized products found.</div>
            ) : (
              categoryData.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="text-[12px] text-[#52525b] w-28 shrink-0 truncate">{cat}</div>
                  <div className="flex-1 h-5 bg-[#f4f4f5] rounded-[2px] overflow-hidden">
                    <div
                      className="h-full bg-[#0d0d0d] rounded-[2px] transition-all"
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] mono text-[#52525b] w-6 text-right shrink-0">{count}</div>
                </div>
              ))
            )}
            {hasMoreCategories && (
              <div className="text-[10px] text-[#52525b] mono mt-2 pt-2 border-t border-[#f4f4f5]">
                Note: Category breakdown computed from initial 100 products. Total tracked products: {summary.totalProducts}.
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Product summary table (Paginated) */}
      <Section title="Product Summary">
        <div className={`overflow-x-auto ${tableLoading ? "opacity-50" : ""}`}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#f4f4f5]">
                {["Product", "Category", "Purchase Date", "Warranty Expiry", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-[10px] font-semibold text-[#52525b] pb-2.5 mono uppercase tracking-wider text-left whitespace-nowrap first:pl-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableProducts.map((p, i) => (
                <tr key={p.id} className={`${i < tableProducts.length - 1 ? "border-b border-[#f9f9f9]" : ""}`}>
                  <td className="py-2.5 pr-4">
                    <div className="text-[13px] font-medium text-[#0d0d0d]">{p.name}</div>
                    <div className="text-[11px] text-[#52525b] mt-0.5">{p.brand || "—"}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-[13px] text-[#52525b]">{p.category || "—"}</td>
                  <td className="py-2.5 pr-4 mono text-[13px] text-[#52525b]">{formatDate(p.purchaseDate)}</td>
                  <td className="py-2.5 pr-4 mono text-[13px] text-[#52525b]">{formatDate(p.warrantyExpiry)}</td>
                  <td className="py-2.5">
                    <StatusDot status={p.status} />
                  </td>
                </tr>
              ))}
              {tableProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#71717a]">
                    No products to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#f4f4f5]">
            <span className="text-[11px] text-[#52525b] mono">
              Page {tablePage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(tablePage - 1)}
                disabled={tablePage === 1 || tableLoading}
                className="px-2 py-1 text-xs font-medium text-[#52525b] border border-[#a1a1aa] rounded-[4px] hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(tablePage + 1)}
                disabled={tablePage === totalPages || tableLoading}
                className="px-2 py-1 text-xs font-medium text-[#52525b] border border-[#a1a1aa] rounded-[4px] hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── Donut chart (pure SVG) ── */
function DonutChart({ active, expiring, expired, total }: { active: number; expiring: number; expired: number; total: number }) {
  const r = 52;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: active, color: "#16a34a" },
    { value: expiring, color: "#d97706" },
    { value: expired, color: "#dc2626" },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const dashLen = total > 0 ? (s.value / total) * circumference : 0;
    const arc = { ...s, dashLen, dashOffset: -offset };
    offset += dashLen;
    return arc;
  });

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4f4f5" strokeWidth="18" />
      {arcs.map(
        (arc, i) =>
          arc.dashLen > 0 && (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth="18"
              strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
              strokeDashoffset={arc.dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          )
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="#0d0d0d" fontFamily="'DM Mono', monospace">
        {total}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="10" fill="#52525b" fontFamily="'Inter', sans-serif">
        products
      </text>
    </svg>
  );
}

function LegendItem({ color, label, count, pct }: { color: string; label: string; count: number; pct: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div>
        <div className="text-[12px] text-[#0d0d0d] font-medium">{label}</div>
        <div className="text-[11px] text-[#52525b] mono">{count} · {pct}</div>
      </div>
    </div>
  );
}

function pct(n: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; label: string; text: string }> = {
    active: { dot: "bg-[#16a34a]", label: "Active", text: "text-[#16a34a]" },
    expiring: { dot: "bg-[#d97706]", label: "Expiring Soon", text: "text-[#b45309]" },
    expired: { dot: "bg-[#dc2626]", label: "Expired", text: "text-[#b91c1c]" },
  };
  const c = cfg[status] ?? cfg.active;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium mono ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {c.label}
    </span>
  );
}

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
          : "bg-[#71717a]";
  return (
    <div className="bg-white border border-[#a1a1aa] rounded-[4px] px-5 pt-4 pb-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-[#52525b] mono uppercase tracking-wider">{label}</div>
        <div className={`w-1 h-4 rounded-full ${accentBar} opacity-70`} />
      </div>
      <div className={`text-[28px] font-bold mono leading-none ${valueColor}`}>{value}</div>
      <div className="text-[11px] text-[#52525b]">{sub}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto animate-pulse">
      <div className="h-5 w-24 bg-[#a1a1aa] rounded mb-2" />
      <div className="h-3.5 w-72 bg-[#f4f4f5] rounded mb-8" />
      <div className="grid grid-cols-4 gap-3 mb-7">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#a1a1aa] rounded-[4px] h-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div className="h-48 bg-white border border-[#a1a1aa] rounded-[4px]" />
        <div className="h-48 bg-white border border-[#a1a1aa] rounded-[4px]" />
      </div>
      <div className="h-48 bg-white border border-[#a1a1aa] rounded-[4px]" />
    </div>
  );
}

function EmptyReportsState() {
  return (
    <div className="px-8 py-20 max-w-[1100px] mx-auto text-center">
      <div className="w-12 h-12 bg-[#f4f4f5] rounded-[4px] flex items-center justify-center mx-auto mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="16" rx="1.5" stroke="#52525b" strokeWidth="1.5" />
          <path d="M7 5V4a5 5 0 0110 0v1" stroke="#52525b" strokeWidth="1.5" />
          <path d="M9 13h6M12 10v6" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[#0d0d0d] mb-1">No products tracked yet</h3>
      <p className="text-sm text-[#71717a] max-w-sm mx-auto leading-relaxed">
        Add products or have products shared with you to see warranty distribution, coverage statistics, and reports.
      </p>
    </div>
  );
}
