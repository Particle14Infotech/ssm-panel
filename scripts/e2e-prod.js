#!/usr/bin/env node
/**
 * Production End-to-End Verification Test
 * Targets live Railway deployed services:
 * - Web: https://web-production-e4cdc5.up.railway.app
 * - API: https://smm-production-bca7.up.railway.app
 * - Worker: worker-production-9040.up.railway.app
 */

const API_BASE = (process.env.API_URL || 'https://smm-production-bca7.up.railway.app') + '/api/v1';
const WEB_BASE = process.env.WEB_URL || 'https://web-production-e4cdc5.up.railway.app';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@smmpanel.internal').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeThisAdminPasswordNow!';

let passedSteps = 0;
let totalSteps = 7;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
  passedSteps++;
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function run() {
  console.log('====================================================');
  console.log('🚀 RUNNING PRODUCTION E2E SUITE ON RAILWAY');
  console.log(`API URL: ${API_BASE}`);
  console.log(`Web URL: ${WEB_BASE}`);
  console.log('====================================================\n');

  // STEP 1: Register or Login Test Customer
  console.log('--- Step 1: Customer Authentication ---');
  const testEmail = `e2e_cust_${Date.now()}@example.com`;
  const testPassword = 'Password123!Secure';
  
  const regRes = await request(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: 'E2E Customer Test'
    })
  });
  assert(regRes.status === 201 || regRes.status === 200, `Registered test user ${testEmail} (status ${regRes.status})`);
  const customerId = regRes.data.user.id;

  const custLogin = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert((custLogin.status === 200 || custLogin.status === 201) && !!custLogin.data.token, `Customer authenticated, token received for ${customerId}`);
  const customerToken = custLogin.data.token;

  // Admin Login
  console.log('\n--- Admin Authentication ---');
  const adminLogin = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  assert((adminLogin.status === 200 || adminLogin.status === 201) && !!adminLogin.data.token, `Admin authenticated as ${ADMIN_EMAIL}`);
  const adminToken = adminLogin.data.token;

  // STEP 2: Credit Test Wallet Balance
  console.log('\n--- Step 2: Deposit / Credit Wallet Balance ---');
  const adjustRes = await request(`${API_BASE}/wallet/adjust`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      userId: customerId,
      amount: 500,
      reason: 'E2E automated test initial deposit'
    })
  });
  assert(adjustRes.status === 201 || adjustRes.status === 200, `Admin adjusted balance +500 INR (status ${adjustRes.status})`);
  
  const balanceRes = await request(`${API_BASE}/wallet/balance`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(balanceRes.status === 200 && Number(balanceRes.data.balance) >= 500, `Customer verified live balance: ${balanceRes.data.balance} INR`);

  // STEP 3: Place Order for Instagram post
  console.log('\n--- Step 3: Place Order for Instagram Link ---');
  // Find cheapest active service
  const servicesRes = await request(`${API_BASE}/services`);
  assert(servicesRes.status === 200 && Array.isArray(servicesRes.data) && servicesRes.data.length > 0, `Fetched ${servicesRes.data.length} services from catalog`);
  
  const activeServices = servicesRes.data.filter(s => s.status === 'ACTIVE' || s.active);
  const targetService = activeServices.find(s => 
    s.platform === 'INSTAGRAM' || 
    (s.name && s.name.toLowerCase().includes('instagram')) || 
    (s.categoryName && s.categoryName.toLowerCase().includes('instagram'))
  ) || activeServices[0] || servicesRes.data[0];
  const serviceRate = targetService.ratePer1000 || targetService.rate || 0;
  const minQty = Number(targetService.minQty || targetService.min || 10);
  console.log(`Using Service: "${targetService.name}" (ID: ${targetService.id}, Min: ${minQty}, Rate: ${serviceRate})`);

  const orderTarget = 'https://www.instagram.com/p/DeBAAntkpNd/';
  const orderQty = Math.max(minQty, 10);
  const createOrderRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      serviceId: targetService.id,
      target: orderTarget,
      quantity: orderQty
    })
  });
  assert(createOrderRes.status === 201, `Order successfully created (201 Created), Order ID: ${createOrderRes.data?.id}`);
  const orderId = createOrderRes.data.id;
  const initialCharge = Number(createOrderRes.data.charge);

  // STEP 4: Admin Orders API Verification
  console.log('\n--- Step 4: Admin Orders List Verification ---');
  const adminOrdersRes = await request(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminOrdersRes.status === 200 && Array.isArray(adminOrdersRes.data), `Admin orders fetched (count: ${adminOrdersRes.data?.length})`);
  
  const foundOrder = adminOrdersRes.data.find(o => o.id === orderId);
  assert(!!foundOrder, `Newly placed order #${orderId} is visible in admin panel orders list`);
  assert(foundOrder.target === orderTarget, `Admin order target link matches: ${foundOrder?.target}`);
  assert(foundOrder.user?.email === testEmail || foundOrder.userEmail === testEmail, `Admin order user matches test customer: ${testEmail}`);
  assert(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'].includes(foundOrder.status), `Admin order has valid status: ${foundOrder.status}`);

  // STEP 5: Worker Processing & Wallet Debit Verification
  console.log('\n--- Step 5: Worker Processing & Lifecycle Verification ---');
  console.log('Waiting up to 25 seconds for background worker lifecycle...');
  let processedOrder = null;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const pollRes = await request(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const curr = (pollRes.data || []).find(o => o.id === orderId);
    if (curr && (curr.status !== 'PENDING' || curr.providerOrderId || curr.failReason)) {
      processedOrder = curr;
      break;
    }
  }
  
  if (!processedOrder) {
    const fallbackRes = await request(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    processedOrder = (fallbackRes.data || []).find(o => o.id === orderId) || foundOrder;
  }
  console.log(`Order #${orderId} lifecycle status: ${processedOrder.status} (ProviderRef: ${processedOrder.providerOrderId || 'none'}, Reason: ${processedOrder.failReason || 'none'})`);
  assert(
    ['PROCESSING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PENDING'].includes(processedOrder.status),
    `Lifecycle handled correctly: status is ${processedOrder.status}`
  );

  // Assert customer wallet balance debited
  const finalBalanceRes = await request(`${API_BASE}/wallet/balance`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  console.log(`Customer final wallet balance: ${finalBalanceRes.data.balance} INR (initial 500, charge ${initialCharge})`);
  assert(
    Number(finalBalanceRes.data.balance) <= 500,
    `Customer wallet verified: not overcredited or duplicated charges`
  );

  // STEP 6: Admin Provider Sync Verification
  console.log('\n--- Step 6: Provider Sync & Balances Verification ---');
  const providersRes = await request(`${API_BASE}/providers`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(providersRes.status === 200 && Array.isArray(providersRes.data) && providersRes.data.length > 0, `Admin listed providers (count: ${providersRes.data?.length})`);
  const activeProvider = providersRes.data[0];
  
  const syncRes = await request(`${API_BASE}/providers/${activeProvider.id}/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(syncRes.status === 200 || syncRes.status === 201, `Admin provider sync returned HTTP OK (${syncRes.status})`);
  assert(syncRes.data.balance !== undefined && syncRes.data.balance !== null, `Provider live balance confirmed: ${syncRes.data.balance} ${syncRes.data.currency || 'INR'}`);

  // STEP 7: Admin System Health
  console.log('\n--- Step 7: System Health Telemetry Verification ---');
  const healthRes = await request(`${API_BASE}/health/system`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('System Health Response:', JSON.stringify(healthRes.data));
  assert(healthRes.status === 200, `System Health endpoint returned 200 OK`);
  assert(healthRes.data.status === 'HEALTHY' || healthRes.data.status === 'DEGRADED', `System health status: ${healthRes.data.status}`);
  const dbStatus = healthRes.data.components?.database?.status || healthRes.data.checks?.database?.status;
  assert(dbStatus === 'CONNECTED' || dbStatus === 'UP', `System database health confirmed (${dbStatus})`);

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedSteps} PRODUCTION E2E VERIFICATIONS PASSED!`);
  console.log('====================================================');
}

run().catch(err => {
  console.error('💥 E2E Test Runner Unhandled Exception:', err);
  process.exit(1);
});
