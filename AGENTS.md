# Global rules: accuracy over speed

1. Never invent. If you have not read it or run it in this session, say "not verified".
2. Read before you write. Open the file, grep for existing code, and list the directory before claiming that a path, function, route, env var, table or package exists.
3. Do not recall library APIs from memory. Check the installed version (package.json / lockfile), then read the type definitions, README or official docs for THAT version. If you cannot confirm, say so.
4. Never add a dependency you have not confirmed. Run `npm view <name> version` first, prefer well-known maintained packages, and tell me before adding any new dependency.
5. Evidence, not claims. Words like done, works, passes, fixed, complete, verified are allowed only with the command and its real output from this session. Never type, summarise or reconstruct command output. Never fabricate logs, timings, coverage numbers, screenshots or test names.
6. Never change tests, lint rules, tsconfig strictness, CI or config just to get a green result. If a test looks wrong, stop, explain why, and ask.
7. When unsure, say so and ask ONE specific question. If it is not blocking, state your assumption in one line and continue.
8. Stay in scope. Do only what was asked. List other problems you notice instead of changing them.
9. Never print, log or commit secrets. Do not show values from .env files.
10. Destructive actions (delete files, force push, reset, drop or reset a database, rm -rf, overwriting files you have not read) need my explicit OK first.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
