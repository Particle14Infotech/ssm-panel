const urls = [
  { name: 'API Live Health', url: 'https://smm-production-bca7.up.railway.app/health' },
  { name: 'Web Home Page', url: 'https://web-production-e4cdc5.up.railway.app/' },
  { name: 'Web Robots.txt', url: 'https://web-production-e4cdc5.up.railway.app/robots.txt' },
  { name: 'Web Sitemap.xml', url: 'https://web-production-e4cdc5.up.railway.app/sitemap.xml' },
  { name: 'Web About Page', url: 'https://web-production-e4cdc5.up.railway.app/about' },
  { name: 'Web Instagram Platform Page', url: 'https://web-production-e4cdc5.up.railway.app/platform/instagram' }
];

console.log('================================================================================');
console.log('              RAILWAY PRODUCTION LIVE URL SMOKE TEST                            ');
console.log('================================================================================');

async function testUrl({ name, url }) {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SMM-Quality-Gate-Smoke/1.0' } });
    const duration = Date.now() - start;
    const body = await res.text();
    console.log(`[HTTP ${res.status}] ${name} (${duration}ms) - ${url}`);
    if (res.status >= 200 && res.status < 400) {
      return true;
    } else {
      console.error(`  Error response preview: ${body.substring(0, 120)}`);
      return false;
    }
  } catch (err) {
    console.error(`[FAIL] ${name} (${url}): ${err.message}`);
    return false;
  }
}

async function main() {
  let allHealthy = true;
  for (const item of urls) {
    const ok = await testUrl(item);
    if (!ok) allHealthy = false;
  }
  console.log('================================================================================');
  if (allHealthy) {
    console.log('✅ ALL LIVE PRODUCTION ENDPOINTS RETURNED SUCCESS (200 OK)!');
    process.exit(0);
  } else {
    console.error('❌ One or more endpoints failed.');
    process.exit(1);
  }
}

main();
