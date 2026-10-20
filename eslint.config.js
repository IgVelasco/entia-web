import globals from 'globals';
import tseslint from 'typescript-eslint';

// Type-aware linting runs on the TypeScript 6 API: `typescript` is aliased to @typescript/typescript6
// because typescript-eslint does not support TypeScript 7 yet (see README, "TypeScript and ESLint").
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.json', './tsconfig.e2e.json'], tsconfigRootDir: import.meta.dirname },
    },
    // A leading underscore marks a parameter that a signature requires but the body does not need.
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  // Node tests are CommonJS and are not part of a TypeScript project.
  {
    files: ['**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { ...tseslint.configs.disableTypeChecked.rules, '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['eslint.config.js', 'vite.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
);
