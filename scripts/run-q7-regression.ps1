$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dbName = "neondb (Neon PostgreSQL)"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceFile = "docs/evidence/$ts-q7-regression.txt"

$header = @"
Git Commit: $commit
Git Branch: $branch
Database Name: $dbName
Timestamp: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
============================================================
"@

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$header | Out-File -FilePath $evidenceFile -Encoding utf8

Write-Host "--- 1. Automated E2E Smoke Verification ---"
"--- 1. Automated E2E Smoke Verification ---" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& node ./scripts/smoke.js 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

Write-Host "--- 2. Playwright Responsive Regression Suite (1440px & 390px) ---"
"--- 2. Playwright Responsive Regression Suite (1440px & 390px) ---" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& pnpm exec playwright test e2e/q7-regression.spec.ts 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

Get-Content $evidenceFile
