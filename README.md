# Entia

The Nix site (`index.html`) and its embedded offline demo (`demo/index.html`), built with Vite.

## Getting started

1. Install Node 22 with [nvm](https://github.com/nvm-sh/nvm): `nvm install` then `nvm use` in the repo root (reads `.nvmrc`; see Node below for why).
2. Install dependencies: `npm ci`.
3. Start the dev server: `npm run dev`, then open the URL it prints. The site is at `/`, the demo at `/demo/`.
4. For a production-like check, run `npm run build` and then `npm run preview`, which serves `dist/`.
5. The e2e suite runs in Google Chrome. If it isn't installed, run `npx playwright install chrome` once.

Before opening a pull request, run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`. CI runs the same checks on every pull request.

## Node

Use Node 22 (`.nvmrc` pins 22.22.3; run `nvm use`). Node 24's V8 intermittently segfaults in garbage collection while running the vm-sandbox tests (`tests/navigation.test.cjs`), reproduced on 24.5.0 and 24.15.0.

## TypeScript and ESLint

Type-checking uses TypeScript 7 (`tsc`), but typescript-eslint does not support TypeScript 7 yet and needs the TypeScript 6 API. `package.json` follows the [TypeScript 7 announcement's side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0):

- `"@typescript/native": "npm:typescript@7.0.2"` provides the `tsc` command (TypeScript 7).
- `"typescript": "npm:@typescript/typescript6@6.0.2"` makes `require('typescript')` resolve to the TypeScript 6 API (6.0.3, pinned by the lockfile), which typescript-eslint loads. Its own command is `tsc6`.

Until then, type-aware lint rules reason with TypeScript 6, so a lint fix (especially `eslint --fix` for `no-unnecessary-type-assertion`) can remove something TypeScript 7 still needs. Always run `npm run typecheck` after lint fixes.

**Undo this once typescript-eslint supports TypeScript 7** (tracked in [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940); the parser's `typescript` peer range, currently `>=4.8.4 <6.1.0`, is the signal):

1. Upgrade `typescript-eslint` to the release that supports TypeScript 7.
2. Replace both aliases with a plain `"typescript": "<7.x version>"`, then remove `@typescript/native`.
3. Run `npm install`, then check `npx tsc --version` and `node -p "require('typescript').version"` both print 7.x.
4. Run `npm run typecheck` and `npm run lint`, then remove the comment at the top of `eslint.config.js` and this section.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — builds both pages into `dist/`, which Sites serves (`.openai/hosting.json`). Sites deploys run `npm ci` and `npm run build`. `dist/` is build output: never edit it.
- `npm test` — Node test suite.
- `npm run test:e2e` — Playwright suite in the installed Google Chrome against a fresh build (`e2e/`).
- `npm run typecheck` — type-checks `src/` and the e2e suite.
- `npm run lint` — ESLint with typescript-eslint's type-aware recommended rules.

## Layout

- `index.html`, `demo/index.html` — page entries.
- `src/` — strict TypeScript modules and the stylesheets Vite bundles and content-hashes. Each page links one stylesheet entry (`src/site/page.css`, `src/demo/page.css`) that imports its page styles and then the shared character editor styles (`src/shared/character.css`). The site's image manifest (`src/site/site-assets.json`) is imported by `src/site/assets.ts` and bundled with it. `src/site/main.ts` and `src/demo/main.ts` are the page entries. The site controller (`src/site/*.ts`, sharing state through `src/site/context.ts`) imports its boundary rules (`src/site/frontier.ts`) and the shared modules (`src/shared/`) directly; the demo controller (`src/demo/*.ts`, sharing state through `src/demo/context.ts`) does the same with its game rules (`src/demo/rules/`).
- `public/` — static assets (images, fonts, favicon), copied into `dist/` unchanged and referenced by root-relative paths (`/assets/...` in CSS).
- `tests/` — Node tests. `tests/helpers/sandbox-module.cjs` loads a `src/` module (and the JSON it imports) into a test's vm sandbox.
