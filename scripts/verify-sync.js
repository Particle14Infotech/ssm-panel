const https = require('https');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, text: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('--- LOGGING IN AS ADMIN ---');
  const loginRes = await request(
    {
      hostname: 'smm-production-bca7.up.railway.app',
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      email: 'admin@smmpanel.internal',
      password: 'ChangeThisAdminPasswordNow!',
    }
  );

  console.log('Login Status:', loginRes.status, 'User Role:', loginRes.data?.user?.role);
  const token = loginRes.data?.token;
  if (!token) throw new Error('No access token returned: ' + JSON.stringify(loginRes.data));

  console.log('\n--- CHECKING USERS ---');
  const usersRes = await request({
    hostname: 'smm-production-bca7.up.railway.app',
    path: '/api/v1/users',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Total Users:', usersRes.data?.length);
  const userVaibhav = usersRes.data?.find((u) => u.email === 'vaibhavrishabh40@gmail.com');
  console.log('Vaibhav Account:', {
    id: userVaibhav?.id,
    email: userVaibhav?.email,
    role: userVaibhav?.role,
    balance: userVaibhav?.balance,
  });

  console.log('\n--- CHECKING ORDERS ---');
  const ordersRes = await request({
    hostname: 'smm-production-bca7.up.railway.app',
    path: '/api/v1/orders',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const orders = ordersRes.data?.orders || ordersRes.data || [];
  console.log('Total Admin Orders:', orders.length);
  if (orders.length > 0) {
    console.log('Recent 2 Orders:', orders.slice(0, 2).map((o) => ({
      id: o.id,
      user: o.user?.email,
      target: o.target,
      status: o.status,
      service: o.service?.name,
    })));
  }

  console.log('\n--- CHECKING TICKETS ---');
  const ticketsRes = await request({
    hostname: 'smm-production-bca7.up.railway.app',
    path: '/api/v1/tickets/admin/all',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const tickets = ticketsRes.data || [];
  console.log('Total Admin Tickets:', tickets.length);
  if (tickets.length > 0) {
    console.log('Recent 2 Tickets:', tickets.slice(0, 2).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      user: t.user?.email || t.userName,
    })));
  }

  console.log('\n--- CHECKING PROVIDER SYNC & BALANCES ---');
  const providersRes = await request({
    hostname: 'smm-production-bca7.up.railway.app',
    path: '/api/v1/providers',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const providers = providersRes.data || [];
  console.log('Providers:', providers.map((p) => ({
    name: p.name,
    balance: p.balance,
    currency: p.currency,
  })));
}

run().catch((e) => console.error('Error:', e.message));
