param(
    [Parameter(Mandatory=$true)]
    [string]$Name,
    [Parameter(Mandatory=$true)]
    [string]$Command
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ts = (Get-Date -Format "yyyyMMdd-HHmm")
$evidencePath = "docs/evidence/$ts-$Name.txt"

$gitHead = (git rev-parse HEAD).Trim()
$gitBranch = (git branch --show-current).Trim()
$testDb = "smm_db"

$header = @"
GIT_HEAD: $gitHead
GIT_BRANCH: $gitBranch
TEST_DB: $testDb
COMMAND: $Command

"@

[System.IO.File]::WriteAllText($evidencePath, $header, [System.Text.Encoding]::UTF8)

$output = cmd /c "$Command 2>&1"
if ($output) {
    $outputStr = ($output | Out-String)
    Write-Host $outputStr
    [System.IO.File]::AppendAllText($evidencePath, $outputStr, [System.Text.Encoding]::UTF8)
}
