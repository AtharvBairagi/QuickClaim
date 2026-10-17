import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: any) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: (props: { active: boolean }) => React.JSX.Element;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "products", label: "Products", icon: ProductsIcon },
  { id: "expiring", label: "Expiring Soon", icon: ExpiringIcon },
  { id: "shared", label: "Shared With Me", icon: SharedIcon },
  { id: "receipts", label: "Receipts", icon: ReceiptsIcon },
  { id: "reports", label: "Reports", icon: ReportsIcon },
];

const bottomItems = [
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { user } = useAuth();

  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <aside className="w-[220px] shrink-0 flex flex-col border-r border-[#a1a1aa] bg-white h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#a1a1aa]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#0d0d0d] rounded-[4px] flex items-center justify-center shrink-0">
            <ShieldIcon />
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-[#0d0d0d]">QuickClaim</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] text-sm transition-colors text-left ${isActive
                      ? "bg-[#0d0d0d] text-white"
                      : "text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#0d0d0d]"
                    }`}
                >
                  <Icon active={isActive} />
                  <span className="font-medium flex-1">{item.label}</span>
                  {item.badge && !isActive && (
                    <span className="text-[11px] font-semibold bg-[#fef3c7] text-[#92400e] rounded-[3px] px-1.5 py-0.5 mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 pt-4 border-t border-[#a1a1aa]">
          <ul className="space-y-0.5">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] text-sm transition-colors text-left ${isActive
                        ? "bg-[#0d0d0d] text-white"
                        : "text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#0d0d0d]"
                      }`}
                  >
                    <Icon active={isActive} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Profile */}
      <div className="px-3 pb-4 pt-2 border-t border-[#a1a1aa]">
        <button
          onClick={() => onNavigate("settings")}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] hover:bg-[#f4f4f5] transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-[#0d0d0d] text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-[#0d0d0d] truncate">{displayName}</div>
            <div className="text-xs text-[#71717a] truncate">{displayEmail}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

/* ---- Icons ---- */
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L2 4v4c0 3.31 2.55 6.41 6 7 3.45-.59 6-3.69 6-7V4L8 1z" fill="white" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" fill={c} />
      <rect x="9" y="1" width="6" height="6" rx="1" fill={c} />
      <rect x="1" y="9" width="6" height="6" rx="1" fill={c} />
      <rect x="9" y="9" width="6" height="6" rx="1" fill={c} />
    </svg>
  );
}

function ProductsIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="1" stroke={c} strokeWidth="1.5" />
      <path d="M5 4V3a3 3 0 016 0v1" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function ExpiringIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke={c} strokeWidth="1.5" />
      <path d="M8 5v3.5L10.5 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SharedIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke={c} strokeWidth="1.5" />
      <path d="M1 13c0-2.76 2.24-5 5-5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="5" r="2" stroke={c} strokeWidth="1.5" />
      <path d="M12 8c1.66 0 3 1.34 3 3" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptsIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 1h10v14l-2-1.5L9 15l-1-1.5L7 15l-2-1.5L3 15V1z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 5h4M6 8h4M6 11h2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="1" stroke={c} strokeWidth="1.5" />
      <path d="M5 10V8M8 10V5M11 10V7" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#71717a";
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke={c} strokeWidth="1.5" />
      <path
        d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
