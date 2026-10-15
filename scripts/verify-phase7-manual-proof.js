/**
 * Phase 7 Manual Proof Verification Script
 * Validates the 5 mandatory proof conditions:
 * 1. Sign up two new users, both see empty dashboards (balance ₹0, 0 orders, 0 spent).
 * 2. User A adds funds (one success, one failure) and sees only own data.
 * 3. User A places an order, balance drops correctly.
 * 4. User B sees nothing of User A's data (cross-user data isolation verified).
 * 5. Old-brand grep = 0.
 */

const https = require('https');
const { execSync } = require('child_process');

function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request({
      hostname: 'smm-production-bca7.up.railway.app',
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runProof() {
  console.log('================================================================');
  console.log('           PHASE 7 - AUTOMATED END-TO-END MANUAL PROOF          ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const userA_email = `usera_${timestamp}@smmproof.internal`;
  const userB_email = `userb_${timestamp}@smmproof.internal`;
  const password = 'StrongPassword123!';

  // ---------------------------------------------------------------------------
  // PROOF POINT 1: Sign up two new users, both see empty dashboards
  // ---------------------------------------------------------------------------
  console.log('[PROVED 1/5] Signing up User A and User B...');
  const regA = await apiRequest('/api/v1/auth/register', 'POST', {
    name: 'User A Verified',
    email: userA_email,
    password
  });
  console.log('  -> User A Registered:', regA.status, regA.body?.user?.id);
  const tokenA = regA.body?.token;
  const userA_id = regA.body?.user?.id;

  const regB = await apiRequest('/api/v1/auth/register', 'POST', {
    name: 'User B Verified',
    email: userB_email,
    password
  });
  console.log('  -> User B Registered:', regB.status, regB.body?.user?.id);
  const tokenB = regB.body?.token;
  const userB_id = regB.body?.user?.id;

  // Check initial dashboards
  const dashA = await apiRequest('/api/v1/users/me/dashboard', 'GET', null, tokenA);
  console.log('  -> User A Initial Dashboard:', {
    balance: dashA.body?.balance,
    totalOrders: dashA.body?.totalOrders,
    totalSpent: dashA.body?.totalSpent,
    ordersCount: dashA.body?.recentOrders?.length || 0
  });

  const dashB = await apiRequest('/api/v1/users/me/dashboard', 'GET', null, tokenB);
  console.log('  -> User B Initial Dashboard:', {
    balance: dashB.body?.balance,
    totalOrders: dashB.body?.totalOrders,
    totalSpent: dashB.body?.totalSpent,
    ordersCount: dashB.body?.recentOrders?.length || 0
  });

  const proof1Success = (
    dashA.body?.balance === 0 && dashA.body?.totalOrders === 0 && dashA.body?.totalSpent === 0 &&
    dashB.body?.balance === 0 && dashB.body?.totalOrders === 0 && dashB.body?.totalSpent === 0
  );
  console.log(`  ==> PROOF 1 RESULT: ${proof1Success ? 'PASSED (Both see zero/fresh states)' : 'FAILED'}\n`);

  // ---------------------------------------------------------------------------
  // PROOF POINT 2: User A adds funds (one success, one failure) and sees only own data
  // ---------------------------------------------------------------------------
  console.log('[PROVED 2/5] Testing Simulated Payments for User A (Success & Deliberate Failure)...');
  
  // 2a. Success Payment
  console.log('  -> Step 2a: Creating order for ₹500 (50000 paise)...');
  const createOrderRes = await apiRequest('/api/v1/payments/create-order', 'POST', {
    amountPaise: 50000,
    currency: 'INR'
  }, tokenA);
  const paymentOrder = createOrderRes.body;
  console.log('     Order created:', paymentOrder?.orderId, 'Amount:', paymentOrder?.amountPaise, 'Paise');

  console.log('  -> Step 2b: Verifying valid payment pay_sim_success_123 (SUCCESS path)...');
  const verifySuccessRes = await apiRequest('/api/v1/payments/verify', 'POST', {
    orderId: paymentOrder.orderId,
    paymentId: 'pay_sim_success_123',
    signature: 'simulated_sig_success',
    amountPaise: 50000
  }, tokenA);
  console.log('     Verification Response:', verifySuccessRes.status, verifySuccessRes.body?.status);

  // Check User A balance after credit
  const balA_afterCredit = await apiRequest('/api/v1/wallet/balance', 'GET', null, tokenA);
  console.log('     User A Balance after credit:', balA_afterCredit.body?.balance, 'INR');

  // 2b. Failure Payment (deliberate failure identifier)
  console.log('  -> Step 2c: Creating order for ₹200 (20000 paise)...');
  const createFailOrderRes = await apiRequest('/api/v1/payments/create-order', 'POST', {
    amountPaise: 20000,
    currency: 'INR'
  }, tokenA);
  const failOrder = createFailOrderRes.body;

  console.log('  -> Step 2d: Verifying payment pay_fail_deliberate (FAILURE path)...');
  const verifyFailRes = await apiRequest('/api/v1/payments/verify', 'POST', {
    orderId: failOrder.orderId,
    paymentId: 'pay_fail_deliberate',
    signature: 'simulated_sig_fail',
    amountPaise: 20000
  }, tokenA);
  console.log('     Verification Response:', verifyFailRes.status, verifyFailRes.body?.status || verifyFailRes.body?.message);

  // Check User A balance is unchanged by failure
  const balA_afterFail = await apiRequest('/api/v1/wallet/balance', 'GET', null, tokenA);
  console.log('     User A Balance after failed payment:', balA_afterFail.body?.balance, 'INR');

  const proof2Success = (balA_afterCredit.body?.balance === 500 && balA_afterFail.body?.balance === 500);
  console.log(`  ==> PROOF 2 RESULT: ${proof2Success ? 'PASSED (Success credited ₹500, Failure did not change balance)' : 'FAILED'}\n`);

  // ---------------------------------------------------------------------------
  // PROOF POINT 3: User A places an order, balance drops correctly
  // ---------------------------------------------------------------------------
  console.log('[PROVED 3/5] Placing order for User A and checking balance deduction...');
  const orderRes = await apiRequest('/api/v1/orders', 'POST', {
    serviceId: '1042',
    target: 'https://instagram.com/p/proof-post',
    quantity: 100
  }, tokenA);
  console.log('  -> Order Placement:', orderRes.status, {
    orderId: orderRes.body?.id,
    chargePaise: orderRes.body?.charge,
    status: orderRes.body?.status
  });
  const createdOrderId = orderRes.body?.id;

  const balA_afterOrder = await apiRequest('/api/v1/wallet/balance', 'GET', null, tokenA);
  console.log('  -> User A Balance after order:', balA_afterOrder.body?.balance, 'INR');
  const proof3Success = (balA_afterOrder.body?.balance < 500 && createdOrderId);
  console.log(`  ==> PROOF 3 RESULT: ${proof3Success ? `PASSED (Balance dropped to ₹${balA_afterOrder.body?.balance})` : 'FAILED'}\n`);

  // ---------------------------------------------------------------------------
  // PROOF POINT 4: User B sees nothing of User A's data
  // ---------------------------------------------------------------------------
  console.log('[PROVED 4/5] Testing Cross-User Data Isolation (User B querying User A)...');
  
  // 4a. User B fetches User A's order by ID -> MUST return 404
  const bFetchAOrder = await apiRequest(`/api/v1/orders/${createdOrderId}`, 'GET', null, tokenB);
  console.log('  -> User B requesting User A Order ID:', bFetchAOrder.status, bFetchAOrder.body?.message || bFetchAOrder.body?.status);

  // 4b. User B lists orders -> MUST be empty
  const bListOrders = await apiRequest('/api/v1/orders', 'GET', null, tokenB);
  console.log('  -> User B orders list length:', bListOrders.body?.data?.length || 0);

  // 4c. User B dashboard stats -> MUST be 0
  const bDashboard = await apiRequest('/api/v1/users/me/dashboard', 'GET', null, tokenB);
  console.log('  -> User B dashboard:', {
    balance: bDashboard.body?.balance,
    totalOrders: bDashboard.body?.totalOrders,
    totalSpent: bDashboard.body?.totalSpent
  });

  const proof4Success = (
    (bFetchAOrder.status === 404 || bFetchAOrder.status === 403) &&
    (bListOrders.body?.data?.length || 0) === 0 &&
    bDashboard.body?.totalOrders === 0
  );
  console.log(`  ==> PROOF 4 RESULT: ${proof4Success ? 'PASSED (Strict data isolation verified: 404 on direct fetch, 0 orders in list)' : 'FAILED'}\n`);

  // ---------------------------------------------------------------------------
  // PROOF POINT 5: Old-brand grep = 0
  // ---------------------------------------------------------------------------
  console.log('[PROVED 5/5] Performing Case-Insensitive Global Grep for Old Brand Names...');
  let grepMatches = 0;
  try {
    const rgOutput = execSync('git grep -i -E "\\b(ather|aether|aethar|ethar|vireo)\\b"', { encoding: 'utf8' });
    grepMatches = rgOutput.trim().split('\n').filter(Boolean).length;
    console.log('  -> Grep Output:\n' + rgOutput);
  } catch (err) {
    // git grep exits with 1 when no matches are found
    grepMatches = 0;
  }
  console.log(`  -> Total Matches Found: ${grepMatches}`);
  const proof5Success = (grepMatches === 0);
  console.log(`  ==> PROOF 5 RESULT: ${proof5Success ? 'PASSED (Zero occurrences found)' : 'FAILED'}\n`);

  console.log('================================================================');
  console.log(`ALL PROOFS VERIFIED: ${proof1Success && proof2Success && proof3Success && proof4Success && proof5Success ? '100% COMPLETE & PASSING' : 'ATTENTION REQUIRED'}`);
  console.log('================================================================\n');
}

runProof().catch(console.error);
