# Project Instructions & Deployment Rules

## Universal Deployment Agent Rules
Whenever the user asks to deploy to VPS or says "vps pe live karo", follow the Universal Deployment Rules:
1. **NEVER build on the VPS.** All builds happen locally (or in CI). VPS only runs artifacts.
2. **NEVER `git pull` on the VPS.** Push artifacts directly via `scp`/`rsync`.
3. **NEVER upload `node_modules/`, `target/`, `.venv/`, `__pycache__/`, `dist/` (source), `.git/`** — only final build output.
4. **ONLY deploy what changed.** Detect diff before building.
5. **ALWAYS back up the current artifact** on VPS before replacing it (for rollback).
6. **ALWAYS health-check after restart.** If it fails, auto-rollback and notify the user.
7. **Use `rsync` for directories, `scp` for single files.**
8. **Print timing for each step.** Total target: 1-2 minutes.
9. **If uncertain, ASK before doing something destructive.**
10. **Idempotent scripts** — running twice should not break anything.

## Step 0: Project Detection Profile
Run Step 0 first (once per session) and summarize the detected profile in 3 bullets:
- Stack & runtime
- Target architecture & deployment mode
- Build artifact strategy & change delta

