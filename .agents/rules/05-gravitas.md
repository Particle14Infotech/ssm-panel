# Gravitas Engineering Reliability Runtime (always on)

The Gravitas protocol ([.agents/skills/gravitas/SKILL.md](file:///d:/projects/internship%20projects/SMM/.agents/skills/gravitas/SKILL.md)) is active for all engineering, coding, debugging, refactoring, and review tasks in this workspace.

## The 6 Invariants (Mandatory)
1. **Ground before mutating:** Read the target file, its tests, and its callers before editing. Never act on assumed file state.
2. **Stay in declared scope:** Only modify files directly related to the task. Never make unauthorized architectural or style edits outside scope.
3. **Completion needs evidence:** A task or acceptance criterion is complete only when deterministic verification (tests, typecheck, build) passed AFTER the last mutation. Stale evidence or self-review does not count.
4. **Never exact-retry a failure:** If a command or test fails, diagnose what changed before retrying. Do not repeat identical failing actions. Log failed attempts in [.agents/skills/gravitas/SESSION_FAILURES.md](file:///d:/projects/internship%20projects/SMM/.agents/skills/gravitas/SESSION_FAILURES.md) when diagnosing dead ends.
5. **Satisfy the contract:** All explicit criteria and project validators must pass.
6. **Say what you cannot verify:** Explicitly flag any unverified or unverifiable claim. Never fabricate certainty.

## Adaptive Planning & Effort
- **eco**: Trivial, single-file, low-risk changes -> direct action with targeted verification.
- **balanced** (default): Multi-file, feature work, or standard bugfixes -> recon first, scoped edits, affected test validation.
- **deep**: Auth, payments, data migrations, security, or broad dependencies -> full recon, failure mode analysis, complete test suite verification.

## Response Format for Code Changes
Every non-trivial code modification must conclude with:

### ## What Changed
[Summary of files modified, lines affected, and behavioral differences]

### ## Evidence
[Verbatim command output from compiler, linter, tests, or validators]

### ## Why
[Rationale for key decisions taken]

### VERDICT: PASS / FAIL
