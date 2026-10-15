import { SMMCacheService } from "../../apps/api/src/common/cache.service";

async function runCacheTests() {
  console.log("=================================================");
  console.log("⚡ EXECUTING CACHE ARCHITECTURE VALIDATION SUITE");
  console.log("=================================================");

  const cache = new SMMCacheService();
  const testKey = "catalog:services:all";
  const testData = [{ id: "1042", name: "Instagram Followers" }];

  // 1. Cache Miss Check
  const missResult = await cache.get(testKey);
  const passMiss = missResult === null;
  console.log(`[TEST 1] Cache Miss -> Result: ${passMiss ? "PASS (null on cold miss)" : "FAIL"}`);

  // 2. Cache Set & Cache Hit Check
  await cache.set(testKey, testData, { ttlSeconds: 300, jitterSeconds: 5 });
  const hitResult = await cache.get<typeof testData>(testKey);
  const passHit = hitResult !== null && hitResult[0]?.id === "1042";
  console.log(`[TEST 2] Cache Hit -> Result: ${passHit ? "PASS (retrieved from cache)" : "FAIL"}`);

  // 3. Cache Invalidation Check
  await cache.invalidate(testKey);
  const afterInvalidate = await cache.get(testKey);
  const passInvalidate = afterInvalidate === null;
  console.log(`[TEST 3] Cache Invalidation -> Result: ${passInvalidate ? "PASS (evicted after admin change)" : "FAIL"}`);

  // 4. Redis-Down Fallback Check
  cache.setRedisAvailable(false);
  await cache.set(testKey, testData, { ttlSeconds: 60 });
  const fallbackResult = await cache.get<typeof testData>(testKey);
  const passFallback = fallbackResult !== null && fallbackResult[0]?.id === "1042";
  console.log(`[TEST 4] Redis-Down Fallback -> Result: ${passFallback ? "PASS (served via in-memory fallback)" : "FAIL"}`);

  console.log("=================================================");
  const allPassed = passMiss && passHit && passInvalidate && passFallback;
  console.log(`CACHE SUITE OVERALL STATUS: [${allPassed ? "PASSED" : "FAILED"}]`);
  console.log("=================================================");

  if (!allPassed) process.exit(1);
}

runCacheTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
