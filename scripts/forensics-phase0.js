const fs = require('fs');
const path = require('path');

async function runForensics() {
  const apiUrl = process.env.PROVIDER_API_URL || "https://cheapestsmmpanels.com/api/v2";
  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiKey) {
    console.error("PROVIDER_API_KEY environment variable required");
    process.exit(1);
  }

  console.log("=== PHASE 0: FORENSICS ===");
  console.log(`Provider URL: ${apiUrl}`);
  console.log(`API Key set: ${Boolean(apiKey)} (Length: ${apiKey ? apiKey.length : 0})`);

  console.log("\n1. Fetching raw services from provider action=services...");
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "services" }).toString()
  });

  console.log(`HTTP Status: ${res.status} ${res.statusText}`);
  const rawText = await res.text();
  console.log(`Raw response length: ${rawText.length} bytes`);

  let services;
  try {
    services = JSON.parse(rawText);
  } catch (err) {
    console.error("Failed to parse JSON response:", err.message);
    console.log("Raw preview:", rawText.slice(0, 500));
    return;
  }

  if (!Array.isArray(services)) {
    console.error("Response is NOT an array:", services);
    return;
  }

  console.log(`Total services returned by provider: ${services.length}`);

  // Sample 3 raw services
  console.log("\n--- Sample of 3 raw service objects ---");
  const sample3 = services.slice(0, 3);
  console.log(JSON.stringify(sample3, null, 2));

  // Also look at keys across all services
  const allKeys = new Set();
  services.forEach(s => Object.keys(s).forEach(k => allKeys.add(k)));
  console.log("\nAll unique keys found across all services:", Array.from(allKeys));

  // Check any key containing 'drip'
  const dripRelatedKeys = Array.from(allKeys).filter(k => k.toLowerCase().includes("drip"));
  console.log("Keys containing 'drip':", dripRelatedKeys);

  // Analyze dripfeed, refill, cancel distributions
  function analyzeField(fieldName) {
    const typeDistribution = {};
    const valueDistribution = {};
    let truthyCount = 0;
    let falsyCount = 0;

    for (const s of services) {
      const val = s[fieldName];
      const type = typeof val;
      const typeKey = val === null ? "null" : val === undefined ? "undefined" : type;
      typeDistribution[typeKey] = (typeDistribution[typeKey] || 0) + 1;

      const repr = JSON.stringify(val);
      valueDistribution[repr] = (valueDistribution[repr] || 0) + 1;

      if (val) truthyCount++;
      else falsyCount++;
    }

    return { typeDistribution, valueDistribution, truthyCount, falsyCount };
  }

  console.log("\n--- Field Distribution: dripfeed ---");
  const dripfeedAnalysis = analyzeField("dripfeed");
  console.log("Types:", JSON.stringify(dripfeedAnalysis.typeDistribution, null, 2));
  console.log("Values:", JSON.stringify(dripfeedAnalysis.valueDistribution, null, 2));
  console.log(`Truthy: ${dripfeedAnalysis.truthyCount}, Falsy: ${dripfeedAnalysis.falsyCount}`);

  console.log("\n--- Field Distribution: refill ---");
  const refillAnalysis = analyzeField("refill");
  console.log("Types:", JSON.stringify(refillAnalysis.typeDistribution, null, 2));
  console.log("Values:", JSON.stringify(refillAnalysis.valueDistribution, null, 2));
  console.log(`Truthy: ${refillAnalysis.truthyCount}, Falsy: ${refillAnalysis.falsyCount}`);

  console.log("\n--- Field Distribution: cancel ---");
  const cancelAnalysis = analyzeField("cancel");
  console.log("Types:", JSON.stringify(cancelAnalysis.typeDistribution, null, 2));
  console.log("Values:", JSON.stringify(cancelAnalysis.valueDistribution, null, 2));
  console.log(`Truthy: ${cancelAnalysis.truthyCount}, Falsy: ${cancelAnalysis.falsyCount}`);

  // Test every possible interpretation of dripfeed
  let countStrictTrue = 0;
  let countNum1 = 0;
  let countStr1 = 0;
  let countStrTrue = 0;
  let countStrYes = 0;
  let countAnyTruthy = 0;

  for (const s of services) {
    const val = s.dripfeed;
    if (val === true) countStrictTrue++;
    if (val === 1) countNum1++;
    if (val === "1") countStr1++;
    if (val === "true" || (typeof val === "string" && val.toLowerCase() === "true")) countStrTrue++;
    if (typeof val === "string" && val.toLowerCase() === "yes") countStrYes++;
    if (Boolean(val)) countAnyTruthy++;
  }

  console.log("\n--- Dripfeed Interpretations Count ---");
  console.log({
    countStrictTrue,
    countNum1,
    countStr1,
    countStrTrue,
    countStrYes,
    countAnyTruthy
  });

  // Services whose name or category mentions 'drip'
  const mentionsDrip = services.filter(s => {
    const name = (s.name || "").toLowerCase();
    const cat = (s.category || "").toLowerCase();
    const type = (s.type || "").toLowerCase();
    return name.includes("drip") || cat.includes("drip") || type.includes("drip");
  });

  console.log(`\nServices mentioning 'drip' in name, category, or type: ${mentionsDrip.length}`);
  if (mentionsDrip.length > 0) {
    console.log("Sample services mentioning drip:", JSON.stringify(mentionsDrip.slice(0, 5).map(s => ({
      service: s.service,
      name: s.name,
      category: s.category,
      type: s.type,
      dripfeed: s.dripfeed
    })), null, 2));
  }

  // Also check if any service has type !== "Default"
  const typesDistribution = {};
  services.forEach(s => {
    typesDistribution[s.type] = (typesDistribution[s.type] || 0) + 1;
  });
  console.log("\nService types distribution across provider:", typesDistribution);

  // Check balance and sample status to verify SMM v2 protocol
  console.log("\n--- Checking Provider Balance ---");
  const balRes = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "balance" }).toString()
  });
  const balJson = await balRes.json();
  console.log("Balance Response:", balJson);

  // Check sample error response behavior (e.g. invalid action or bad order id)
  console.log("\n--- Checking Provider SMM v2 Error Format ---");
  const errRes = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "status", order: "99999999999" }).toString()
  });
  console.log("Error call HTTP Status:", errRes.status);
  const errJson = await errRes.json();
  console.log("Error call Body:", errJson);

  // Save forensic dump for report
  const summary = {
    providerUrl: apiUrl,
    totalServices: services.length,
    allKeys: Array.from(allKeys),
    dripRelatedKeys,
    dripfeedAnalysis,
    refillAnalysis,
    cancelAnalysis,
    interpretations: {
      countStrictTrue,
      countNum1,
      countStr1,
      countStrTrue,
      countStrYes,
      countAnyTruthy
    },
    mentionsDripCount: mentionsDrip.length,
    typesDistribution,
    balance: balJson,
    sampleError: errJson
  };

  fs.writeFileSync(
    path.join(__dirname, '../DRIPFEED_FORENSICS_RAW.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log("\nForensics raw data written to DRIPFEED_FORENSICS_RAW.json");
}

runForensics().catch(err => {
  console.error("Forensics failed:", err);
  process.exit(1);
});
