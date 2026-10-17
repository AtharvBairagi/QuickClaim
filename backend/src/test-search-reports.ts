import mongoose from 'mongoose';
import { app } from './app';
import { User } from './models/user.model';
import { Product } from './models/product.model';
import { Ownership } from './models/ownership.model';
import { Receipt } from './models/receipt.model';
import { config } from './config/env';

const PORT = 5094;
const API_URL = `http://localhost:${PORT}/api`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

async function runTests() {
  console.log('=============================================');
  console.log('    STARTING SEARCH & REPORTS (PART 6) TESTS ');
  console.log('=============================================\n');

  let passed = 0;
  let total = 0;

  const assert = (condition: boolean, testName: string, errorMsg?: string) => {
    total++;
    if (condition) {
      console.log(`${colors.green}✓ PASS:${colors.reset} ${testName}`);
      passed++;
    } else {
      console.log(`${colors.red}✗ FAIL:${colors.reset} ${testName}`);
      if (errorMsg) console.log(`  ${colors.red}Error: ${errorMsg}${colors.reset}`);
    }
  };

  let server: any;
  try {
    await mongoose.connect(config.mongoUri);
    // Clean up test data
    await User.deleteMany({ email: /.*@test-search\.com/i });
    await Product.deleteMany({ name: /Test Search Prod/i });
    await Ownership.deleteMany({});
    await Receipt.deleteMany({});

    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => {
        resolve();
      });
    });
  } catch (err) {
    console.error('Failed to start test server:', err);
    process.exit(1);
  }

  let ownerCookie: string;
  let sharedCookie: string;
  let unrelatedCookie: string;
  let prodActiveId: string;
  let prodExpiringId: string;
  let prodExpiredId: string;
  let prodSharedId: string;

  try {
    // ---------------------------------------------------------
    // Setup Users
    // ---------------------------------------------------------
    // 1. User A (Owner)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Owner A', email: 'owner@test-search.com', password: 'password123' }),
    });
    const loginA = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@test-search.com', password: 'password123' }),
    });
    ownerCookie = (loginA.headers.get('set-cookie') || '').split(';')[0];

    // 2. User B (Shared Viewer)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared B', email: 'shared@test-search.com', password: 'password123' }),
    });
    const loginB = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shared@test-search.com', password: 'password123' }),
    });
    sharedCookie = (loginB.headers.get('set-cookie') || '').split(';')[0];

    // 3. User C (Unrelated)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unrelated C', email: 'unrelated@test-search.com', password: 'password123' }),
    });
    const loginC = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unrelated@test-search.com', password: 'password123' }),
    });
    unrelatedCookie = (loginC.headers.get('set-cookie') || '').split(';')[0];

    const now = new Date();
    const purchaseDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
    const activeExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const expiringExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const expiredExpiry = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create 3 products for User A
    // Product 1: Active, Electronics, Dell, XPS 15, BestBuy (has receipt)
    const p1 = await (
      await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          name: 'Test Search Prod Dell XPS',
          category: 'Electronics',
          brand: 'Dell',
          model: 'XPS 15',
          retailer: 'BestBuy',
          purchaseDate,
          warrantyExpiry: activeExpiry,
        }),
      })
    ).json();
    prodActiveId = p1.product.id;

    // Create Receipt directly in DB for p1
    await Receipt.create({
      productId: new mongoose.Types.ObjectId(prodActiveId),
      fileName: 'receipt-xps.pdf',
      originalName: 'dell_receipt.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'uploads/receipts/receipt-xps.pdf',
    });

    // Product 2: Expiring, Laptops, Apple, MacBook Pro, Apple Store (no receipt)
    const p2 = await (
      await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          name: 'Test Search Prod MacBook Pro',
          category: 'Laptops',
          brand: 'Apple',
          model: 'M3 Pro',
          retailer: 'Apple Store',
          purchaseDate,
          warrantyExpiry: expiringExpiry,
        }),
      })
    ).json();
    prodExpiringId = p2.product.id;

    // Product 3: Expired, Audio, Sony, WH-1000XM5, Amazon (has receipt)
    const p3 = await (
      await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          name: 'Test Search Prod Sony Headphones',
          category: 'Audio',
          brand: 'Sony',
          model: 'WH-1000XM5',
          retailer: 'Amazon',
          purchaseDate,
          warrantyExpiry: expiredExpiry,
        }),
      })
    ).json();
    prodExpiredId = p3.product.id;

    await Receipt.create({
      productId: new mongoose.Types.ObjectId(prodExpiredId),
      fileName: 'receipt-sony.pdf',
      originalName: 'sony_receipt.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      storagePath: 'uploads/receipts/receipt-sony.pdf',
    });

    // Share Product 2 (MacBook Pro) with User B
    await fetch(`${API_URL}/products/${prodExpiringId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-search.com' }),
    });

    // ---------------------------------------------------------
    // 1-3: Authentication Checks
    // ---------------------------------------------------------
    const unauthSearch = await fetch(`${API_URL}/products/search`);
    assert(unauthSearch.status === 401, '1. Unauthenticated search -> 401');

    const unauthExpiring = await fetch(`${API_URL}/products/expiring`);
    assert(unauthExpiring.status === 401, '2. Unauthenticated expiring -> 401');

    const unauthReports = await fetch(`${API_URL}/reports/summary`);
    assert(unauthReports.status === 401, '3. Unauthenticated reports summary -> 401');

    // ---------------------------------------------------------
    // 4-10: Search Filter Validations & Core Filters
    // ---------------------------------------------------------
    // Global q search
    const qRes = await (
      await fetch(`${API_URL}/products/search?q=Dell`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(qRes.products?.length === 1 && qRes.products[0].brand === 'Dell', '4. Free-text search (q=Dell) matches brand');

    const qModelRes = await (
      await fetch(`${API_URL}/products/search?q=WH-1000XM5`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(qModelRes.products?.length === 1 && qModelRes.products[0].brand === 'Sony', '5. Free-text search (q=model) matches model');

    // Specific field filters
    const brandRes = await (
      await fetch(`${API_URL}/products/search?brand=apple`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(brandRes.products?.length === 1 && brandRes.products[0].brand === 'Apple', '6. Case-insensitive brand filter (brand=apple) matches Apple');

    const categoryRes = await (
      await fetch(`${API_URL}/products/search?category=Audio`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(categoryRes.products?.length === 1 && categoryRes.products[0].category === 'Audio', '7. Category filter (category=Audio) matches Audio');

    const retailerRes = await (
      await fetch(`${API_URL}/products/search?retailer=BestBuy`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(retailerRes.products?.length === 1 && retailerRes.products[0].retailer === 'BestBuy', '8. Retailer filter matches BestBuy');

    // Status filters
    const statusActiveRes = await (
      await fetch(`${API_URL}/products/search?status=active`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(statusActiveRes.products?.length === 1 && statusActiveRes.products[0].status === 'active', '9. Status filter (status=active) returns active products');

    const statusExpiringRes = await (
      await fetch(`${API_URL}/products/search?status=expiring`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(statusExpiringRes.products?.length === 1 && statusExpiringRes.products[0].status === 'expiring', '10. Status filter (status=expiring) returns expiring products');

    const statusExpiredRes = await (
      await fetch(`${API_URL}/products/search?status=expired`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(statusExpiredRes.products?.length === 1 && statusExpiredRes.products[0].status === 'expired', '11. Status filter (status=expired) returns expired products');

    // Date range filter
    const expiryFromRes = await (
      await fetch(`${API_URL}/products/search?expiryFrom=${purchaseDate}`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(expiryFromRes.products?.length === 3, '12. expiryFrom filter returns all 3 products');

    const expiryToRes = await (
      await fetch(`${API_URL}/products/search?expiryTo=${expiredExpiry}`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(expiryToRes.products?.length === 1 && expiryToRes.products[0].status === 'expired', '13. expiryTo filter returns expired product');

    // Receipt presence filter
    const withReceiptRes = await (
      await fetch(`${API_URL}/products/search?hasReceipt=true`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(
      withReceiptRes.products?.length === 2 &&
        withReceiptRes.products.every((p: any) => typeof p.hasReceipt === 'boolean' && p.hasReceipt === true),
      '14. hasReceipt=true returns only products with receipts as boolean'
    );

    const withoutReceiptRes = await (
      await fetch(`${API_URL}/products/search?hasReceipt=false`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(
      withoutReceiptRes.products?.length === 1 &&
        withoutReceiptRes.products[0].hasReceipt === false &&
        withoutReceiptRes.products[0].id === prodExpiringId,
      '15. hasReceipt=false returns product without receipt as boolean'
    );

    // Verify receipt internals are not leaked
    const firstProd = withReceiptRes.products[0];
    assert(
      !('fileName' in firstProd) && !('storagePath' in firstProd) && !('fileSize' in firstProd),
      '16. Search results return hasReceipt as boolean without leaking receipt document internals'
    );

    // ---------------------------------------------------------
    // 17-20: Validation on Invalid Filters
    // ---------------------------------------------------------
    const invalidStatus = await fetch(`${API_URL}/products/search?status=invalid_status`, { headers: { Cookie: ownerCookie } });
    assert(invalidStatus.status === 400, '17. Invalid status filter -> 400 Bad Request');

    const invalidDate = await fetch(`${API_URL}/products/search?expiryFrom=not-a-date`, { headers: { Cookie: ownerCookie } });
    assert(invalidDate.status === 400, '18. Invalid expiryFrom date -> 400 Bad Request');

    const invalidReceipt = await fetch(`${API_URL}/products/search?hasReceipt=yes`, { headers: { Cookie: ownerCookie } });
    assert(invalidReceipt.status === 400, '19. Invalid hasReceipt filter -> 400 Bad Request');

    // ---------------------------------------------------------
    // 21-23: Pagination & Sorting
    // ---------------------------------------------------------
    const page1Res = await (
      await fetch(`${API_URL}/products/search?limit=2&page=1`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(
      page1Res.products?.length === 2 &&
        page1Res.pagination?.total === 3 &&
        page1Res.pagination?.totalPages === 2 &&
        page1Res.pagination?.hasNextPage === true &&
        page1Res.pagination?.hasPrevPage === false,
      '20. Pagination limit=2, page=1 returns 2 items and pagination metadata'
    );

    const page2Res = await (
      await fetch(`${API_URL}/products/search?limit=2&page=2`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(
      page2Res.products?.length === 1 &&
        page2Res.pagination?.hasNextPage === false &&
        page2Res.pagination?.hasPrevPage === true,
      '21. Pagination page=2 returns remaining 1 item'
    );

    // ---------------------------------------------------------
    // 24-26: Expiring Products Endpoint
    // ---------------------------------------------------------
    const expiringRes = await (
      await fetch(`${API_URL}/products/expiring`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(
      expiringRes.count === 1 &&
        expiringRes.products?.length === 1 &&
        expiringRes.products[0].id === prodExpiringId &&
        expiringRes.products[0].status === 'expiring',
      '22. GET /api/products/expiring returns only expiring products for owner'
    );

    // Shared viewer accessing expiring endpoint
    const sharedExpiringRes = await (
      await fetch(`${API_URL}/products/expiring`, { headers: { Cookie: sharedCookie } })
    ).json();
    assert(
      sharedExpiringRes.count === 1 &&
        sharedExpiringRes.products?.length === 1 &&
        sharedExpiringRes.products[0].id === prodExpiringId &&
        sharedExpiringRes.products[0].isShared === true,
      '23. GET /api/products/expiring returns shared expiring products for viewer'
    );

    // Unrelated user accessing expiring endpoint
    const unrelatedExpiringRes = await (
      await fetch(`${API_URL}/products/expiring`, { headers: { Cookie: unrelatedCookie } })
    ).json();
    assert(
      unrelatedExpiringRes.count === 0 && unrelatedExpiringRes.products?.length === 0,
      '24. Unrelated user receives 0 expiring products'
    );

    // ---------------------------------------------------------
    // 27-30: Reports Summary Endpoint & Exact Counting
    // ---------------------------------------------------------
    const ownerReportRes = await (
      await fetch(`${API_URL}/reports/summary`, { headers: { Cookie: ownerCookie } })
    ).json();
    assert(
      ownerReportRes.summary?.totalProducts === 3 &&
        ownerReportRes.summary?.activeWarranties === 1 &&
        ownerReportRes.summary?.expiringWarranties === 1 &&
        ownerReportRes.summary?.expiredWarranties === 1 &&
        ownerReportRes.summary?.withReceipts === 2 &&
        ownerReportRes.summary?.withoutReceipts === 1 &&
        ownerReportRes.summary?.ownedProducts === 3 &&
        ownerReportRes.summary?.sharedProducts === 0,
      '25. GET /api/reports/summary returns accurate counts for owner'
    );

    const sharedReportRes = await (
      await fetch(`${API_URL}/reports/summary`, { headers: { Cookie: sharedCookie } })
    ).json();
    assert(
      sharedReportRes.summary?.totalProducts === 1 &&
        sharedReportRes.summary?.expiringWarranties === 1 &&
        sharedReportRes.summary?.ownedProducts === 0 &&
        sharedReportRes.summary?.sharedProducts === 1 &&
        sharedReportRes.summary?.withoutReceipts === 1,
      '26. Shared user report counts shared product exactly once as totalProducts and sharedProducts'
    );

    const unrelatedReportRes = await (
      await fetch(`${API_URL}/reports/summary`, { headers: { Cookie: unrelatedCookie } })
    ).json();
    assert(
      unrelatedReportRes.summary?.totalProducts === 0 &&
        unrelatedReportRes.summary?.activeWarranties === 0 &&
        unrelatedReportRes.summary?.ownedProducts === 0 &&
        unrelatedReportRes.summary?.sharedProducts === 0,
      '27. Unrelated user report returns all zeros with zero data leakage'
    );

    // ---------------------------------------------------------
    // 31: Health Check
    // ---------------------------------------------------------
    const health = await fetch(`http://localhost:${PORT}/api/health`);
    assert(health.status === 200, '28. Health endpoint -> 200 OK');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    if (server) server.close();
    await User.deleteMany({ email: /.*@test-search\.com/i });
    await Product.deleteMany({ name: /Test Search Prod/i });
    await Ownership.deleteMany({});
    await Receipt.deleteMany({});
    await mongoose.disconnect();

    console.log(`\nResults: ${passed}/${total} passed.`);
    if (passed === total && total > 0) {
      console.log(`${colors.green}All Search & Reports tests passed successfully!${colors.reset}`);
    } else {
      console.log(`${colors.red}Some tests failed.${colors.reset}`);
    }
    process.exit(passed === total ? 0 : 1);
  }
}

runTests();
