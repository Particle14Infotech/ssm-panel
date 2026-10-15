# verify-gate
Run the full quality gate and report only what the evidence shows.
1. Run, one at a time, saving each output to docs/evidence with Tee-Object: lint, typecheck, unit tests with coverage, api e2e tests, build, playwright.
2. Print each exit code.
3. Produce a table: check | command | evidence file | pass/fail | key numbers copied from the file.
4. Flag anything suspicious: tests under 50 ms that claim to cover a worker, queue, DB or browser; skipped tests; coverage below thresholds; warnings that increased.
5. List what you did NOT run. Do not write "complete" anywhere.
