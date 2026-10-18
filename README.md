# Entia

The Nix site (`index.html`) and its embedded offline demo (`demo/index.html`), built with Vite.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — builds both pages into `dist/`, which Sites serves (`.openai/hosting.json`). Sites deploys run `npm ci` and `npm run build`. `dist/` is build output: never edit it.
- `npm test` — Node test suite.
- `npm run typecheck` — type-checks the page scripts.

## Layout

- `index.html`, `demo/index.html` — page entries.
- `src/` — strict TypeScript modules. `src/site/main.ts` and `src/demo/main.ts` are the page entries; `src/shared/globals.ts` exposes shared modules to the remaining classic scripts.
- `public/` — classic page scripts (loaded with `defer`, after the module entry), styles and assets, copied into `dist/` unchanged. Scripts move to `src/` as they are converted.
- `types/` — declarations for globals still defined by classic scripts.
- `tests/` — Node tests. `tests/helpers/sandbox-module.cjs` loads a `src/` module into a test's vm sandbox.
