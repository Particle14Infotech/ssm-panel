param (
    [Parameter(Mandatory=$true)]
    [string]$TestFile,

    [Parameter(Mandatory=$true)]
    [string]$EvidenceTag,

    [string]$Status = "RUNNING"
)

$ErrorActionPreference = "Continue"
$env:CI = "true"
$commit = (git rev-parse HEAD).Trim()
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$testDb = if ($env:TEST_DATABASE_URL) { $env:TEST_DATABASE_URL } else { "postgresql://user:password@localhost:5432/smm_test" }
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceDir = "docs/evidence"
if (!(Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
}
$evidencePath = "$evidenceDir/${ts}-${EvidenceTag}.txt"

$header = "Commit: $commit`nBranch: $branch`nTest DB: $testDb`nDate: $(Get-Date -Format o)`nStatus: $Status`n---`n"
$header | Set-Content -Path $evidencePath -Encoding utf8

Push-Location apps/api
try {
    $testOut = pnpm exec jest --config test/jest-packages.json $TestFile 2>&1
    $testOut | Out-File -Append -FilePath "../../$evidencePath" -Encoding utf8
    $testOut | ForEach-Object { Write-Host $_ }
} finally {
    Pop-Location
}

Write-Host "Evidence recorded to $evidencePath"
