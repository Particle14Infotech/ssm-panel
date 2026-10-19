const fs = require('fs');

async function main() {
  const apiUrl = process.env.PROVIDER_API_URL || 'https://cheapestsmmpanels.com/api/v2';
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiKey) {
    console.error("PROVIDER_API_KEY required");
    process.exit(1);
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: apiKey, action: 'services' }).toString()
  });

  const services = await res.json();
  const dripTrueServices = services.filter(s => s.dripfeed === true);
  console.log('Count of dripfeed === true services:', dripTrueServices.length);
  
  console.log('\n--- The 20 services with dripfeed === true ---');
  for (const s of dripTrueServices) {
    console.log(`ID: ${s.service} | Category: "${s.category}" | Name: "${s.name}" | Rate: ${s.rate} | Min: ${s.min} | Max: ${s.max}`);
  }

  // Also check deployed DB for these 20 services!
  console.log('\n--- Checking deployed API for these 20 service IDs ---');
  const deployedRes = await fetch('https://smm-production-bca7.up.railway.app/api/v1/services');
  if (deployedRes.ok) {
    const deployedServices = await deployedRes.json();
    console.log(`Deployed DB has ${deployedServices.length} total services.`);
    
    for (const d of dripTrueServices) {
      const match = deployedServices.find(s => String(s.name) === String(d.name) || (s.providerServiceId && String(s.providerServiceId) === String(d.service)));
      if (match) {
        console.log(`Service #${d.service} found in deployed DB -> platform: ${match.platform}, dripFeedSupported: ${match.dripFeedSupported}`);
      } else {
        // Find by name match
        const nameMatch = deployedServices.find(s => s.name === d.name);
        console.log(`Service #${d.service} ("${d.name.slice(0, 30)}...") -> found: ${Boolean(nameMatch)}, dripFeedSupported: ${nameMatch?.dripFeedSupported}`);
      }
    }
  } else {
    console.log(`Deployed API returned HTTP ${deployedRes.status}`);
  }
}

main().catch(console.error);
