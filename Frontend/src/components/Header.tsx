import { useState, useRef, useEffect, useCallback } from "react";
import type { AppRoute, NotificationItem } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
} from "../api/notifications";

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Products",
  "product-detail": "Product Details",
  "add-product": "Add Product",
  expiring: "Expiring Soon",
  shared: "Shared With Me",
  receipts: "Receipts",
  reports: "Reports",
  settings: "Settings",
};

interface HeaderProps {
  activePage: string;
  onNavigate: (route: AppRoute) => void;
}

export default function Header({ activePage, onNavigate }: HeaderProps) {
  const { user, logout } = useAuth();
  const [searchVal, setSearchVal] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || "User";
  const initials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  // Fetch initial unread count
  const fetchUnreadCount = useCallback(() => {
    getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {
        // Silently tolerate count error without disrupting header
      });
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch notifications list when dropdown is opened
  const handleToggleNotif = () => {
    const nextState = !notifOpen;
    setNotifOpen(nextState);
    if (nextState) {
      setLoadingNotifs(true);
      getNotifications()
        .then((items) => {
          setNotifications(items);
          // Sync unread count with actual items
          const realUnread = items.filter((n) => !n.read).length;
          setUnreadCount(realUnread);
        })
        .catch(() => {
          // Keep whatever items we have or empty
        })
        .finally(() => {
          setLoadingNotifs(false);
        });
    }
  };

  // Mark notification as read and navigate to product detail
  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      // Optimistic update preventing double decrements
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationAsRead(n.id);
      } catch {
        // Rollback on failure
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read: false } : item))
        );
        setUnreadCount((prev) => prev + 1);
      }
    }

    setNotifOpen(false);
    if (n.productId) {
      onNavigate({ page: "product-detail", productId: n.productId });
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-[#e4e4e7] bg-white flex items-center px-6 gap-4 shrink-0">
      <h1 className="text-[15px] font-semibold text-[#0d0d0d] mr-auto">
        {pageTitles[activePage] ?? activePage}
      </h1>

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
          placeholder="Search products…"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          className="pl-8 pr-3 py-1.5 text-sm bg-[#f4f4f5] border border-transparent rounded-[4px] w-56 focus:outline-none focus:border-[#a1a1aa] focus:bg-white transition-colors placeholder:text-[#a1a1aa]"
        />
        {searchVal && (
          <button
            onClick={() => setSearchVal("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#71717a]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Notification */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={handleToggleNotif}
          className="w-8 h-8 flex items-center justify-center rounded-[4px] hover:bg-[#f4f4f5] transition-colors relative"
          aria-label="Notifications"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.5a5 5 0 00-5 5v3l-1.5 1.5v.5h13v-.5L13 9.5v-3a5 5 0 00-5-5z"
              stroke="#3f3f46"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="#3f3f46" strokeWidth="1.5" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#d97706] rounded-full border-2 border-white" />
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-10 w-80 bg-white border border-[#e4e4e7] rounded-[4px] shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e4e4e7] flex items-center justify-between bg-[#f9f9f9]">
              <span className="text-sm font-semibold text-[#0d0d0d]">Notifications</span>
              <span className="text-xs text-[#71717a] mono">
                {unreadCount} {unreadCount === 1 ? "unread" : "unread"}
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loadingNotifs ? (
                <div className="py-8 text-center text-xs text-[#71717a]">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-[#71717a]">
                  No notifications yet. You will be alerted when warranties approach expiry.
                </div>
              ) : (
                <ul className="divide-y divide-[#f4f4f5]">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`px-4 py-3 hover:bg-[#fafafa] cursor-pointer transition-colors ${
                        !n.read ? "bg-[#fffdf7]" : "bg-white"
                      }`}
                    >
                      <div className="flex gap-2.5 items-start">
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                            !n.read ? "bg-[#d97706]" : "bg-transparent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-[#0d0d0d] font-medium leading-snug">
                            {n.title}
                          </div>
                          <div className="text-[12px] text-[#52525b] mt-0.5 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-[#a1a1aa] mono mt-1">
                            {formatNotifTime(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#e4e4e7]" />

      {/* Profile Menu */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full bg-[#0d0d0d] text-white flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <span className="text-sm font-medium text-[#3f3f46] max-w-[120px] truncate">{displayName}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-10 w-48 bg-white border border-[#e4e4e7] rounded-[4px] shadow-lg z-50 py-1">
            <div className="px-3 py-2 border-b border-[#f4f4f5]">
              <div className="text-xs font-semibold text-[#0d0d0d] truncate">{displayName}</div>
              <div className="text-[11px] text-[#71717a] truncate">{user?.email}</div>
            </div>
            <button
              onClick={() => {
                setProfileOpen(false);
                onNavigate({ page: "settings" });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#0d0d0d] transition-colors text-left"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Settings
            </button>
            <div className="my-1 border-t border-[#f4f4f5]" />
            <button
              onClick={async () => {
                setProfileOpen(false);
                await logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#b91c1c] hover:bg-[#fef2f2] transition-colors text-left"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function formatNotifTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return "";
  }
}
