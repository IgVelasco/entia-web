# Type-check the existing JavaScript

## Objective
Get static type checking over the hand-written browser scripts in `dist/` without a build step, runtime change or hosting change.

## Problem / why
The site is ~1,400 lines of global-script JavaScript with no types. Shapes such as spots, keepers, NPCs and the shared `WorldPhysics`/`WorldFrontier`/`EntiaCharacter` APIs are only checked by tests. `tsc --checkJs --noEmit` adds type errors at edit time while `dist/` stays the deployed source.

## Scope
- In: `package.json` (dev tooling only), `tsconfig` files, ambient declarations for the cross-script globals, JSDoc annotations and minimal code fixes needed for a clean `npm run typecheck`.
- Out: bundler, `.ts` sources, ES modules, `strict` mode, type-checking `tests/`, reformatting the dense code style.

## Constraints
- No behavior change in `dist/`; tests must stay 235/235.
- Site (`dist/index.html`) and demo (`dist/demo/index.html`) are separate pages with separate global scopes, so they are checked as separate projects.
- Match the existing dense code style; no whitespace-only edits.

## TDD
- Mode: on (source: `~/.claude/AGENTS.md`, "FOR EVERY NEW FEATURE OR BUGFIX").
- Runners: `npm test` (`node --test tests/*.test.cjs`) and `npm run typecheck`.
- RED for T2 is the observed baseline: 96 `tsc` errors with `checkJs` over `dist/**/*.js`.

## Tasks
- [x] **T1 — Tooling and test dependency.** Add `package.json` with pinned `typescript@7.0.2` and `pngjs@7.0.0`, `test`/`typecheck` scripts, `.gitignore` for `node_modules/`.
  - Route: inline (mechanical, 2 small config files; no trigger fired).
  - Evidence: before, 234/235 tests pass — `npc-assets.test.cjs` fails with `MODULE_NOT_FOUND` for `pngjs` because the repo had no `package.json`. After `npm install`: 235/235 pass.
- [ ] **T2 — Clean type-check for site and demo.** `tsconfig.base.json`, `tsconfig.site.json`, `tsconfig.demo.json`; typed declarations for cross-script globals; JSDoc/minimal fixes in `dist/app.js`, `dist/character.js`, `dist/demo/demo.js`, `dist/demo/tutorial.js`.
  - Route: delegated writer (writer trigger: 2+ non-trivial files — `app.js` 54 errors, `demo.js` 36 errors).
  - Acceptance: `npm run typecheck` exits 0; `npm test` 235/235; no runtime behavior change.

## Delivery
- Strategy: `ask-on-risk`. Forecast well under 400 authored changed lines; single PR.
- Review (RDD): `gentle-ai` is not installed on this machine, so the assessment is **unavailable** for every commit; no review was run.

## Progress / next step
- T1 done. Next: T2.
- Engram mirror `odd/typecheck-js/tasks`: **pending** — no Engram tools are available in this session.
