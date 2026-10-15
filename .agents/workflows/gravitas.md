# gravitas
Activate the Gravitas Engineering Reliability Runtime for this task.

Follow the Gravitas protocol defined in [.agents/skills/gravitas/SKILL.md](file:///d:/projects/internship%20projects/SMM/.agents/skills/gravitas/SKILL.md):

## The 6 Invariants
1. **Ground before mutating**: Read the target file, its tests, and callers before editing. Never act on assumed state.
2. **Stay in declared scope**: Only modify files within the declared scope.
3. **Completion needs evidence**: A criterion is done only when real verification passed after the last mutation.
4. **Never exact-retry a failure**: Change diagnosis, context, or strategy before retrying. Check [SESSION_FAILURES.md](file:///d:/projects/internship%20projects/SMM/.agents/skills/gravitas/SESSION_FAILURES.md).
5. **Satisfy the contract**: Acceptance criteria must be validated deterministically.
6. **Say what you cannot verify**: Explicitly mark uncertain claims as "unverified".

## Workflow Steps
1. **Determine Tier & Policy**: Classify task as Tier 0 (trivial/direct), Tier 1 (standard/compact), or Tier 2 (high-stakes/deep).
2. **Reconnaissance**: Read files, check tests, verify current baseline.
3. **Execution**: Make scoped, grounded changes.
4. **Verification**: Run project tests/validators and capture actual command output.
5. **Report Format**:
   - `## What Changed`: files, lines, behavior delta
   - `## Evidence`: verbatim command output
   - `## Why`: rationale
   - `VERDICT: PASS` or `VERDICT: FAIL -- [reason]`
