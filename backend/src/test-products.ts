import http from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { User } from './models/user.model';
import { Product } from './models/product.model';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

const record = (name: string, passed: boolean, details?: string, error?: string) => {
  results.push({ name, passed, details, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   Details: ${details}`);
  if (error) console.error(`   Error: ${error}`);
};

const runProductTests = async () => {
  console.log('\n=============================================');
  console.log('    STARTING QUICKCLAIM PRODUCT CRUD TESTS   ');
  console.log('=============================================\n');

  // Connect to DB
  await connectDatabase();

  // Clean test data
  await User.deleteMany({ email: /test-prod.*@example\.com/i });
  await Product.deleteMany({});

  const app = createApp();
  const server = http.createServer(app);

  const port = 5098;
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on port ${port}\n`);
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // -------------------------------------------------------------
    // SETUP: Register & login User A and User B
    // -------------------------------------------------------------
    // Register User A
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User A',
        email: 'test-prod-a@example.com',
        password: 'password123',
      }),
    });

    const loginARes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-prod-a@example.com',
        password: 'password123',
      }),
    });
    const cookieUserA = (loginARes.headers.get('set-cookie') || '').split(';')[0];

    // Register User B
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User B',
        email: 'test-prod-b@example.com',
        password: 'password123',
      }),
    });

    const loginBRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-prod-b@example.com',
        password: 'password123',
      }),
    });
    const cookieUserB = (loginBRes.headers.get('set-cookie') || '').split(';')[0];

    // Reference dates for predictable status testing
    const now = new Date();
    const purchaseDate = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
    
    // Active date: > 180 days in future (e.g. +365 days)
    const activeExpiry = new Date(now.getFullYear(), now.getMonth() + 12, 1).toISOString().split('T')[0];
    
    // Expiring date: within 180 days in future (e.g. +60 days)
    const expiringExpiry = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString().split('T')[0];

    // Expired date: in the past (e.g. -30 days)
    const expiredExpiry = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];

    // -------------------------------------------------------------
    // TEST 1: Unauthenticated GET /api/products -> 401
    // -------------------------------------------------------------
    const unauthGetRes = await fetch(`${baseUrl}/products`, {
      method: 'GET',
    });
    const unauthGetData = (await unauthGetRes.json()) as any;
    record(
      '1. Unauthenticated GET /api/products → 401',
      unauthGetRes.status === 401 && unauthGetData?.status === 'error',
      `Status: ${unauthGetRes.status}, Message: "${unauthGetData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 2: Authenticated user can create product (201 Created)
    // -------------------------------------------------------------
    const createRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Dell Laptop',
        category: 'Electronics',
        brand: 'Dell',
        model: 'Inspiron 15',
        purchaseDate,
        warrantyStartDate: purchaseDate,
        warrantyExpiry: activeExpiry,
        retailer: 'Example Store',
        price: 65000,
        notes: 'Office laptop',
      }),
    });

    const createData = (await createRes.json()) as any;
    const isCreate201 = createRes.status === 201;
    const hasProduct = createData?.product && typeof createData.product.id === 'string';
    const productAId = createData?.product?.id;

    record(
      '2. Authenticated user can create product (201 Created)',
      isCreate201 && hasProduct,
      `Status: ${createRes.status}, Product ID: ${productAId}`
    );

    // -------------------------------------------------------------
    // TEST 3: Created product has correct calculated status ("active")
    // -------------------------------------------------------------
    const statusIsActive = createData?.product?.status === 'active';
    record(
      '3. Created product has correct calculated status ("active")',
      statusIsActive,
      `Calculated status: "${createData?.product?.status}"`
    );

    // -------------------------------------------------------------
    // TEST 4: Authenticated user can list own products (GET /api/products)
    // -------------------------------------------------------------
    const listARes = await fetch(`${baseUrl}/products`, {
      method: 'GET',
      headers: { Cookie: cookieUserA },
    });
    const listAData = (await listARes.json()) as any;
    const listAHasProducts = Array.isArray(listAData?.products) && listAData.products.length === 1;
    const listAFirstHasStatus = listAData?.products?.[0]?.status === 'active';

    record(
      '4. Authenticated user can list own products',
      listARes.status === 200 && listAHasProducts && listAFirstHasStatus,
      `Status: ${listARes.status}, Products count: ${listAData?.products?.length}`
    );

    // -------------------------------------------------------------
    // TEST 5: Authenticated user can retrieve own product (GET /api/products/:id)
    // -------------------------------------------------------------
    const getSingleRes = await fetch(`${baseUrl}/products/${productAId}`, {
      method: 'GET',
      headers: { Cookie: cookieUserA },
    });
    const getSingleData = (await getSingleRes.json()) as any;
    const getSingleMatches = getSingleData?.product?.id === productAId && getSingleData?.product?.name === 'Dell Laptop';

    record(
      '5. Authenticated user can retrieve own product',
      getSingleRes.status === 200 && getSingleMatches,
      `Status: ${getSingleRes.status}, Retrieved name: "${getSingleData?.product?.name}"`
    );

    // -------------------------------------------------------------
    // TEST 6: Authenticated user can update own product (PUT /api/products/:id)
    // -------------------------------------------------------------
    const updateRes = await fetch(`${baseUrl}/products/${productAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Dell Laptop Updated',
        price: 70000,
        warrantyExpiry: expiringExpiry, // status should now become "expiring"
      }),
    });
    const updateData = (await updateRes.json()) as any;
    const updateMatches = updateData?.product?.name === 'Dell Laptop Updated' &&
      updateData?.product?.price === 70000 &&
      updateData?.product?.status === 'expiring';

    record(
      '6. Authenticated user can update own product with updated status',
      updateRes.status === 200 && updateMatches,
      `Status: ${updateRes.status}, New Name: "${updateData?.product?.name}", New Status: "${updateData?.product?.status}"`
    );

    // -------------------------------------------------------------
    // TEST 7: Authenticated user can delete own product (DELETE /api/products/:id)
    // -------------------------------------------------------------
    // Create another product for user A specifically to delete
    const prodToDeleteRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Product to delete',
        purchaseDate,
        warrantyExpiry: activeExpiry,
      }),
    });
    const prodToDeleteData = (await prodToDeleteRes.json()) as any;
    const deleteTargetId = prodToDeleteData?.product?.id;

    const deleteRes = await fetch(`${baseUrl}/products/${deleteTargetId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieUserA },
    });
    const deleteData = (await deleteRes.json()) as any;

    record(
      '7. Authenticated user can delete own product',
      deleteRes.status === 200 && deleteData?.message === 'Product deleted successfully',
      `Status: ${deleteRes.status}, Message: "${deleteData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 8: Deleted product cannot be retrieved (404)
    // -------------------------------------------------------------
    const getDeletedRes = await fetch(`${baseUrl}/products/${deleteTargetId}`, {
      method: 'GET',
      headers: { Cookie: cookieUserA },
    });
    record(
      '8. Deleted product cannot be retrieved (404 Not Found)',
      getDeletedRes.status === 404,
      `Status: ${getDeletedRes.status}`
    );

    // -------------------------------------------------------------
    // SETUP FOR USER ISOLATION TESTS: User B creates a product
    // -------------------------------------------------------------
    const createProdBRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserB,
      },
      body: JSON.stringify({
        name: 'User B Product',
        purchaseDate,
        warrantyExpiry: activeExpiry,
      }),
    });
    const prodBData = (await createProdBRes.json()) as any;
    const prodBId = prodBData?.product?.id;

    // -------------------------------------------------------------
    // TEST 9: User A cannot retrieve User B's product (404)
    // -------------------------------------------------------------
    const getBByARes = await fetch(`${baseUrl}/products/${prodBId}`, {
      method: 'GET',
      headers: { Cookie: cookieUserA },
    });
    record(
      '9. User A cannot retrieve User B\'s product (404 Not Found)',
      getBByARes.status === 404,
      `Status: ${getBByARes.status}`
    );

    // -------------------------------------------------------------
    // TEST 10: User A cannot update User B's product (404)
    // -------------------------------------------------------------
    const updateBByARes = await fetch(`${baseUrl}/products/${prodBId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Malicious update attempt',
      }),
    });
    record(
      '10. User A cannot update User B\'s product (404 Not Found)',
      updateBByARes.status === 404,
      `Status: ${updateBByARes.status}`
    );

    // -------------------------------------------------------------
    // TEST 11: User A cannot delete User B's product (404)
    // -------------------------------------------------------------
    const deleteBByARes = await fetch(`${baseUrl}/products/${prodBId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieUserA },
    });
    record(
      '11. User A cannot delete User B\'s product (404 Not Found)',
      deleteBByARes.status === 404,
      `Status: ${deleteBByARes.status}`
    );

    // Verify User B's product was not deleted
    const checkBRes = await fetch(`${baseUrl}/products/${prodBId}`, {
      method: 'GET',
      headers: { Cookie: cookieUserB },
    });
    const checkBData = (await checkBRes.json()) as any;
    if (checkBRes.status !== 200 || checkBData?.product?.name !== 'User B Product') {
      throw new Error('User B product was unexpectedly modified or deleted!');
    }

    // -------------------------------------------------------------
    // TEST 12: Invalid product data → 400 Bad Request
    // -------------------------------------------------------------
    const invalidNameRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: '   ', // Blank name
        purchaseDate,
        warrantyExpiry: activeExpiry,
      }),
    });
    record(
      '12. Invalid product data (blank name) → 400 Bad Request',
      invalidNameRes.status === 400,
      `Status: ${invalidNameRes.status}`
    );

    // -------------------------------------------------------------
    // TEST 13: Invalid ObjectId format → 400 Bad Request
    // -------------------------------------------------------------
    const invalidIdRes = await fetch(`${baseUrl}/products/not-a-valid-objectid`, {
      method: 'GET',
      headers: { Cookie: cookieUserA },
    });
    record(
      '13. Invalid ObjectId format → 400 Bad Request',
      invalidIdRes.status === 400,
      `Status: ${invalidIdRes.status}`
    );

    // -------------------------------------------------------------
    // TEST 14: Warranty expiry before purchase date → 400 Bad Request
    // -------------------------------------------------------------
    const invalidDatesRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Date Test Item',
        purchaseDate: '2026-06-01',
        warrantyExpiry: '2026-05-01', // Earlier than purchase date!
      }),
    });
    const invalidDatesData = (await invalidDatesRes.json()) as any;
    record(
      '14. Warranty expiry before purchase date → 400 Bad Request',
      invalidDatesRes.status === 400,
      `Status: ${invalidDatesRes.status}, Message: "${invalidDatesData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 15: Negative price → 400 Bad Request
    // -------------------------------------------------------------
    const negPriceRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Negative Price Item',
        purchaseDate,
        warrantyExpiry: activeExpiry,
        price: -500, // Invalid negative price
      }),
    });
    record(
      '15. Negative price → 400 Bad Request',
      negPriceRes.status === 400,
      `Status: ${negPriceRes.status}`
    );

    // -------------------------------------------------------------
    // TEST 16: Status changes correctly based on warrantyExpiry (expired, expiring, active)
    // -------------------------------------------------------------
    // 16a. Expired product creation
    const expiredRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Old Keyboard',
        purchaseDate: new Date(now.getFullYear() - 2, now.getMonth(), 1).toISOString().split('T')[0],
        warrantyExpiry: expiredExpiry,
      }),
    });
    const expiredData = (await expiredRes.json()) as any;
    const isExpired = expiredData?.product?.status === 'expired';

    // 16b. Expiring product creation
    const expiringRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Headphones',
        purchaseDate,
        warrantyExpiry: expiringExpiry,
      }),
    });
    const expiringData = (await expiringRes.json()) as any;
    const isExpiring = expiringData?.product?.status === 'expiring';

    // 16c. Active product creation
    const activeRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        name: 'Monitor',
        purchaseDate,
        warrantyExpiry: activeExpiry,
      }),
    });
    const activeData = (await activeRes.json()) as any;
    const isActive = activeData?.product?.status === 'active';

    record(
      '16. Status dynamically calculates "expired", "expiring", and "active"',
      isExpired && isExpiring && isActive,
      `Expired item status: "${expiredData?.product?.status}", Expiring item status: "${expiringData?.product?.status}", Active item status: "${activeData?.product?.status}"`
    );

    // -------------------------------------------------------------
    // TEST 17: Product response never exposes passwordHash or unrelated user data
    // -------------------------------------------------------------
    const allProductsRes = await fetch(`${baseUrl}/products`, {
      method: 'GET',
      headers: { Cookie: cookieUserA },
    });
    const allProductsData = (await allProductsRes.json()) as any;
    let safeResponses = true;
    for (const p of allProductsData?.products || []) {
      if ('passwordHash' in p || 'password' in p || '__v' in p || '_id' in p || 'userId' in p) {
        safeResponses = false;
        break;
      }
    }
    record(
      '17. Product responses never expose passwordHash, internal fields, or userId',
      safeResponses && allProductsData?.products?.length > 0,
      `Verified all ${allProductsData?.products?.length} products are properly sanitized.`
    );

    // -------------------------------------------------------------
    // TEST 18: Health check continues to work
    // -------------------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = (await healthRes.json()) as any;
    record(
      '18. Health check (GET /api/health) returns 200 OK',
      healthRes.status === 200 && healthData?.status === 'ok',
      `Status: ${healthRes.status}, Body: ${JSON.stringify(healthData)}`
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    record('Product Test Suite Execution', false, undefined, err.message);
  } finally {
    // Cleanup test data
    await User.deleteMany({ email: /test-prod.*@example\.com/i });
    await Product.deleteMany({});
    server.close();
    await disconnectDatabase();
  }

  // Summary
  console.log('\n=============================================');
  console.log('            PRODUCT TEST SUMMARY             ');
  console.log('=============================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Total: ${totalCount}, Passed: ${passedCount}, Failed: ${totalCount - passedCount}`);

  if (passedCount === totalCount) {
    console.log('\n🎉 ALL PRODUCT TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('\n❌ SOME PRODUCT TESTS FAILED!\n');
    process.exit(1);
  }
};

runProductTests();
