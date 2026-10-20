# Entia

The Nix site (`index.html`) and its embedded offline demo (`demo/index.html`), built with Vite.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — builds both pages into `dist/`, which Sites serves (`.openai/hosting.json`). Sites deploys run `npm ci` and `npm run build`. `dist/` is build output: never edit it.
- `npm test` — Node test suite.
- `npm run typecheck` — type-checks `src/` and the e2e suite.

## Layout

- `index.html`, `demo/index.html` — page entries.
- `src/` — strict TypeScript modules. `src/site/main.ts` and `src/demo/main.ts` are the page entries. The site controller (`src/site/*.ts`, sharing state through `src/site/context.ts`) imports its boundary rules (`src/site/frontier.ts`) and the shared modules (`src/shared/`) directly; the demo controller (`src/demo/*.ts`, sharing state through `src/demo/context.ts`) does the same with its game rules (`src/demo/rules/`).
- `public/` — styles and assets, copied into `dist/` unchanged.
- `tests/` — Node tests. `tests/helpers/sandbox-module.cjs` loads a `src/` module into a test's vm sandbox.
