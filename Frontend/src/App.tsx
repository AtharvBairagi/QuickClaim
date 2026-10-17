import { useState, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import AddProduct from "./pages/AddProduct";
import ExpiringSoon from "./pages/ExpiringSoon";
import SharedWithMe from "./pages/SharedWithMe";
import Receipts from "./pages/Receipts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AuthPage from "./pages/AuthPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { generateNotifications } from "./api/notifications";
import type { AppRoute } from "./types";

// Which sidebar item to highlight for each route
function sidebarPage(route: AppRoute): string {
  if (route.page === "product-detail" || route.page === "add-product") return "products";
  return route.page;
}

function MainApp() {
  const { isAuthenticated, loading, initialError, retryInitialLoad } = useAuth();
  const [route, setRoute] = useState<AppRoute>({ page: "dashboard" });
  const hasGeneratedNotifsRef = useRef(false);

  // Trigger expiry notification generation once per session upon successful authentication
  useEffect(() => {
    if (isAuthenticated && !hasGeneratedNotifsRef.current) {
      hasGeneratedNotifsRef.current = true;
      generateNotifications().catch(() => {
        // Recoverable failure — do not block the app or retry automatically in a loop
      });
    }
  }, [isAuthenticated]);

  // Initial loading state while verifying session cookie
  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f9f9f9]">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 bg-[#0d0d0d] rounded-[4px] flex items-center justify-center shrink-0 animate-pulse">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L2 4v4c0 3.31 2.55 6.41 6 7 3.45-.59 6-3.69 6-7V4L8 1z" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight text-[#0d0d0d]">QuickClaim</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#71717a]">
          <svg className="animate-spin h-3.5 w-3.5 text-[#0d0d0d]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Restoring session...</span>
        </div>
      </div>
    );
  }

  // Recoverable network / server error state
  if (initialError && !isAuthenticated) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f9f9f9] px-4">
        <div className="w-full max-w-sm bg-white border border-[#e4e4e7] rounded-[4px] p-6 text-center shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#fef2f2] text-[#dc2626] flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[#0d0d0d] mb-1">Connection Issue</h3>
          <p className="text-xs text-[#71717a] mb-4 leading-relaxed">{initialError}</p>
          <button
            onClick={retryInitialLoad}
            className="w-full py-2 bg-[#0d0d0d] text-white text-xs font-medium rounded-[4px] hover:bg-[#262626] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated screen
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Authenticated application
  return (
    <div className="flex h-screen overflow-hidden bg-[#f9f9f9]">
      <Sidebar
        activePage={sidebarPage(route)}
        onNavigate={(page) => setRoute({ page } as AppRoute)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header activePage={route.page} onNavigate={setRoute} />
        <main className="flex-1 overflow-y-auto">
          {route.page === "dashboard" && <Dashboard onNavigate={setRoute} />}
          {route.page === "products" && <Products onNavigate={setRoute} />}
          {route.page === "product-detail" && (
            <ProductDetail productId={route.productId} onNavigate={setRoute} />
          )}
          {route.page === "add-product" && <AddProduct onNavigate={setRoute} />}
          {route.page === "expiring" && <ExpiringSoon onNavigate={setRoute} />}
          {route.page === "shared" && <SharedWithMe onNavigate={setRoute} />}
          {route.page === "receipts" && <Receipts />}
          {route.page === "reports" && <Reports />}
          {route.page === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
