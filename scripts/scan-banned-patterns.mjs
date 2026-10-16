import fs from 'node:fs';
import path from 'node:path';

const searchDirs = [
  'apps/web/app',
  'apps/web/components',
  'apps/web/content',
  'apps/api/src',
  'apps/worker/src'
];

const bannedRules = [
  { name: 'Unicode Emoji', regex: /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u },
  { name: 'Lorem Ipsum', regex: /\b(lorem\s+ipsum|dolor\s+sit\s+amet)\b/i },
  { name: 'Coming Soon Blocks', regex: /\b(coming\s+soon)\b/i },
  { name: 'Old Brand Names', regex: /\b(Ather|Aether|Aethar|Ethar|Vireo)\b/i }
];

let totalViolations = 0;
const violationDetails = [];

function checkFile(filePath) {
  // Ignore 3d lab or three-specific shaders/canvases where 3d objects are preserved
  if (filePath.includes('3d-lab') || filePath.includes('components/three/objects')) {
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    for (const rule of bannedRules) {
      if (rule.regex.test(line)) {
        // Skip comment lines or test files if applicable
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        totalViolations++;
        violationDetails.push({
          rule: rule.name,
          file: filePath,
          line: lineIdx + 1,
          content: line.trim()
        });
      }
    }
  });
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!full.includes('node_modules') && !full.includes('.next') && !full.includes('dist')) {
        walkDir(full);
      }
    } else if (/\.(tsx|ts|js|jsx)$/.test(item)) {
      checkFile(full);
    }
  }
}

for (const dir of searchDirs) {
  walkDir(dir);
}

console.log('================================================================================');
console.log('              BANNED PATTERNS PRODUCTION SCAN REPORT                            ');
console.log('================================================================================');

if (totalViolations === 0) {
  console.log('✅ ZERO BANNED PATTERNS DETECTED! All scanned source files clean.');
  process.exit(0);
} else {
  console.error(`❌ Found ${totalViolations} violations:`);
  violationDetails.forEach((v) => {
    console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content.substring(0, 90)}`);
  });
  process.exit(1);
}
