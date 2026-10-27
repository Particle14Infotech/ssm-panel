const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const filesToSync = [
  "apps/api/src/modules/platforms/platform-rules.util.ts",
  "apps/api/src/modules/packages/packages.service.ts",
  "apps/api/src/modules/auth/auth.service.ts",
  "apps/server/src/services/platform-rules.util.ts",
  "apps/server/src/services/packages.service.ts",
  "apps/server/src/services/auth.service.ts",
  "apps/web/app/(auth)/login/page.tsx",
  "apps/web/app/(customer)/new-order/page.tsx",
  "apps/web/app/(customer)/packages/[id]/page.tsx",
  "apps/web/components/customer/PackageOrderBuilder.tsx",
  "apps/worker/src/main.ts",
  "infra/docker-compose.prod.yml",
];

const bundle = {};
for (const rel of filesToSync) {
  const fullPath = path.join(__dirname, "..", rel);
  bundle[rel] = fs.readFileSync(fullPath, "utf8");
}

const bundleJson = JSON.stringify(bundle);
const bundlePath = path.join(__dirname, "../scratch/bundle.json");
fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
fs.writeFileSync(bundlePath, bundleJson);
console.log(`[Local] Created bundle.json (${bundleJson.length} bytes for ${filesToSync.length} files)`);

const conn = new Client();
conn
  .on("ready", () => {
    console.log("[SSH] Connected to VPS. Uploading bundle.json...");
    conn.sftp((err, sftp) => {
      if (err) throw err;
      const readStream = fs.createReadStream(bundlePath);
      const writeStream = sftp.createWriteStream("/root/bundle.json");

      writeStream.on("close", () => {
        console.log("[SFTP] bundle.json uploaded to /root/bundle.json");

        const unpackCmd = `
node -e "
const fs = require('fs');
const path = require('path');
const bundle = JSON.parse(fs.readFileSync('/root/bundle.json', 'utf8'));
const targetRoot = '/root/ssm-panel';
for (const [relPath, content] of Object.entries(bundle)) {
  const dest = path.join(targetRoot, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log('Wrote: ' + relPath);
}
console.log('Unpack complete.');
"
`;
        conn.exec(unpackCmd, (execErr, stream) => {
          if (execErr) throw execErr;
          stream
            .on("close", (code) => {
              console.log(`[SSH] Unpack exited with code ${code}`);
              conn.end();
            })
            .on("data", (d) => process.stdout.write(d))
            .stderr.on("data", (d) => process.stderr.write(d));
        });
      });

      readStream.pipe(writeStream);
    });
  })
  .on("keyboard-interactive", (name, instructions, instructionsLang, prompts, finish) => {
    finish(prompts.map(() => "Nk@25144748"));
  })
  .connect({
    host: "103.216.168.152",
    port: 22,
    username: "root",
    password: "Nk@25144748",
    tryKeyboard: true,
  });
