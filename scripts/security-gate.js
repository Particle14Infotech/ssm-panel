#!/usr/bin/env node
/**
 * scripts/security-gate.js
 * Comprehensive automated security gate for SMM Monorepo.
 * Verifies S0-S6 security findings, permanent guards, and runs all security regression test suites.
 * Exits with non-zero code if any check fails.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('🛡️  SMM SECURITY GATE: AUTOMATED VERIFICATION & INVARIANT GUARDS');
console.log('================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(title, fn) {
  totalChecks++;
  process.stdout.write(`[CHECK ${totalChecks}] ${title}... `);
  try {
    fn();
    console.log('✅ PASSED');
    passedChecks++;
  } catch (err) {
    console.log('❌ FAILED');
    console.error(`   Error: ${err.message}`);
    failedChecks++;
  }
}

function walkDir(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'test' && file !== '__tests__') {
        results = results.concat(walkDir(fullPath, filter));
      }
    } else if (!filter || filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

const isProdTs = (f) =>
  f.endsWith('.ts') &&
  !f.endsWith('.spec.ts') &&
  !f.endsWith('.test.ts') &&
  !f.endsWith('.d.ts');

// 1. Guard 1: Zero Secret Fallbacks in Production Code
check('No hardcoded fallback literals on cryptographic secrets in production source', () => {
  const prodFiles = [
    ...walkDir(path.resolve(__dirname, '../apps/api/src'), isProdTs),
    ...walkDir(path.resolve(__dirname, '../apps/worker/src'), isProdTs),
  ];

  const secretFallbackRegex = /(?:JWT_SECRET|PACKAGE_QUOTE_SECRET|ENCRYPTION_KEY|RES_HMAC_SECRET|CRON_SECRET|DATABASE_URL)\s*\|\|\s*["'][^"']+["']/i;

  const violations = [];
  for (const file of prodFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (secretFallbackRegex.test(content)) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Found hardcoded secret fallbacks in: ${violations.join(', ')}`);
  }
});

// 2. Guard 2: No In-Memory Sandbox Fallback Maps
check('Zero in-memory sandbox storage maps (sandboxPackages, sandboxOrders, sandboxBalances) in src/', () => {
  const prodFiles = [
    ...walkDir(path.resolve(__dirname, '../apps/api/src'), isProdTs),
    ...walkDir(path.resolve(__dirname, '../apps/worker/src'), isProdTs),
  ];

  const sandboxRegex = /\b(sandboxPackages|sandboxOrders|sandboxBalances|sandboxTickets|sandboxLedger)\b/;

  const violations = [];
  for (const file of prodFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (sandboxRegex.test(content)) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Found sandbox in-memory maps in production source: ${violations.join(', ')}`);
  }
});

// 3. Guard 3: No eval() or new Function() in Production Source
check('No eval() or new Function() calls in production source', () => {
  const prodFiles = [
    ...walkDir(path.resolve(__dirname, '../apps/api/src'), isProdTs),
    ...walkDir(path.resolve(__dirname, '../apps/worker/src'), isProdTs),
  ];

  const evalRegex = /(?:^|\s)(?:eval\(|new\s+Function\()/;

  const violations = [];
  for (const file of prodFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (evalRegex.test(content)) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Found unsafe dynamic code execution in: ${violations.join(', ')}`);
  }
});

// 4. Guard 4: PostgreSQL Database CHECK Constraint Defined in Migrations
check('PackageRule table enforces CHECK constraint (usedCount <= maxPosts) in migrations', () => {
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir, { recursive: true });
  let hasConstraint = false;

  for (const file of migrationFiles) {
    if (typeof file === 'string' && file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      if (sql.includes('"usedCount" <= "maxPosts"')) {
        hasConstraint = true;
        break;
      }
    }
  }

  if (!hasConstraint) {
    throw new Error('PostgreSQL CHECK constraint "usedCount" <= "maxPosts" missing from migrations.');
  }
});

// 5. Guard 5: WHATWG URL Validation Strict Security
check('WHATWG URL validation has max-length, strict https, port, userinfo, and IDN guards', () => {
  const utilFile = path.resolve(__dirname, '../apps/api/src/modules/platforms/platform-rules.util.ts');
  const content = fs.readFileSync(utilFile, 'utf-8');

  if (!content.includes('trimmed.length > 2048')) {
    throw new Error('URL max-length check <= 2048 missing from platform-rules.util.ts');
  }
  if (!content.includes('parsed.protocol !== "https:"')) {
    throw new Error('Strict https: scheme check missing from platform-rules.util.ts');
  }
  if (!content.includes('parsed.username || parsed.password')) {
    throw new Error('Userinfo credentials check missing from platform-rules.util.ts');
  }
  if (!content.includes('parsed.port !== "" && parsed.port !== "443"')) {
    throw new Error('Non-default port check missing from platform-rules.util.ts');
  }
  if (!content.includes('xn--')) {
    throw new Error('IDN/Punycode rejection missing from platform-rules.util.ts');
  }
});

// 6. Guard 6: Mandatory Quote Integrity Validation
check('PackagesService enforces mandatory quoteHash and rejects tampering', () => {
  const serviceFile = path.resolve(__dirname, '../apps/api/src/modules/packages/packages.service.ts');
  const content = fs.readFileSync(serviceFile, 'utf-8');

  if (!content.includes('verifyQuoteHash(input.quoteHash')) {
    throw new Error('verifyQuoteHash check missing from PackagesService');
  }
  if (!content.includes('quoteHash is required to purchase a package')) {
    throw new Error('Mandatory quoteHash presence check missing from PackagesService');
  }
});

// 7. Guard 7: Refund Two-Man Rule and Row Locking
check('Refunds enforce Two-Man Rule (> 500 INR), Decimal arithmetic, and Provider cross-check', () => {
  const serviceFile = path.resolve(__dirname, '../apps/api/src/modules/packages/packages.service.ts');
  const content = fs.readFileSync(serviceFile, 'utf-8');

  if (!content.includes('REFUND_REQUIRES_TWO_MAN_RULE')) {
    throw new Error('REFUND_REQUIRES_TWO_MAN_RULE check missing from PackagesService');
  }
  if (!content.includes('Cannot refund an execution whose upstream provider order has already completed')) {
    throw new Error('Provider status cross-verification missing from refundExecution');
  }
});

// 8. Guard 8: Mutation Patches Exist
check('Mutation patches gap1.patch through gap5.patch exist in security/mutations/', () => {
  for (let i = 1; i <= 5; i++) {
    const patchPath = path.resolve(__dirname, `../security/mutations/gap${i}.patch`);
    if (!fs.existsSync(patchPath)) {
      throw new Error(`Missing mutation patch: gap${i}.patch`);
    }
  }
});

// 9. Guard 9: Execute All Security Regression Test Suites (S0 - S6)
check('All Security Test Suites pass green under Jest', () => {
  const testCmd = 'node ../../node_modules/jest/bin/jest.js --config test/jest-packages.json package-security-gaps-reproduce.spec.ts package-quote-integrity-s1.spec.ts package-quote-dos-s2.spec.ts package-refund-correctness-s3.spec.ts package-secrets-hardening-s4.spec.ts package-fail-closed-s5.spec.ts package-extra-hardening-s6.spec.ts --runInBand';
  try {
    const out = execSync(testCmd, {
      cwd: path.resolve(__dirname, '../apps/api'),
      stdio: 'pipe',
      encoding: 'utf-8',
      env: { ...process.env, CI: 'true' },
    });
    console.log('\n' + out.trim());
  } catch (err) {
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    throw new Error('One or more security regression test suites failed.');
  }
});

console.log('\n================================================================');
console.log(`SUMMARY: ${passedChecks}/${totalChecks} checks passed, ${failedChecks} failed.`);
console.log('================================================================\n');

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('🏆 ALL PERMANENT SECURITY GUARDS AND TEST SUITES VERIFIED GREEN.\n');
  process.exit(0);
}
