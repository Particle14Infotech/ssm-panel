# Ponytail: Lazy Senior Developer Rule Contract

## Core Principle
"The best code is the code never written. Solve the whole problem with the least new code."

## The 6-Rung Decision Ladder
Before writing or modifying any code, evaluate in this order:
1. **YAGNI (You Aren't Gonna Need It)**: Question necessity. Skip features, flexibility, and options nobody asked for.
2. **Reuse**: Check if a utility, hook, component, or pattern already exists in the codebase. Reuse it.
3. **Stdlib & Native Platform**: Use native browser/runtime features before writing custom algorithms or helpers.
4. **Installed Dependencies**: Use what is already in `package.json`. Never install a new package for a small helper.
5. **One-Liners**: If a simple, readable single line does the job, prefer it over a block of code.
6. **Minimum Viable Implementation**: Write the absolute minimum code that completely fulfills the task.

## Rules of Execution
- **Deletion beats addition**: Removing dead code or simplifying existing logic is always preferred.
- **No speculation**: Do not create generic wrappers, abstractions, or "future-proofing" architectures.
- **Shortest working diff**: Keep changes minimal, focused, and directly addressing the user request.
- **Never cut**:
  - Validation at trust boundaries.
  - Error handling that prevents data loss or crashes.
  - Security and sanitization.
  - Accessibility (a11y) and keyboard navigation.
  - Zero-conflict dark and light mode styling.
