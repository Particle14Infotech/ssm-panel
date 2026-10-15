# Testing rules (always on)

- Integration and e2e tests must exercise the real system. No mocked Prisma, no page.route or API interception, no calling service methods directly while pretending to be the worker. The worker test must start the real worker process and read its real output.
- No weakened assertions: no `if (await x.isVisible())` guards, no `>`/`<=` where an exact value is known, no accepting PROCESSING when COMPLETED is required, no checking only that the body is visible.
- No `.skip`, `.only`, `xit` or commented-out tests without a written reason and my OK.
- Never lower coverage thresholds or exclude files from coverage to reach a target.
- Coverage numbers come only from the coverage tool output saved in docs/evidence.
- Do not edit a failing test to make it pass. Decide first: is the code wrong or the test wrong? State which, and why, before changing anything.
- Concurrency claims (no overdraw, one refund, one order per key) need a test with real parallel requests against the real test DB.
