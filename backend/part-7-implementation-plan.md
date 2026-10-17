# QuickClaim — Part 7: Frontend ↔ Backend Integration Plan

## 1. Executive Summary & Overview

The QuickClaim backend (Parts 1–6) is fully implemented, verified, and protected with:
- Part 1: Authentication & User Accounts (JWT in HttpOnly cookies, bcrypt, cookie handling)
- Part 2: Product CRUD & Dynamic Warranty Status calculation
- Part 3: Receipt Upload, Storage (10MB limit, PDF/JPG/PNG), Metadata & Streaming Download
- Part 4: Shared Ownership (Primary Owner vs. Shared Viewer dual-tier authorization)
- Part 5: Warranty Expiry Notifications & Idempotent Deduplication
- Part 6: Multi-field Search, Expiring Items & Summary Reports

The frontend is a React 19 Single Page Application (SPA) built with Vite and Tailwind CSS v4. It features a sleek monochromatic design system and uses a lightweight state-based router in `App.tsx` (`route: AppRoute`). Currently, all pages render mock data from `src/data/sampleData.ts` and `src/data/detailData.ts`.

This plan outlines the complete architectural integration to connect the existing React frontend to the Express/MongoDB backend while preserving 100% of the UI design, layout, and component aesthetics without rewriting the frontend architecture.

---

## 2. Review Corrections & Core Constraints

1. **No CSV / PDF Export**: CSV and file export features are out-of-scope for Part 7.
2. **Preserve Existing UI & State-Based Routing**: Retain the `AppRoute` union and `setRoute` state management in `App.tsx`. Do NOT introduce React Router.
3. **Strict HttpOnly Cookie Authentication**: JWT tokens must **never** be stored in `localStorage`, `sessionStorage`, or JavaScript memory. Session management relies entirely on browser cookie transmission with `credentials: 'include'`.
4. **Verified Backend Response Shapes**: Frontend data models and API services must conform strictly to the actual JSON contracts returned by the backend (e.g. `{ user: ... }`, `{ products: [...] }`, `{ product: ... }`, `{ receipt: ... }`, `{ ownerships: [...] }`, `{ notifications: [...] }`, `{ totalProducts, activeWarranties, ... }`).
5. **Authenticated Streaming Downloads**: Receipt downloads must remain authenticated, passing the session cookie to `GET /api/products/:productId/receipt/download`.
6. **Single Source of Truth for Warranty Status**: Do not duplicate or calculate warranty statuses on the frontend with hardcoded anchor dates. Directly consume `product.status` (`active` | `expiring` | `expired`) computed by the backend's `calculateWarrantyStatus` utility.
7. **Progressive Mock Data Removal**: Replace mock data page by page. Remove `sampleData.ts` and `detailData.ts` only after all consuming components have been integrated and verified.

---

## 3. Frontend ↔ Backend Contract Audit & Field Mappings

| Feature Area | Current Frontend Mock Pattern | Actual Backend API Contract | Required Integration / Mapping |
|---|---|---|---|
| **Authentication State** | Hardcoded static user (`Marcus Johnson` / `MJ`) | Session managed via `HttpOnly` JWT cookie (`token`); user details fetched via `GET /api/auth/me` | Create `AuthContext` + clean Login/Register modal view (`AuthPage.tsx`). Verify session on mount with `GET /api/auth/me`. |
| **Product IDs** | String integers (`"1"`, `"2"`, `"e1"`, `"s1"`) | MongoDB 24-character hex `ObjectId` (`_id` serialized as `id` or `_id`) | Normalize all product IDs as `string` (`product.id = product._id ?? product.id`). |
| **Product Form Fields** | `warrantyStart`, `warrantyEnd`, `purchasePrice` (string) | `warrantyStartDate`, `warrantyExpiry` (ISO date strings), `price` (optional number) | Map form submission payload: `warrantyStartDate = values.warrantyStart`, `warrantyExpiry = values.warrantyEnd`, `price = Number(values.purchasePrice)`. |
| **Warranty Status Source** | Local `deriveStatus()` with hardcoded anchor date `2026-09-12` | Backend `calculateWarrantyStatus` returning `"active" \| "expiring" \| "expired"` | Remove client-side status calculation; consume `product.status` directly from the backend. |
| **Receipt Metadata** | `{ filename, type, size: "284 KB", uploadDate }` | `{ id, productId, originalName, mimeType, size: number, uploadDate }` | Map backend receipt attributes: `filename = receipt.originalName`, format `size` (bytes to KB/MB), derive `type` (`PDF`, `JPG`, `PNG`) from `mimeType`. |
| **Receipts Global Page** | Static hardcoded array of mock receipts | Receipts are associated per product (`/api/products/:productId/receipt`) | Query `/api/products/search?hasReceipt=true` to list all accessible products with receipts; fetch metadata on modal open or download. |
| **Shared Ownership Roles** | Mock displays `role: "owner" \| "editor" \| "viewer"` | Dual role system: Primary Owner (`userId`) + Viewer (`sharedWithId` via `Ownership`) | Display Primary Owner badge for `product.userId === user.id`, and Co-owners (Viewers) for records returned from `/api/products/:id/ownership`. |
| **Notifications** | Hardcoded array in `Header.tsx` | Dynamic alerts from `GET /api/notifications` and `GET /api/notifications/unread-count` | Fetch real notifications, display unread count, call `POST /api/notifications/generate` on dashboard mount, and `PATCH /api/notifications/:id/read` on click. |
| **Reports Summary** | Client-side calculations over `sampleProducts` | `GET /api/reports/summary` returning `{ totalProducts, activeWarranties, expiringWarranties, expiredWarranties, withReceipts, withoutReceipts, ownedProducts, sharedProducts }` | Populate report KPI cards and donut chart directly from `/api/reports/summary`. |

---

## 4. API Client & Network Architecture

### 4.1 Base HTTP Client (`Frontend/src/api/client.ts`)
```typescript
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    credentials: 'include', // Ensures HttpOnly auth cookie is automatically sent/received
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (response.status === 204) return {} as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error || data.message || 'An unexpected error occurred');
  }

  return data as T;
}
```

### 4.2 Modular API Services (`Frontend/src/api/`)
1. **`auth.ts`**:
   - `login(credentials: LoginCredentials): Promise<{ user: User }>`
   - `register(data: RegisterData): Promise<{ user: User }>`
   - `logout(): Promise<{ message: string }>`
   - `getMe(): Promise<{ user: User }>`
2. **`products.ts`**:
   - `getProducts(): Promise<{ products: Product[] }>`
   - `getProductById(id: string): Promise<{ product: Product }>`
   - `createProduct(data: Partial<Product>): Promise<{ product: Product }>`
   - `updateProduct(id: string, data: Partial<Product>): Promise<{ product: Product }>`
   - `deleteProduct(id: string): Promise<{ message: string }>`
   - `searchProducts(params: SearchParams): Promise<{ products: Product[]; pagination: PaginationMetadata }>`
   - `getExpiringProducts(): Promise<{ products: Product[] }>`
   - `getSharedWithMe(): Promise<{ products: SharedProductItem[] }>`
3. **`receipts.ts`**:
   - `uploadReceipt(productId: string, file: File): Promise<{ receipt: ReceiptMetadata }>`
   - `getReceipt(productId: string): Promise<{ receipt: ReceiptMetadata }>`
   - `downloadReceipt(productId: string, filename: string): Promise<void>`
   - `deleteReceipt(productId: string): Promise<{ message: string }>`
4. **`ownership.ts`**:
   - `getOwnerships(productId: string): Promise<{ ownerships: OwnershipRecord[] }>`
   - `shareProduct(productId: string, email: string): Promise<{ ownership: OwnershipRecord }>`
   - `removeSharedAccess(productId: string, userId: string): Promise<{ message: string }>`
5. **`notifications.ts`**:
   - `getNotifications(): Promise<{ notifications: NotificationItem[] }>`
   - `getUnreadCount(): Promise<{ unreadCount: number }>`
   - `generateNotifications(): Promise<{ count: number }>`
   - `markAsRead(id: string): Promise<{ notification: NotificationItem }>`
6. **`reports.ts`**:
   - `getReportsSummary(): Promise<ReportsSummary>`

---

## 5. Authentication & Session Flow

```
+-----------------------------------------------------------------------------------+
| Initial Mount (App.tsx / AuthContext)                                            |
|                                                                                   |
| App Mount -> GET /api/auth/me (with credentials)                                  |
|   +-- [200 OK]  -> setAuthState({ user, isAuthenticated: true, loading: false })  |
|   +-- [401 / 403] -> setAuthState({ user: null, isAuthenticated: false, loading: false })|
+-----------------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
[isAuthenticated == false]                             [isAuthenticated == true]
          |                                                   |
          v                                                   v
+-----------------------+                           +-----------------------------------+
| Render AuthPage.tsx   |                           | Render Main Layout (Sidebar +     |
| (Login / Sign Up)     |                           | Header + Active Page Component)   |
|                       |                           |                                   |
| On Submit:            |                           | User actions query API with       |
| POST /api/auth/login  |                           | automatic HttpOnly cookie.        |
| or /api/auth/register |                           |                                   |
| -> refreshUser()      |                           | On 401 response:                  |
+-----------------------+                           | AuthContext resets to unauth.     |
                                                    +-----------------------------------+
```

---

## 6. Page-by-Page Integration Specifications

### 6.1 `App.tsx`
- Wrap main component tree inside `<AuthProvider>`.
- If `loading`: Render sleek loading skeleton.
- If `!isAuthenticated`: Render `AuthPage` (Login / Register modal).
- If `isAuthenticated`: Render `Sidebar`, `Header`, and the active page view.

### 6.2 `Header.tsx`
- Display user initials and name from `useAuth().user`.
- Add dropdown menu on profile click with links to `Settings` and `Sign Out`.
- Notification Bell:
  - Fetch unread count on mount (`getUnreadCount()`).
  - On bell click: fetch notifications (`getNotifications()`).
  - Clicking a notification calls `markAsRead(id)`, updates the unread count badge, and navigates to the associated product if present.

### 6.3 `Sidebar.tsx`
- Display active navigation item matching `route.page`.
- "Expiring Soon" badge: Dynamically display count of expiring warranties from `getExpiringProducts()` or `getReportsSummary()`.
- Bottom user profile section renders authenticated user's name and email.

### 6.4 `Dashboard.tsx`
- Fetch summary statistics via `getReportsSummary()` to populate the 4 KPI stat cards (`Total Products`, `Active Warranties`, `Expiring Soon`, `Expired`).
- Fetch expiring products via `getExpiringProducts()` for the "Warranty Expiring Soon" table.
- Fetch recent products via `searchProducts({ limit: 5, sortBy: 'purchaseDate', sortOrder: 'desc' })` for "Recently Added".
- Call `generateNotifications()` in the background on initial dashboard load.

### 6.5 `Products.tsx`
- Connect search input (`q`), category dropdown, status dropdown, sorting, and pagination to `searchProducts({ q, category, status, sortBy, sortOrder, page, limit: 8 })`.
- Debounce text search by 300ms.
- Connect "Delete" action in product menu to `deleteProduct(id)`.

### 6.6 `ProductDetail.tsx`
- Fetch product via `getProductById(productId)`.
- **Receipt Card**:
  - If `product.hasReceipt`: load metadata via `getReceipt(productId)`.
  - "Download": calls `downloadReceipt(productId, receipt.originalName)`.
  - "Upload Receipt": triggers file input and calls `uploadReceipt(productId, file)`.
  - "Delete Receipt": calls `deleteReceipt(productId)`.
- **Shared Ownership Card**:
  - Check if current user is owner (`product.userId === user.id`).
  - If owner: fetch co-owners via `getOwnerships(productId)`. Allow sharing via `shareProduct(productId, email)` and revoking via `removeSharedAccess(productId, userId)`.
  - If shared viewer: hide management buttons and render read-only indicator.
- **Edit & Delete Actions**:
  - Edit: Opens modal to update product attributes via `updateProduct(id, data)`.
  - Delete: Confirms and calls `deleteProduct(id)`, then navigates back to `products`.

### 6.7 `AddProduct.tsx`
- Form submission validates required fields and calls `createProduct({ name, brand, model, category, purchaseDate, price, retailer, warrantyStartDate, warrantyExpiry, notes })`.
- If a receipt file is attached: immediately call `uploadReceipt(createdProduct.id, file)` following product creation.
- On success: Navigate to `products` or `product-detail`.

### 6.8 `ExpiringSoon.tsx`
- Fetch products via `getExpiringProducts()`.
- Category and period sub-filters filter the retrieved expiring list.

### 6.9 `SharedWithMe.tsx`
- Fetch shared products via `getSharedWithMe()`.
- Render sharing details (`sharedBy.name`, `sharedBy.email`, `sharedAt`).

### 6.10 `Receipts.tsx`
- Fetch accessible products with receipts via `searchProducts({ hasReceipt: 'true' })`.
- Connect "View" modal and "Download" buttons to `getReceipt(productId)` and `downloadReceipt(productId, filename)`.

### 6.11 `Reports.tsx`
- Fetch aggregated summary counts from `getReportsSummary()`.
- Populate stat cards and SVG Donut Chart with real counts (`activeWarranties`, `expiringWarranties`, `expiredWarranties`, `totalProducts`).
- Compute category distribution from accessible products list for the category breakdown bar chart.

### 6.12 `Settings.tsx`
- Display user name and email from `useAuth().user`.
- Connect "Sign Out" button to `logout()`.

---

## 7. TypeScript Types (`Frontend/src/types/index.ts`)

```typescript
export type WarrantyStatus = "active" | "expiring" | "expired";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  userId?: string;
  name: string;
  brand: string;
  model?: string;
  category: string;
  purchaseDate: string;
  price?: number;
  retailer?: string;
  warrantyStartDate: string;
  warrantyExpiry: string;
  status: WarrantyStatus;
  hasReceipt?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptMetadata {
  id: string;
  productId: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadDate: string;
}

export interface OwnershipRecord {
  id: string;
  productId: string;
  sharedWith: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface SharedProductItem extends Product {
  sharedBy: {
    id: string;
    name: string;
    email: string;
  };
  sharedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  productId?: string;
  type: "warranty_expiring" | "warranty_expired";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportsSummary {
  totalProducts: number;
  activeWarranties: number;
  expiringWarranties: number;
  expiredWarranties: number;
  withReceipts: number;
  withoutReceipts: number;
  ownedProducts: number;
  sharedProducts: number;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SearchParams {
  q?: string;
  name?: string;
  brand?: string;
  category?: string;
  model?: string;
  retailer?: string;
  status?: WarrantyStatus;
  expiryFrom?: string;
  expiryTo?: string;
  hasReceipt?: 'true' | 'false';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'purchaseDate' | 'warrantyExpiry' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export type AppRoute =
  | { page: "dashboard" }
  | { page: "products" }
  | { page: "product-detail"; productId: string }
  | { page: "add-product" }
  | { page: "expiring" }
  | { page: "shared" }
  | { page: "receipts" }
  | { page: "reports" }
  | { page: "settings" };
```

---

## 8. Development Environment & Proxy Configuration

To ensure seamless cookie passing and avoid cross-origin cookie issues in local development, configure the Vite dev server proxy in `Frontend/vite.config.ts`:

```typescript
server: {
  host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '8443'),
  strictPort: true,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

---

## 9. Implementation Checklist & Acceptance Criteria

### Phase 1: Network, Proxy & Shared Utilities
- [ ] Configure Vite `/api` proxy to port 5000 in `Frontend/vite.config.ts`.
- [ ] Create `Frontend/src/utils/date.ts` containing pure formatting helpers (`formatDate`, `formatDaysRemaining`, `getDaysRemaining`).
- [ ] Create `Frontend/src/types/index.ts` with updated, verified domain interfaces.
- [ ] Implement `Frontend/src/api/client.ts` with `credentials: 'include'` and standardized error parsing.

### Phase 2: Authentication Layer
- [ ] Implement `Frontend/src/api/auth.ts` (`login`, `register`, `logout`, `getMe`).
- [ ] Implement `Frontend/src/context/AuthContext.tsx` (`user`, `isAuthenticated`, `loading`, `login`, `register`, `logout`).
- [ ] Create `Frontend/src/pages/AuthPage.tsx` with Login and Sign Up tabs matching QuickClaim design aesthetics.
- [ ] Wrap `App.tsx` in `AuthProvider` and render `AuthPage` when unauthenticated.
- [ ] Update `Header.tsx` and `Sidebar.tsx` to display real user name, email, and avatar initials.
- [ ] Connect `Settings.tsx` logout button to `auth.logout()`.

### Phase 3: Product CRUD & Search
- [ ] Implement `Frontend/src/api/products.ts`.
- [ ] Connect `AddProduct.tsx` to `createProduct()`.
- [ ] Connect `Products.tsx` to `searchProducts()` with debounced search, filters, pagination, and deletion.
- [ ] Connect `ProductDetail.tsx` to `getProductById()`, `updateProduct()`, and `deleteProduct()`.

### Phase 4: Receipt Management
- [ ] Implement `Frontend/src/api/receipts.ts`.
- [ ] Connect `ProductDetail.tsx` to upload receipts (`multipart/form-data`), display metadata, and perform authenticated streaming downloads.
- [ ] Connect `Receipts.tsx` gallery to list accessible products with receipts and provide streaming downloads.

### Phase 5: Shared Ownership
- [ ] Implement `Frontend/src/api/ownership.ts`.
- [ ] Connect `ProductDetail.tsx` sharing card: list co-owners (`getOwnerships`), invite by email (`shareProduct`), and revoke access (`removeSharedAccess`).
- [ ] Ensure shared viewers have read-only views without edit/delete/share controls.
- [ ] Connect `SharedWithMe.tsx` to display products shared by other users (`getSharedWithMe`).

### Phase 6: Notifications & Reports
- [ ] Implement `Frontend/src/api/notifications.ts` and `Frontend/src/api/reports.ts`.
- [ ] Connect `Header.tsx` notification bell to `getUnreadCount()`, `getNotifications()`, and `markAsRead()`.
- [ ] Connect `Dashboard.tsx` to `getReportsSummary()`, `getExpiringProducts()`, and `searchProducts()`.
- [ ] Connect `ExpiringSoon.tsx` to `getExpiringProducts()`.
- [ ] Connect `Reports.tsx` to `getReportsSummary()` for KPI cards and SVG status donut chart.

### Phase 7: Mock Data Removal & Verification
- [ ] Safely remove `Frontend/src/data/sampleData.ts` and `Frontend/src/data/detailData.ts`.
- [ ] Run backend integration test suites (`test-auth.ts`, `test-products.ts`, `test-receipts.ts`, `test-ownership.ts`, `test-notifications.ts`, `test-search-reports.ts`) to ensure 100% pass rate.
- [ ] Run `tsc --noEmit` and `npm run build` in `Frontend/` to confirm zero compilation errors.
- [ ] Perform full end-to-end user journey test across all features.
