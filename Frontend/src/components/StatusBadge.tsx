import type { WarrantyStatus } from "../types";

interface StatusBadgeProps {
  status: WarrantyStatus;
  size?: "sm" | "md";
}

const config: Record<WarrantyStatus, { label: string; bg: string; text: string; dot: string }> = {
  active: {
    label: "Active",
    bg: "bg-[#f0fdf4]",
    text: "text-[#16a34a]",
    dot: "bg-[#16a34a]",
  },
  expiring: {
    label: "Expiring Soon",
    bg: "bg-[#fffbeb]",
    text: "text-[#b45309]",
    dot: "bg-[#d97706]",
  },
  expired: {
    label: "Expired",
    bg: "bg-[#fef2f2]",
    text: "text-[#b91c1c]",
    dot: "bg-[#dc2626]",
  },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const c = config[status];
  const px = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[3px] font-medium mono ${c.bg} ${c.text} ${px}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {c.label}
    </span>
  );
}
