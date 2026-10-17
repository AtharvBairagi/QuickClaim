import mongoose from 'mongoose';
import { app } from './app';
import { User } from './models/user.model';
import { Product } from './models/product.model';
import { Receipt } from './models/receipt.model';
import { Ownership } from './models/ownership.model';
import { config } from './config/env';
import fs from 'fs';
import path from 'path';

const PORT = 5096;
const API_URL = `http://localhost:${PORT}/api`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

const createMultipartFormData = (
  boundary: string,
  name: string,
  filename: string,
  contentType: string,
  content: Buffer
) => {
  const crlf = '\r\n';
  const header = `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"; filename="${filename}"${crlf}Content-Type: ${contentType}${crlf}${crlf}`;
  const footer = `${crlf}--${boundary}--${crlf}`;
  return Buffer.concat([Buffer.from(header, 'utf8'), content, Buffer.from(footer, 'utf8')]);
};

async function runTests() {
  console.log('=============================================');
  console.log('  STARTING SHARED OWNERSHIP (PART 4) TESTS   ');
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
    // Clean up DB before tests
    await User.deleteMany({ email: /.*@test-owner\.com/i });
    await Product.deleteMany({ name: /Test Product (X|Y)/i });
    await Ownership.deleteMany({});
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => {
        resolve();
      });
    });
  } catch (err) {
    console.error('Failed to start test server:', err);
    process.exit(1);
  }

  // Create temporary test files for receipt uploads
  const testFilesDir = path.join(process.cwd(), 'test-ownership-temp');
  if (!fs.existsSync(testFilesDir)) fs.mkdirSync(testFilesDir);
  const pdfPath = path.join(testFilesDir, 'ownership-receipt.pdf');
  fs.writeFileSync(pdfPath, 'dummy pdf content for ownership testing');

  const boundary = '----WebKitFormBoundaryOwnership7MA4';
  const uploadBody = createMultipartFormData(
    boundary,
    'file',
    'ownership-receipt.pdf',
    'application/pdf',
    fs.readFileSync(pdfPath)
  );
  const uploadHeaders = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };

  let ownerCookie: string;
  let sharedCookie: string;
  let unrelatedCookie: string;
  let userBId: string;
  let productId: string;
  let productYId: string;

  try {
    // ---------------------------------------------------------
    // Setup: 3 Users (Owner A, Shared B, Unrelated C)
    // ---------------------------------------------------------
    // User A (Owner)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Owner A', email: 'owner@test-owner.com', password: 'password123' }),
    });
    const loginA = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@test-owner.com', password: 'password123' }),
    });
    ownerCookie = (loginA.headers.get('set-cookie') || '').split(';')[0];

    // User B (Shared)
    const regB = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared B', email: 'shared@test-owner.com', password: 'password123' }),
    });
    const regBData = await regB.json();
    userBId = regBData.user.id;
    const loginB = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shared@test-owner.com', password: 'password123' }),
    });
    sharedCookie = (loginB.headers.get('set-cookie') || '').split(';')[0];

    // User C (Unrelated)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unrelated C', email: 'unrelated@test-owner.com', password: 'password123' }),
    });
    const loginC = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unrelated@test-owner.com', password: 'password123' }),
    });
    unrelatedCookie = (loginC.headers.get('set-cookie') || '').split(';')[0];

    // User A creates Product X
    const prodRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        name: 'Test Product X',
        category: 'Electronics',
        purchaseDate: '2026-01-01',
        warrantyExpiry: '2027-01-01',
      }),
    });
    const prodData = await prodRes.json();
    productId = prodData.product.id;

    // User A uploads receipt for Product X
    await fetch(`${API_URL}/products/${productId}/receipt`, {
      method: 'POST',
      headers: { ...uploadHeaders, Cookie: ownerCookie },
      body: uploadBody,
    });

    // User C creates Product Y (private to User C)
    const prodYRes = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: unrelatedCookie },
      body: JSON.stringify({
        name: 'Test Product Y',
        category: 'Appliances',
        purchaseDate: '2026-01-01',
        warrantyExpiry: '2027-01-01',
      }),
    });
    const prodYData = await prodYRes.json();
    productYId = prodYData.product.id;

    // ---------------------------------------------------------
    // Authentication (1-3)
    // ---------------------------------------------------------
    const unauthShare = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shared@test-owner.com' }),
    });
    assert(unauthShare.status === 401, '1. Unauthenticated share -> 401');

    const unauthList = await fetch(`${API_URL}/products/${productId}/ownership`);
    assert(unauthList.status === 401, '2. Unauthenticated ownership list -> 401');

    const unauthSharedWithMe = await fetch(`${API_URL}/products/shared-with-me`);
    assert(unauthSharedWithMe.status === 401, '3. Unauthenticated shared-products list -> 401');

    // ---------------------------------------------------------
    // Sharing (4-9)
    // ---------------------------------------------------------
    const shareRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-owner.com' }),
    });
    const shareData = await shareRes.json();
    assert(shareRes.status === 201, '4. Owner can share product with registered user -> 201');

    const hasNoHash = shareData?.ownership?.sharedWith && !('passwordHash' in shareData.ownership.sharedWith);
    assert(hasNoHash, '5. Returned shared user does not expose passwordHash');

    const invalidEmailRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'invalid-email-address' }),
    });
    assert(invalidEmailRes.status === 400, '6. Invalid email -> 400');

    const nonExistentUserRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'nobody_exists@test-owner.com' }),
    });
    assert(nonExistentUserRes.status === 404, '7. Non-existent target user -> 404');

    const selfShareRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'owner@test-owner.com' }),
    });
    assert(selfShareRes.status === 400, '8. Owner cannot share product with themselves -> 400');

    const dupShareRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-owner.com' }),
    });
    assert(dupShareRes.status === 409, '9. Duplicate share -> 409');

    // ---------------------------------------------------------
    // Authorization (10-12)
    // ---------------------------------------------------------
    const nonOwnerShareRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: unrelatedCookie },
      body: JSON.stringify({ email: 'unrelated@test-owner.com' }),
    });
    assert(nonOwnerShareRes.status === 404, '10. Non-owner (unrelated) cannot share owner product -> 404');

    const nonOwnerListRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      headers: { Cookie: unrelatedCookie },
    });
    assert(nonOwnerListRes.status === 404, '11. Non-owner (unrelated) cannot list owner sharing records -> 404');

    const nonOwnerRemoveRes = await fetch(`${API_URL}/products/${productId}/ownership/${userBId}`, {
      method: 'DELETE',
      headers: { Cookie: unrelatedCookie },
    });
    assert(nonOwnerRemoveRes.status === 404, '12. Non-owner (unrelated) cannot remove sharing -> 404');

    // ---------------------------------------------------------
    // Shared User Access & Permissions (13-21)
    // ---------------------------------------------------------
    const sharedWithMeRes = await fetch(`${API_URL}/products/shared-with-me`, {
      headers: { Cookie: sharedCookie },
    });
    const sharedWithMeData = await sharedWithMeRes.json();
    const productInSharedList = sharedWithMeData.products?.some((p: any) => p.id === productId);
    assert(sharedWithMeRes.status === 200 && productInSharedList, '13. Shared user appears in GET /shared-with-me');

    const sharedGetProdRes = await fetch(`${API_URL}/products/${productId}`, {
      headers: { Cookie: sharedCookie },
    });
    assert(sharedGetProdRes.status === 200, '14. Shared user can GET shared product -> 200');

    const sharedGetReceiptMetaRes = await fetch(`${API_URL}/products/${productId}/receipt`, {
      headers: { Cookie: sharedCookie },
    });
    assert(sharedGetReceiptMetaRes.status === 200, '15. Shared user can GET shared receipt metadata -> 200');

    const sharedDownloadReceiptRes = await fetch(`${API_URL}/products/${productId}/receipt/download`, {
      headers: { Cookie: sharedCookie },
    });
    assert(sharedDownloadReceiptRes.status === 200, '16. Shared user can download shared receipt -> 200');

    const sharedPutProdRes = await fetch(`${API_URL}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: sharedCookie },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert(sharedPutProdRes.status === 403, '17. Shared user cannot PUT product -> 403');

    const sharedDeleteProdRes = await fetch(`${API_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: { Cookie: sharedCookie },
    });
    assert(sharedDeleteProdRes.status === 403, '18. Shared user cannot DELETE product -> 403');

    const sharedUploadReceiptRes = await fetch(`${API_URL}/products/${productId}/receipt`, {
      method: 'POST',
      headers: { ...uploadHeaders, Cookie: sharedCookie },
      body: uploadBody,
    });
    assert(sharedUploadReceiptRes.status === 403, '19. Shared user cannot upload receipt -> 403');

    const sharedDeleteReceiptRes = await fetch(`${API_URL}/products/${productId}/receipt`, {
      method: 'DELETE',
      headers: { Cookie: sharedCookie },
    });
    assert(sharedDeleteReceiptRes.status === 403, '20. Shared user cannot DELETE receipt -> 403');

    const sharedShareProductRes = await fetch(`${API_URL}/products/${productId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sharedCookie },
      body: JSON.stringify({ email: 'unrelated@test-owner.com' }),
    });
    assert(sharedShareProductRes.status === 403, '21. Shared user cannot share product with another user -> 403');

    // ---------------------------------------------------------
    // Owner Operations (22-26)
    // ---------------------------------------------------------
    const ownerUpdateRes = await fetch(`${API_URL}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ name: 'Updated Product X' }),
    });
    assert(ownerUpdateRes.status === 200, '22. Owner can update product -> 200');

    const ownerDeleteReceiptRes = await fetch(`${API_URL}/products/${productId}/receipt`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });
    assert(ownerDeleteReceiptRes.status === 200, '23. Owner can delete receipt -> 200');

    const ownerUploadReceiptRes = await fetch(`${API_URL}/products/${productId}/receipt`, {
      method: 'POST',
      headers: { ...uploadHeaders, Cookie: ownerCookie },
      body: uploadBody,
    });
    assert(ownerUploadReceiptRes.status === 201, '24. Owner can upload receipt -> 201');

    const ownerDeleteReceiptRes2 = await fetch(`${API_URL}/products/${productId}/receipt`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });
    assert(ownerDeleteReceiptRes2.status === 200, '25. Owner can delete receipt again -> 200');

    const ownerRemoveShareRes = await fetch(`${API_URL}/products/${productId}/ownership/${userBId}`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });
    assert(ownerRemoveShareRes.status === 200, '26. Owner can remove shared access -> 200');

    // ---------------------------------------------------------
    // After Removal (27-30)
    // ---------------------------------------------------------
    const afterRemovalSharedWithMe = await fetch(`${API_URL}/products/shared-with-me`, {
      headers: { Cookie: sharedCookie },
    });
    const afterRemovalData = await afterRemovalSharedWithMe.json();
    const stillPresent = afterRemovalData.products?.some((p: any) => p.id === productId);
    assert(!stillPresent, '27. Removed user no longer appears in /shared-with-me');

    const removedGetProd = await fetch(`${API_URL}/products/${productId}`, {
      headers: { Cookie: sharedCookie },
    });
    assert(removedGetProd.status === 404, '28. Removed user can no longer GET the product -> 404');

    const removedGetReceipt = await fetch(`${API_URL}/products/${productId}/receipt`, {
      headers: { Cookie: sharedCookie },
    });
    assert(removedGetReceipt.status === 404, '29. Removed user can no longer GET receipt -> 404');

    const removedDownloadReceipt = await fetch(`${API_URL}/products/${productId}/receipt/download`, {
      headers: { Cookie: sharedCookie },
    });
    assert(removedDownloadReceipt.status === 404, '30. Removed user can no longer download receipt -> 404');

    // ---------------------------------------------------------
    // Security & Non-leakage (31-33)
    // ---------------------------------------------------------
    const userAAccessUserCProd = await fetch(`${API_URL}/products/${productYId}`, {
      headers: { Cookie: ownerCookie },
    });
    assert(userAAccessUserCProd.status === 404, "31. User A cannot access User C's private product -> 404");

    const userAAccessUserCReceipt = await fetch(`${API_URL}/products/${productYId}/receipt`, {
      headers: { Cookie: ownerCookie },
    });
    assert(userAAccessUserCReceipt.status === 404, "32. User A cannot access User C's private receipt -> 404");

    const userAManipulateCOwnership = await fetch(`${API_URL}/products/${productYId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-owner.com' }),
    });
    assert(userAManipulateCOwnership.status === 404, "33. User A cannot manipulate User C's ownership records -> 404");

    // ---------------------------------------------------------
    // Health Check (36)
    // ---------------------------------------------------------
    const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
    assert(healthRes.status === 200, '36. GET /api/health -> 200');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    // Cleanup
    if (server) server.close();
    await User.deleteMany({ email: /.*@test-owner\.com/i });
    await Product.deleteMany({ name: /Test Product (X|Y)/i });
    await Ownership.deleteMany({});
    await mongoose.disconnect();
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    if (fs.existsSync(testFilesDir)) fs.rmdirSync(testFilesDir);

    console.log(`\nResults: ${passed}/${total} passed.`);
    if (passed === total && total > 0) {
      console.log(`${colors.green}All ownership tests passed successfully!${colors.reset}`);
    } else {
      console.log(`${colors.red}Some tests failed.${colors.reset}`);
    }
    process.exit(passed === total ? 0 : 1);
  }
}

runTests();
