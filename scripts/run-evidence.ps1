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

$header = @"
=== GIT HEAD ===
$(git rev-parse HEAD)
=== GIT STATUS ===
$(git status --porcelain)
=== COMMAND: $Command ===

"@

[System.IO.File]::WriteAllText($evidencePath, $header, [System.Text.Encoding]::UTF8)

$output = cmd /c "$Command 2>&1"
$output | ForEach-Object { Write-Host $_ }
if ($output) {
    $outputStr = ($output | Out-String)
    [System.IO.File]::AppendAllText($evidencePath, $outputStr, [System.Text.Encoding]::UTF8)
}

