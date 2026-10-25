$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dbName = "neondb (Neon PostgreSQL)"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceFile = "docs/evidence/$ts-reg-01-regression.txt"

$header = @"
Git Commit: $commit
Git Branch: $branch
Database Name: $dbName
Timestamp: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
============================================================
REG-01: COMPREHENSIVE END-TO-END REGRESSION & SMOKE GATE
============================================================
"@

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$header | Out-File -FilePath $evidenceFile -Encoding utf8

"`n>>> STEP 1: External Services Registry Check" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& node scripts/check-externals.js 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

"`n>>> STEP 2: OpenAPI Contract Diff & Drift Verification" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& node scripts/check-contract-diff.js 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

"`n>>> STEP 3: Automated Security Gate & Mutation Invariant Guards" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& node scripts/security-gate.js 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

"`n>>> STEP 4: Monorepo End-To-End Invariant Smoke Run" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& node scripts/smoke.js 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

"`n>>> STEP 5: Test Accounts Neon DB Cleanup" | Out-File -FilePath $evidenceFile -Append -Encoding utf8
& node scripts/clean-test-users.js 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8

Get-Content $evidenceFile
