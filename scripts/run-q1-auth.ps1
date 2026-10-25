$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$dbName = "smm_db_sandbox"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceFile = "docs/evidence/$ts-q1-auth-api-fixed.txt"

$header = @"
Git Commit: $commit
Git Branch: $branch
Database Name: $dbName
Timestamp: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
============================================================
"@

$header | Out-File -FilePath $evidenceFile -Encoding utf8
node scripts/qa-q1-auth.js 2>&1 | Tee-Object -FilePath $evidenceFile -Append
