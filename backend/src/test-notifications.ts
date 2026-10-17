import mongoose from 'mongoose';
import { app } from './app';
import { User } from './models/user.model';
import { Product } from './models/product.model';
import { Ownership } from './models/ownership.model';
import { Notification } from './models/notification.model';
import { config } from './config/env';

const PORT = 5095;
const API_URL = `http://localhost:${PORT}/api`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

async function runTests() {
  console.log('=============================================');
  console.log('   STARTING WARRANTY NOTIFICATIONS TESTS     ');
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
    await User.deleteMany({ email: /.*@test-notif\.com/i });
    await Product.deleteMany({ name: /Test Notif Prod/i });
    await Ownership.deleteMany({});
    await Notification.deleteMany({});

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
  let userBId: string;
  let activeProdId: string;
  let expiringProdId: string;
  let expiredProdId: string;

  try {
    // ---------------------------------------------------------
    // Setup Users & Products
    // ---------------------------------------------------------
    // 1. User A (Owner)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Owner A', email: 'owner@test-notif.com', password: 'password123' }),
    });
    const loginA = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@test-notif.com', password: 'password123' }),
    });
    ownerCookie = (loginA.headers.get('set-cookie') || '').split(';')[0];

    // 2. User B (Shared with Owner A)
    const regB = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared B', email: 'shared@test-notif.com', password: 'password123' }),
    });
    const regBData = await regB.json();
    userBId = regBData.user.id;
    const loginB = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shared@test-notif.com', password: 'password123' }),
    });
    sharedCookie = (loginB.headers.get('set-cookie') || '').split(';')[0];

    // 3. User C (Unrelated)
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unrelated C', email: 'unrelated@test-notif.com', password: 'password123' }),
    });
    const loginC = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unrelated@test-notif.com', password: 'password123' }),
    });
    unrelatedCookie = (loginC.headers.get('set-cookie') || '').split(';')[0];

    const now = new Date();
    const purchaseDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
    const activeExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const expiringExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const expiredExpiry = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create Active Product (User A)
    const p1 = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ name: 'Test Notif Prod Active', purchaseDate, warrantyExpiry: activeExpiry }),
    });
    activeProdId = (await p1.json()).product.id;

    // Create Expiring Product (User A)
    const p2 = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ name: 'Test Notif Prod Expiring', purchaseDate, warrantyExpiry: expiringExpiry }),
    });
    expiringProdId = (await p2.json()).product.id;

    // Create Expired Product (User A)
    const p3 = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ name: 'Test Notif Prod Expired', purchaseDate, warrantyExpiry: expiredExpiry }),
    });
    expiredProdId = (await p3.json()).product.id;

    // Share Expiring Product and Expired Product with User B
    await fetch(`${API_URL}/products/${expiringProdId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-notif.com' }),
    });

    await fetch(`${API_URL}/products/${expiredProdId}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-notif.com' }),
    });

    // ---------------------------------------------------------
    // 1-4: Authentication Checks
    // ---------------------------------------------------------
    const unauthGet = await fetch(`${API_URL}/notifications`);
    assert(unauthGet.status === 401, '1. Unauthenticated GET notifications -> 401');

    const unauthGen = await fetch(`${API_URL}/notifications/generate`, { method: 'POST' });
    assert(unauthGen.status === 401, '2. Unauthenticated generation -> 401');

    const unauthCount = await fetch(`${API_URL}/notifications/unread-count`);
    assert(unauthCount.status === 401, '3. Unauthenticated unread count -> 401');

    const unauthMark = await fetch(`${API_URL}/notifications/507f1f77bcf86cd799439011/read`, { method: 'PATCH' });
    assert(unauthMark.status === 401, '4. Unauthenticated mark-read -> 401');

    // ---------------------------------------------------------
    // 5-7: Generation Rules (Active vs Expiring vs Expired)
    // ---------------------------------------------------------
    const genRes = await fetch(`${API_URL}/notifications/generate`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
    });
    assert(genRes.status === 200, 'Generation endpoint returned 200 OK');

    const ownerNotifsRes = await fetch(`${API_URL}/notifications`, { headers: { Cookie: ownerCookie } });
    const ownerNotifsData = await ownerNotifsRes.json();
    const ownerNotifs = ownerNotifsData.notifications || [];

    const hasActiveNotif = ownerNotifs.some((n: any) => n.productId === activeProdId);
    assert(!hasActiveNotif, '5. Active product produces no notification');

    const expiringNotif = ownerNotifs.find((n: any) => n.productId === expiringProdId);
    assert(
      expiringNotif &&
        expiringNotif.type === 'warranty_expiring' &&
        expiringNotif.title === 'Warranty expiring soon' &&
        expiringNotif.message.includes('Test Notif Prod Expiring'),
      '6. Expiring product produces warranty_expiring notification'
    );

    const expiredNotif = ownerNotifs.find((n: any) => n.productId === expiredProdId);
    assert(
      expiredNotif &&
        expiredNotif.type === 'warranty_expired' &&
        expiredNotif.title === 'Warranty expired' &&
        expiredNotif.message.includes('Test Notif Prod Expired'),
      '7. Expired product produces warranty_expired notification'
    );

    // ---------------------------------------------------------
    // 8-10: Recipient Verification (Owner, Shared, Unrelated)
    // ---------------------------------------------------------
    assert(ownerNotifs.length === 2, '8. Owner receives notification for both expiring and expired products');

    const sharedNotifsRes = await fetch(`${API_URL}/notifications`, { headers: { Cookie: sharedCookie } });
    const sharedNotifsData = await sharedNotifsRes.json();
    const sharedNotifs = sharedNotifsData.notifications || [];
    assert(
      sharedNotifs.length === 2 &&
        sharedNotifs.some((n: any) => n.productId === expiringProdId) &&
        sharedNotifs.some((n: any) => n.productId === expiredProdId),
      '9. Shared user receives notification for shared products'
    );

    const unrelatedNotifsRes = await fetch(`${API_URL}/notifications`, { headers: { Cookie: unrelatedCookie } });
    const unrelatedNotifsData = await unrelatedNotifsRes.json();
    const unrelatedNotifs = unrelatedNotifsData.notifications || [];
    assert(unrelatedNotifs.length === 0, '10. Unrelated user does not receive notification');

    // ---------------------------------------------------------
    // 11-14: Duplicate Prevention, User Isolation, Ordering, Count
    // ---------------------------------------------------------
    // Repeated generation
    await fetch(`${API_URL}/notifications/generate`, { method: 'POST', headers: { Cookie: ownerCookie } });
    await fetch(`${API_URL}/notifications/generate`, { method: 'POST', headers: { Cookie: sharedCookie } });

    const ownerNotifsAfter = await (await fetch(`${API_URL}/notifications`, { headers: { Cookie: ownerCookie } })).json();
    assert(ownerNotifsAfter.notifications.length === 2, '11. Repeated generation does not create duplicates');

    assert(
      ownerNotifsAfter.notifications.every((n: any) => n.productId === expiringProdId || n.productId === expiredProdId),
      "12. GET notifications returns only current user's notifications"
    );

    const dates = ownerNotifsAfter.notifications.map((n: any) => new Date(n.createdAt).getTime());
    const isSorted = dates.every((val: number, i: number, arr: number[]) => !i || arr[i - 1] >= val);
    assert(isSorted, '13. Notifications are newest first');

    const unreadCountRes = await fetch(`${API_URL}/notifications/unread-count`, { headers: { Cookie: ownerCookie } });
    const unreadCountData = await unreadCountRes.json();
    assert(unreadCountData.count === 2, '14. Unread count is correct (2 unread)');

    // ---------------------------------------------------------
    // 15-17: Mark as Read & Boundary Validation
    // ---------------------------------------------------------
    const targetNotifId = ownerNotifsAfter.notifications[0].id;
    const markRes = await fetch(`${API_URL}/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
    });
    const markData = await markRes.json();
    assert(markRes.status === 200 && markData.notification.read === true, '15. Mark notification as read works');

    const unreadAfterMark = await (await fetch(`${API_URL}/notifications/unread-count`, { headers: { Cookie: ownerCookie } })).json();
    assert(unreadAfterMark.count === 1, 'Unread count updated to 1 after marking 1 notification as read');

    // Attempt to mark owner's notification as read using User B (shared) or User C (unrelated)
    const unauthorizedMark = await fetch(`${API_URL}/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: unrelatedCookie },
    });
    assert(unauthorizedMark.status === 404, "16. Marking another user's notification -> 404");

    const invalidIdMark = await fetch(`${API_URL}/notifications/invalid-object-id/read`, {
      method: 'PATCH',
      headers: { Cookie: ownerCookie },
    });
    assert(invalidIdMark.status === 400, '17. Invalid notification ID -> 400');

    // ---------------------------------------------------------
    // 18-19: Shared Access Revocation Lifecycle
    // ---------------------------------------------------------
    // Create a new expiring product, but do NOT share it with User B
    const p4 = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ name: 'Test Notif Prod P4', purchaseDate, warrantyExpiry: expiringExpiry }),
    });
    const p4Id = (await p4.json()).product.id;

    // Share P4 with User B
    await fetch(`${API_URL}/products/${p4Id}/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: 'shared@test-notif.com' }),
    });

    // Revoke User B's access before generation for P4
    await fetch(`${API_URL}/products/${p4Id}/ownership/${userBId}`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });

    // Run generation again
    await fetch(`${API_URL}/notifications/generate`, { method: 'POST', headers: { Cookie: ownerCookie } });

    const sharedNotifsFinal = await (await fetch(`${API_URL}/notifications`, { headers: { Cookie: sharedCookie } })).json();
    const hasP4 = sharedNotifsFinal.notifications.some((n: any) => n.productId === p4Id);
    assert(!hasP4, '18. Removing shared access prevents future notifications for removed product');

    const stillHasOriginal = sharedNotifsFinal.notifications.some((n: any) => n.productId === expiringProdId);
    assert(stillHasOriginal, '19. Existing notification remains valid after access removal');

    // ---------------------------------------------------------
    // 26: Health Check
    // ---------------------------------------------------------
    const health = await fetch(`http://localhost:${PORT}/api/health`);
    assert(health.status === 200, '26. Health endpoint -> 200 OK');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    if (server) server.close();
    await User.deleteMany({ email: /.*@test-notif\.com/i });
    await Product.deleteMany({ name: /Test Notif Prod/i });
    await Ownership.deleteMany({});
    await Notification.deleteMany({});
    await mongoose.disconnect();

    console.log(`\nResults: ${passed}/${total} passed.`);
    if (passed === total && total > 0) {
      console.log(`${colors.green}All notification tests passed successfully!${colors.reset}`);
    } else {
      console.log(`${colors.red}Some tests failed.${colors.reset}`);
    }
    process.exit(passed === total ? 0 : 1);
  }
}

runTests();
