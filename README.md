# Entia

The Nix site (`index.html`) and its embedded offline demo (`demo/index.html`), built with Vite.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — builds both pages into `dist/`, which hosting serves (`.openai/hosting.json`). `dist/` is build output: never edit it.
- `npm test` — Node test suite.
- `npm run typecheck` — type-checks the page scripts.

## Layout

- `index.html`, `demo/index.html` — page entries.
- `public/` — page scripts, styles and assets, copied into `dist/` unchanged. They are classic scripts sharing globals until they move to `src/` as TypeScript modules.
- `types/` — declarations for the globals shared between those scripts.
- `tests/` — Node tests.
