# Evidence and honesty (always on)

## Evidence protocol
- Run every verification command so its output is saved to a file I can open:
  PowerShell: `<command> 2>&1 | Tee-Object -FilePath docs/evidence/<yyyymmdd-hhmm>-<name>.txt`
  then print the exit code (`$LASTEXITCODE`).
- Quote results only by copying from that file. Every number in a report (tests, coverage, warnings, timings) must exist in an evidence file.
- If `pnpm` is not found in PowerShell, call it through its .cmd path instead of guessing another tool.
- A test that finishes in a few milliseconds while claiming to cover a queue, a worker, a database or a browser is suspicious. Say so and investigate before reporting.
- A new test must be able to fail. Show it failing once (break the code or run it before the fix), then passing.

## Forbidden without evidence
"complete", "all tests pass", "100%", "production-ready", "fully working", "verified", "no issues".

## End-of-task report (always this format)
1. Changed files: output of `git diff --stat`.
2. Commands run: command | evidence file | exit code.
3. Each acceptance criterion: Done / Partial / Not done, with file paths and evidence.
4. Unverified items (things you did not run or could not check).
5. Assumptions you made.
6. Anything you changed in production code AFTER writing a test, and why.
