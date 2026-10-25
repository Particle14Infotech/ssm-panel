$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dbName = "smm_db_sandbox"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceFile = "docs/evidence/$ts-q1-browser-auth.txt"

$header = @"
Git Commit: $commit
Git Branch: $branch
Database Name: $dbName
Timestamp: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
============================================================
"@

$header | Out-File -FilePath $evidenceFile -Encoding utf8
pnpm exec playwright test e2e/q1-browser-auth.spec.ts 2>&1 | Tee-Object -FilePath $evidenceFile -Append
