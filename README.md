# Entia

The Nix site (`index.html`) and its embedded offline demo (`demo/index.html`), built with Vite.

## Node

Use Node 22 (`.nvmrc` pins 22.22.3; run `nvm use`). Node 24's V8 intermittently segfaults in garbage collection while running the vm-sandbox tests (`tests/navigation.test.cjs`), reproduced on 24.5.0 and 24.15.0.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — builds both pages into `dist/`, which Sites serves (`.openai/hosting.json`). Sites deploys run `npm ci` and `npm run build`. `dist/` is build output: never edit it.
- `npm test` — Node test suite.
- `npm run test:e2e` — Playwright suite in the installed Google Chrome against a fresh build (`e2e/`).
- `npm run typecheck` — type-checks `src/` and the e2e suite.

## Layout

- `index.html`, `demo/index.html` — page entries.
- `src/` — strict TypeScript modules and the stylesheets Vite bundles and content-hashes. Each page links one stylesheet entry (`src/site/page.css`, `src/demo/page.css`) that imports its page styles and then the shared character editor styles (`src/shared/character.css`). The site's image manifest (`src/site/site-assets.json`) is imported by `src/site/assets.ts` and bundled with it. `src/site/main.ts` and `src/demo/main.ts` are the page entries. The site controller (`src/site/*.ts`, sharing state through `src/site/context.ts`) imports its boundary rules (`src/site/frontier.ts`) and the shared modules (`src/shared/`) directly; the demo controller (`src/demo/*.ts`, sharing state through `src/demo/context.ts`) does the same with its game rules (`src/demo/rules/`).
- `public/` — static assets (images, fonts, favicon), copied into `dist/` unchanged and referenced by root-relative paths (`/assets/...` in CSS).
- `tests/` — Node tests. `tests/helpers/sandbox-module.cjs` loads a `src/` module (and the JSON it imports) into a test's vm sandbox.
