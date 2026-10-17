import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { User } from './models/user.model';

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

const runTests = async () => {
  console.log('\n=============================================');
  console.log('  STARTING QUICKCLAIM AUTHENTICATION TESTS   ');
  console.log('=============================================\n');

  // 1. Connect to DB
  await connectDatabase();

  // Clean test database collection
  await User.deleteMany({ email: /test.*@example\.com/i });

  const app = createApp();
  const server = http.createServer(app);

  const port = 5099;
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on port ${port}\n`);
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Valid Registration
    // -------------------------------------------------------------
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Morgan',
        email: 'alex.test@example.com',
        password: 'strong-password-123',
      }),
    });

    const regData = (await regRes.json()) as any;
    const isReg201 = regRes.status === 201;
    const hasUserObj = regData?.user && typeof regData.user.id === 'string';
    const hasCorrectName = regData?.user?.name === 'Alex Morgan';
    const hasCorrectEmail = regData?.user?.email === 'alex.test@example.com';
    const noPasswordHashInReg = regData?.user?.passwordHash === undefined && regData?.passwordHash === undefined;

    record(
      'Valid Registration (POST /api/auth/register)',
      isReg201 && hasUserObj && hasCorrectName && hasCorrectEmail && noPasswordHashInReg,
      `Status: ${regRes.status}, User ID: ${regData?.user?.id}, email: ${regData?.user?.email}, passwordHash returned: ${!noPasswordHashInReg}`
    );

    // -------------------------------------------------------------
    // TEST 2: Duplicate Email Registration (Case Insensitive)
    // -------------------------------------------------------------
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Duplicate',
        email: 'ALEX.TEST@EXAMPLE.COM', // Uppercase to test normalization
        password: 'another-password-123',
      }),
    });

    const dupData = (await dupRes.json()) as any;
    const isDup409 = dupRes.status === 409;
    const hasSafeErrorMessage = dupData?.status === 'error' && dupData?.message === 'Email is already registered';

    record(
      'Duplicate Email Registration with Case Insensitivity',
      isDup409 && hasSafeErrorMessage,
      `Status: ${dupRes.status}, Message: "${dupData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 3: Invalid Registration Input Validation
    // -------------------------------------------------------------
    // 3a. Missing Name
    const invNameRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '   ',
        email: 'valid.email@example.com',
        password: 'password123',
      }),
    });
    const invNameData = (await invNameRes.json()) as any;
    record(
      'Registration Rejects Missing/Blank Name (400 Bad Request)',
      invNameRes.status === 400,
      `Status: ${invNameRes.status}, Message: "${invNameData?.message}"`
    );

    // 3b. Invalid Email
    const invEmailRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'not-an-email',
        password: 'password123',
      }),
    });
    const invEmailData = (await invEmailRes.json()) as any;
    record(
      'Registration Rejects Invalid Email Format (400 Bad Request)',
      invEmailRes.status === 400,
      `Status: ${invEmailRes.status}, Message: "${invEmailData?.message}"`
    );

    // 3c. Short Password
    const invPassRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'shortpass.test@example.com',
        password: 'short',
      }),
    });
    const invPassData = (await invPassRes.json()) as any;
    record(
      'Registration Rejects Password Under 8 Characters (400 Bad Request)',
      invPassRes.status === 400,
      `Status: ${invPassRes.status}, Message: "${invPassData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 4: Valid Login
    // -------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.test@example.com',
        password: 'strong-password-123',
      }),
    });

    const loginData = (await loginRes.json()) as any;
    const cookieHeader = loginRes.headers.get('set-cookie') || '';
    const isLogin200 = loginRes.status === 200;
    const hasLoginUser = loginData?.user?.email === 'alex.test@example.com';
    const noTokenInBody = loginData?.token === undefined;
    const noPasswordHashInLogin = loginData?.user?.passwordHash === undefined;
    const hasHttpOnlyCookie = cookieHeader.includes('token=') && cookieHeader.toLowerCase().includes('httponly');

    record(
      'Valid Login (POST /api/auth/login)',
      isLogin200 && hasLoginUser && noTokenInBody && noPasswordHashInLogin && hasHttpOnlyCookie,
      `Status: ${loginRes.status}, HttpOnly Cookie: ${hasHttpOnlyCookie}, Token in Body: ${!noTokenInBody}, Set-Cookie: "${cookieHeader}"`
    );

    // Extract cookie for authenticated requests
    const authCookie = cookieHeader.split(';')[0];

    // -------------------------------------------------------------
    // TEST 5: Invalid Login Credentials
    // -------------------------------------------------------------
    // 5a. Wrong password
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.test@example.com',
        password: 'wrong-password-xyz',
      }),
    });
    const wrongPassData = (await wrongPassRes.json()) as any;
    record(
      'Login Rejects Incorrect Password (401 Unauthorized generic)',
      wrongPassRes.status === 401 && wrongPassData?.message === 'Invalid email or password',
      `Status: ${wrongPassRes.status}, Message: "${wrongPassData?.message}"`
    );

    // 5b. Non-existent email
    const nonExistRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent.test@example.com',
        password: 'any-password',
      }),
    });
    const nonExistData = (await nonExistRes.json()) as any;
    record(
      'Login Rejects Non-Existent Email (401 Unauthorized generic)',
      nonExistRes.status === 401 && nonExistData?.message === 'Invalid email or password',
      `Status: ${nonExistRes.status}, Message: "${nonExistData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 6: GET /api/auth/me (Authenticated)
    // -------------------------------------------------------------
    const meAuthRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Cookie: authCookie,
      },
    });

    const meAuthData = (await meAuthRes.json()) as any;
    const isMe200 = meAuthRes.status === 200;
    const meMatchesUser = meAuthData?.user?.email === 'alex.test@example.com';
    const noPasswordHashInMe = meAuthData?.user?.passwordHash === undefined;

    record(
      'GET /api/auth/me (Authenticated with valid cookie)',
      isMe200 && meMatchesUser && noPasswordHashInMe,
      `Status: ${meAuthRes.status}, User: ${JSON.stringify(meAuthData?.user)}`
    );

    // -------------------------------------------------------------
    // TEST 7: GET /api/auth/me (Unauthenticated - No Cookie)
    // -------------------------------------------------------------
    const meUnauthRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
    });
    const meUnauthData = (await meUnauthRes.json()) as any;
    record(
      'GET /api/auth/me (Unauthenticated - Missing Cookie)',
      meUnauthRes.status === 401,
      `Status: ${meUnauthRes.status}, Message: "${meUnauthData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 8: GET /api/auth/me (Invalid / Tampered Cookie)
    // -------------------------------------------------------------
    const meTamperedRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Cookie: 'token=invalid.tampered.jwttokenhere',
      },
    });
    const meTamperedData = (await meTamperedRes.json()) as any;
    record(
      'GET /api/auth/me (Invalid / Tampered Token)',
      meTamperedRes.status === 401,
      `Status: ${meTamperedRes.status}, Message: "${meTamperedData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 9: POST /api/auth/logout
    // -------------------------------------------------------------
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: {
        Cookie: authCookie,
      },
    });
    const logoutData = (await logoutRes.json()) as any;
    const logoutCookieHeader = logoutRes.headers.get('set-cookie') || '';
    const isLogout200 = logoutRes.status === 200;
    const hasSuccessMessage = logoutData?.message === 'Logged out successfully';
    const cookieCleared = logoutCookieHeader.includes('token=;') || logoutCookieHeader.includes('Expires=Thu, 01 Jan 1970') || logoutCookieHeader.includes('Max-Age=0');

    record(
      'POST /api/auth/logout (Clears Auth Cookie)',
      isLogout200 && hasSuccessMessage && cookieCleared,
      `Status: ${logoutRes.status}, Message: "${logoutData?.message}", Set-Cookie: "${logoutCookieHeader}"`
    );

    // -------------------------------------------------------------
    // TEST 10: Safe Logout when already logged out
    // -------------------------------------------------------------
    const logoutAgainRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
    });
    const logoutAgainData = (await logoutAgainRes.json()) as any;
    record(
      'POST /api/auth/logout is idempotent and safe when unauthenticated',
      logoutAgainRes.status === 200 && logoutAgainData?.message === 'Logged out successfully',
      `Status: ${logoutAgainRes.status}, Message: "${logoutAgainData?.message}"`
    );

    // -------------------------------------------------------------
    // TEST 11: GET /api/auth/me After Logout
    // -------------------------------------------------------------
    const meAfterLogoutRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Cookie: logoutCookieHeader.split(';')[0], // cleared cookie
      },
    });
    record(
      'GET /api/auth/me Rejected After Logout (401 Unauthorized)',
      meAfterLogoutRes.status === 401,
      `Status: ${meAfterLogoutRes.status}`
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    record('Test Suite Execution', false, undefined, err.message);
  } finally {
    // Clean up test records
    await User.deleteMany({ email: /test.*@example\.com/i });
    server.close();
    await disconnectDatabase();
  }

  // Summary
  console.log('\n=============================================');
  console.log('               TEST SUMMARY                  ');
  console.log('=============================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Total: ${totalCount}, Passed: ${passedCount}, Failed: ${totalCount - passedCount}`);

  if (passedCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
};

runTests();
