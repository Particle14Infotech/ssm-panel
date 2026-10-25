$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dbName = "smm_db_sandbox"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceFile = "docs/evidence/$ts-q4-browser-support-dashboard.txt"

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
& pnpm exec playwright test e2e/q4-browser-support-dashboard.spec.ts 2>&1 | Out-File -FilePath $evidenceFile -Append -Encoding utf8
Get-Content $evidenceFile
