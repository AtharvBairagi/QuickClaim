import mongoose from 'mongoose';
import { app } from './app';
import { User } from './models/user.model';
import { Product } from './models/product.model';
import { Receipt } from './models/receipt.model';
import { config } from './config/env';
import fs from 'fs';
import path from 'path';

// Define a simple mock fetch since Node 18+ has built-in fetch
const API_URL = `http://localhost:${config.port}/api`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

// Utilities for multipart/form-data creation without external libraries
const createMultipartFormData = (boundary: string, name: string, filename: string, contentType: string, content: Buffer) => {
  const crlf = '\r\n';
  const header = `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"; filename="${filename}"${crlf}Content-Type: ${contentType}${crlf}${crlf}`;
  const footer = `${crlf}--${boundary}--${crlf}`;
  return Buffer.concat([Buffer.from(header, 'utf8'), content, Buffer.from(footer, 'utf8')]);
};

async function runTests() {
  console.log('Starting Receipt Management Tests...\n');
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

  // Ensure test server is running
  let server: any;
  try {
    await mongoose.connect(config.mongoUri);
    // Clean up DB before tests
    await User.deleteMany({});
    await Product.deleteMany({});
    await Receipt.deleteMany({});
    server = app.listen(config.port);
  } catch (err) {
    console.error('Failed to start test server:', err);
    process.exit(1);
  }

  // Create temporary test files
  const testFilesDir = path.join(process.cwd(), 'test-uploads-temp');
  if (!fs.existsSync(testFilesDir)) fs.mkdirSync(testFilesDir);
  const pdfPath = path.join(testFilesDir, 'test-receipt.pdf');
  fs.writeFileSync(pdfPath, 'dummy pdf content for testing');
  
  const textPath = path.join(testFilesDir, 'test-doc.txt');
  fs.writeFileSync(textPath, 'dummy text content');

  // Large file simulation (we won't write 10MB to disk, we'll construct the buffer directly)
  const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a'); // 11 MB

  let userCookie: string;
  let userBcookie: string;
  let productId: string;
  let productBId: string;
  let receiptId: string;
  let receiptFilename: string;

  try {
    // ---------------------------------------------------------
    // Setup
    // ---------------------------------------------------------
    // Register User A
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: 'userA@test.com', password: 'password123' })
    });
    const loginA = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userA@test.com', password: 'password123' })
    });
    userCookie = (loginA.headers.get('set-cookie') || '').split(';')[0];

    // Register User B
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: 'userB@test.com', password: 'password123' })
    });
    const loginB = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userB@test.com', password: 'password123' })
    });
    userBcookie = (loginB.headers.get('set-cookie') || '').split(';')[0];

    // Create Product for User A
    const prodA = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
      body: JSON.stringify({ name: 'Prod A', purchaseDate: '2026-01-01', warrantyExpiry: '2027-01-01' })
    });
    const prodAData = await prodA.json();
    if (!prodAData.product) throw new Error('Product A creation failed: ' + JSON.stringify(prodAData));
    productId = prodAData.product.id;

    // Create Product for User B
    const prodB = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userBcookie },
      body: JSON.stringify({ name: 'Prod B', purchaseDate: '2026-01-01', warrantyExpiry: '2027-01-01' })
    });
    const prodBData = await prodB.json();
    if (!prodBData.product) throw new Error('Product B creation failed: ' + JSON.stringify(prodBData));
    productBId = prodBData.product.id;

    // ---------------------------------------------------------
    // Unauthenticated Tests (1-4)
    // ---------------------------------------------------------
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const uploadBody = createMultipartFormData(boundary, 'file', 'test-receipt.pdf', 'application/pdf', fs.readFileSync(pdfPath));
    const uploadHeaders = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };

    const unauthUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { method: 'POST', headers: uploadHeaders, body: uploadBody });
    assert(unauthUpload.status === 401, '1. Unauthenticated upload -> 401');

    const unauthMeta = await fetch(`${API_URL}/products/${productId}/receipt`);
    assert(unauthMeta.status === 401, '2. Unauthenticated metadata request -> 401');

    const unauthDown = await fetch(`${API_URL}/products/${productId}/receipt/download`);
    assert(unauthDown.status === 401, '3. Unauthenticated download -> 401');

    const unauthDel = await fetch(`${API_URL}/products/${productId}/receipt`, { method: 'DELETE' });
    assert(unauthDel.status === 401, '4. Unauthenticated delete -> 401');

    // ---------------------------------------------------------
    // Core Upload & Retrieval (5-10)
    // ---------------------------------------------------------
    const authUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: uploadBody 
    });
    const uploadData = await authUpload.json();
    assert(authUpload.status === 201, '5. Authenticated user uploads valid PDF -> 201', `Status was ${authUpload.status}, Message: ${uploadData?.message}`);
    
    assert(uploadData.receipt && uploadData.receipt.productId === productId, '6. Receipt metadata is stored correctly');
    receiptId = uploadData.receipt.id;
    receiptFilename = uploadData.receipt.fileName;

    // Check physical file exists
    const dbReceipt = await Receipt.findById(receiptId);
    assert(dbReceipt !== null && fs.existsSync(dbReceipt.storagePath), '7. Physical file exists');

    const metaRes = await fetch(`${API_URL}/products/${productId}/receipt`, { headers: { 'Cookie': userCookie } });
    const metaData = await metaRes.json();
    assert(metaRes.status === 200 && metaData.receipt.id === receiptId, '8. Receipt metadata endpoint returns correct metadata');

    const downRes = await fetch(`${API_URL}/products/${productId}/receipt/download`, { headers: { 'Cookie': userCookie } });
    assert(downRes.status === 200 && downRes.headers.get('content-type') === 'application/pdf', '9. Download endpoint returns correct content type');
    
    const downBuffer = Buffer.from(await downRes.arrayBuffer());
    assert(downBuffer.toString() === 'dummy pdf content for testing', '10. Downloaded content matches uploaded file');

    // ---------------------------------------------------------
    // Validation & Conflicts (11-16)
    // ---------------------------------------------------------
    const dupUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: uploadBody 
    });
    assert(dupUpload.status === 409, '11. Duplicate receipt upload -> 409');

    const textUploadBody = createMultipartFormData(boundary, 'file', 'test-doc.txt', 'text/plain', fs.readFileSync(textPath));
    const badMimeUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: textUploadBody 
    });
    assert(badMimeUpload.status === 400, '12. Unsupported MIME type -> 400');

    const largeUploadBody = createMultipartFormData(boundary, 'file', 'large.pdf', 'application/pdf', largeBuffer);
    const largeUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: largeUploadBody 
    });
    assert(largeUpload.status === 400, '13. File larger than 10 MB -> rejected');

    // Missing file (no 'file' field in multipart)
    const missingBody = `--${boundary}\r\nContent-Disposition: form-data; name="other"\r\n\r\nvalue\r\n--${boundary}--\r\n`;
    const missUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: Buffer.from(missingBody, 'utf8') 
    });
    assert(missUpload.status === 400, '14. Missing file -> 400');

    const invProdUpload = await fetch(`${API_URL}/products/invalid-id/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: uploadBody 
    });
    assert(invProdUpload.status === 400, '15. Invalid product ObjectId -> 400');

    const nonExistId = new mongoose.Types.ObjectId().toString();
    const nonExistUpload = await fetch(`${API_URL}/products/${nonExistId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userCookie }, 
      body: uploadBody 
    });
    assert(nonExistUpload.status === 404, '16. Non-existent product -> 404');

    // ---------------------------------------------------------
    // Cross-User Security (17-20)
    // ---------------------------------------------------------
    const crossUpload = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'POST', 
      headers: { ...uploadHeaders, 'Cookie': userBcookie }, 
      body: uploadBody 
    });
    assert(crossUpload.status === 404, '17. User A cannot upload receipt to User B\'s product'); // Returns 404 because verifyProductOwnership fails

    const crossRead = await fetch(`${API_URL}/products/${productId}/receipt`, { headers: { 'Cookie': userBcookie } });
    assert(crossRead.status === 404, '18. User A cannot read User B\'s receipt');

    const crossDown = await fetch(`${API_URL}/products/${productId}/receipt/download`, { headers: { 'Cookie': userBcookie } });
    assert(crossDown.status === 404, '19. User A cannot download User B\'s receipt');

    const crossDel = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'DELETE',
      headers: { 'Cookie': userBcookie } 
    });
    assert(crossDel.status === 404, '20. User A cannot delete User B\'s receipt');

    // ---------------------------------------------------------
    // Deletion (21-24)
    // ---------------------------------------------------------
    const delRes = await fetch(`${API_URL}/products/${productId}/receipt`, { 
      method: 'DELETE',
      headers: { 'Cookie': userCookie } 
    });
    assert(delRes.status === 200, '21. User can delete own receipt');

    const dbReceiptAfter = await Receipt.findById(receiptId);
    assert(dbReceiptAfter === null, '22. Database receipt record is removed');

    assert(!fs.existsSync(dbReceipt!.storagePath), '23. Physical file is removed');

    const readAfterDel = await fetch(`${API_URL}/products/${productId}/receipt`, { headers: { 'Cookie': userCookie } });
    assert(readAfterDel.status === 404, '24. Getting deleted receipt -> 404');

    // ---------------------------------------------------------
    // Regressions (25-29) - We will verify 27 here, the rest via npm scripts
    // ---------------------------------------------------------
    const health = await fetch(`${API_URL}/health`);
    assert(health.status === 200, '27. GET /api/health still works');

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    // Cleanup
    if (server) server.close();
    await mongoose.disconnect();
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    if (fs.existsSync(textPath)) fs.unlinkSync(textPath);
    if (fs.existsSync(testFilesDir)) fs.rmdirSync(testFilesDir);
    
    // Also clean up any uploaded files in uploads/receipts if they leaked
    const receiptsDir = path.join(process.cwd(), config.uploadDir, 'receipts');
    if (fs.existsSync(receiptsDir)) {
      const files = fs.readdirSync(receiptsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(receiptsDir, file));
      }
    }

    console.log(`\nResults: ${passed}/${total} passed.`);
    if (passed === total && total > 0) {
      console.log(`${colors.green}All tests passed successfully!${colors.reset}`);
    } else {
      console.log(`${colors.red}Some tests failed.${colors.reset}`);
    }
    process.exit(passed === total ? 0 : 1);
  }
}

runTests();
