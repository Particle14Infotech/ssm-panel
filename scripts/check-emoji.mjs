import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Unicode emoji regex
const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

const scannedDirs = ["apps/web", "apps/api", "apps/worker", "packages/contracts"];
let violations = [];

function scanDir(dir) {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) return;

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist" ||
      entry.name === ".git" ||
      entry.name === "public"
    ) {
      continue;
    }

    const entryPath = path.join(fullPath, entry.name);
    const relPath = path.relative(rootDir, entryPath);

    if (entry.isDirectory()) {
      scanDir(relPath);
    } else if (/\.(ts|tsx|js|jsx|json|md)$/.test(entry.name)) {
      const content = fs.readFileSync(entryPath, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (emojiRegex.test(line)) {
          // Check if it's not this script or a test/check script
          if (!entryPath.includes("scripts") && !entryPath.includes("check-emoji")) {
            violations.push({
              file: relPath,
              line: index + 1,
              content: line.trim(),
            });
          }
        }
      });
    }
  }
}

for (const d of scannedDirs) {
  scanDir(d);
}

console.log(`Scan completed. Found ${violations.length} emoji occurrences:`);
violations.forEach((v) => {
  console.log(`- ${v.file}:${v.line} -> ${v.content}`);
});

if (process.argv.includes("--fail") && violations.length > 0) {
  process.exit(1);
}
