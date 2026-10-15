const { execSync } = require("child_process");
const path = require("path");

const drills = [
  "redis-outage",
  "worker-kill",
  "provider-failure",
  "db-exhaustion",
  "webhook-storm",
];

console.log("================================================================================");
console.log("REAL RESILIENCE DRILL EXECUTION AUDIT (GENERATED FROM PROCESS EXIT CODES)");
console.log("Timestamp: " + new Date().toISOString());
console.log("================================================================================");

let allPassed = true;

for (const drill of drills) {
  const scriptPath = path.join(__dirname, `${drill}.js`);
  try {
    const stdout = execSync(`node "${scriptPath}"`, { encoding: "utf-8" });
    console.log(`[PASS (Exit 0)] scripts/drills/${drill}.js`);
  } catch (err) {
    allPassed = false;
    console.log(`[FAIL (Exit ${err.status})] scripts/drills/${drill}.js`);
  }
}

console.log("================================================================================");
console.log(allPassed ? "ALL 5 REAL DRILLS PASSED WITH EXIT CODE 0." : "FAILURES DETECTED IN DRILLS.");
console.log("================================================================================");

if (!allPassed) process.exit(1);
