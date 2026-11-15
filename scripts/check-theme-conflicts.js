const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, '..', 'apps', 'web', 'app', '(customer)'),
  path.join(__dirname, '..', 'apps', 'web', 'app', 'admin'),
  path.join(__dirname, '..', 'apps', 'web', 'components', 'customer'),
  path.join(__dirname, '..', 'apps', 'web', 'components', 'admin'),
];

let errorsFound = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Check 1: bg-gradient-to without dark:from- when dark:bg- is present
    if (line.includes('bg-gradient-to') && line.includes('dark:bg-')) {
      if (!line.includes('dark:from-') && !line.includes('dark:bg-none')) {
        console.error(`❌ [Theme Conflict: Gradient Overlay] ${filePath}:${index + 1}`);
        console.error(`   Found 'bg-gradient-to' + 'dark:bg-' without 'dark:from-transparent':`);
        console.error(`   > ${line.trim()}\n`);
        errorsFound++;
      }
    }
  });
}

console.log('================================================================================');
console.log('       ZERO-CONFLICT DARK & LIGHT MODE STATIC AUDITOR                           ');
console.log('================================================================================\n');

targetDirs.forEach(scanDir);

if (errorsFound === 0) {
  console.log('✅ PASS: Zero Dark/Light gradient conflicts found across customer & admin components!');
  process.exit(0);
} else {
  console.error(`❌ FAILED: Found ${errorsFound} Dark/Light theme conflict(s). Please fix before deploying.`);
  process.exit(1);
}
