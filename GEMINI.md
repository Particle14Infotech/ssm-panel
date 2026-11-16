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

## Universal Zero-Conflict Dark & Light Mode Rules
To prevent visual inversions, unreadable text, and white-card bleed in dark mode:
1. **CSS Gradient Precedence Rule**: In CSS, `background-image` renders on top of `background-color`. Therefore, never write `bg-gradient-to-... from-white ... dark:bg-surface` alone.
2. **Mandatory Gradient Neutralization in Dark Mode**: Whenever a light gradient is used on a card, container, or header, always pair it with:
   `dark:from-transparent dark:via-transparent dark:to-transparent dark:bg-surface` (or `dark:bg-none dark:bg-surface`).
3. **Paired Semantic Tokens**: Prefer semantic tokens: `bg-white dark:bg-surface` for light/dark card surfaces, and `text-slate-900 dark:text-fg` for text.
4. **Automated Static Audit**: Run `pnpm test:theme` (`node scripts/check-theme-conflicts.js`) to automatically detect any un-neutralized gradients.
5. **Dual-Theme Verification**: Verify every UI screen in both Light and Dark mode before deploying.

## Ponytail: Lazy Senior Developer Mode (Anti-Bloat & YAGNI)
The best code is the code never written. Solve the whole problem with the least new code.
Follow the 6-tier ladder before writing code:
1. **YAGNI**: Does it need to exist? Skip features, options, and flexibility nobody asked for.
2. **Reuse**: Check if a helper, component, service, or pattern already exists in the repository. Use it.
3. **Standard Library / Native Platform**: Leverage standard library or native browser/HTML features before custom logic or dependencies.
4. **Installed Dependency**: Use an already-installed dependency. Never add a new package for a few lines of code.
5. **One-liners**: If it can be one clean, readable line, write one line.
6. **Minimum Viable Code**: Otherwise, write the absolute minimum code that completely works.
- **Rules of Engagement**:
  - Deletion beats addition.
  - Never introduce wrappers, abstractions, or "for later" boilerplate nobody asked for.
  - The shortest working diff wins, once all callers and edge cases are accounted for.
  - Never cut: validation at trust boundaries, security, error handling that prevents data loss, or accessibility.



