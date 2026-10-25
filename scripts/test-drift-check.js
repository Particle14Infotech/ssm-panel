const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const originalContent = fs.readFileSync(schemaPath, 'utf8');

const env = fs.readFileSync('.env.test', 'utf8');
const dbUrl = env.match(/DATABASE_URL_TEST=([^\r\n]+)/)[1].trim();

console.log('=== MIGRATION DRIFT CHECK VERIFICATION ===');

try {
  // 1. Deliberately introduce schema drift
  const driftModel = `\n\nmodel DeliberateSchemaDrift {\n  id String @id @default(uuid())\n  driftColumn String\n}\n`;
  fs.writeFileSync(schemaPath, originalContent + driftModel, 'utf8');
  console.log('[DRIFT INTRODUCED]: Appended model DeliberateSchemaDrift to prisma/schema.prisma');

  console.log('\n--- RUNNING DRIFT CHECK ON DRIFTED SCHEMA (EXPECTING FAILURE) ---');
  let failed = false;
  try {
    const out = execSync(
      'pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code',
      {
        env: { ...process.env, DATABASE_URL: dbUrl },
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
    console.log(out);
  } catch (err) {
    failed = true;
    console.log('[DRIFT DETECTED AS EXPECTED]: Exit code:', err.status);
    console.log(err.stdout || err.stderr || err.message);
  }

  if (!failed) {
    throw new Error('Drift check did not fail on drifted schema!');
  }
} finally {
  console.log('\n--- REVERTING DELIBERATE DRIFT ---');
  fs.writeFileSync(schemaPath, originalContent, 'utf8');
  console.log('[REVERTED] prisma/schema.prisma restored to original');
}

console.log('\n--- VERIFYING CLEAN SCHEMA STATUS ---');
const gitDiff = execSync('git diff prisma/schema.prisma', { encoding: 'utf8' });
console.log('Deliberate drift diff check:', gitDiff.includes('DeliberateSchemaDrift') ? 'LEAKED' : 'CLEAN (reverted)');

console.log('=== MIGRATION DRIFT CHECK VERIFICATION COMPLETE ===');
