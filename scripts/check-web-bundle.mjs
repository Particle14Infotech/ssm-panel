async function checkWebBundle() {
  const res = await fetch('https://web-production-e4cdc5.up.railway.app/admin/dashboard');
  const html = await res.text();
  console.log('HTML status:', res.status, 'HTML length:', html.length);
  const scripts = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]);
  console.log('Found script chunks:', scripts.length);
  for (const s of scripts) {
    const chunkRes = await fetch('https://web-production-e4cdc5.up.railway.app' + s);
    const chunkText = await chunkRes.text();
    if (chunkText.includes('smm-production-bca7') || chunkText.includes('localhost:4000') || chunkText.includes('/api/v1')) {
      console.log('Chunk has API references:', s);
      const matches = chunkText.match(/https?:\/\/[a-zA-Z0-9\.\-]+(?:\/api\/v1)?/g);
      console.log('URLs in chunk:', Array.from(new Set(matches)).filter(u => u.includes('smm') || u.includes('localhost')));
    }
  }
}
checkWebBundle();
