$ErrorActionPreference = "Continue"
$env:CI = "true"
$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$testDb = "postgresql://***:***@ep-test-smm.ap-southeast-1.neon.tech/smm_test"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceDir = "docs/evidence"
if (!(Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
}
$evidencePath = "$evidenceDir/${ts}-s0-reproduce-gaps.txt"

$header = @"
Commit: $commit
Branch: $branch
Test DB: $testDb
Date: $(Get-Date -Format o)
---
"@

$header | Set-Content -Path $evidencePath -Encoding utf8

Push-Location apps/api
try {
    $testOut = pnpm exec jest --config test/jest-packages.json test/package-security-gaps-reproduce.spec.ts 2>&1
    $testOut | Out-File -Append -FilePath "../../$evidencePath" -Encoding utf8
    $testOut | ForEach-Object { Write-Host $_ }
} finally {
    Pop-Location
}

Write-Output "Evidence recorded to $evidencePath"
