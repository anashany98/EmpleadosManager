import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', 'playwright-report', 'test-results'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_',
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-var-requires': 'off',
      'no-useless-assignment': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'arrow-body-style': ['error', 'as-needed'],
    },
  },
);
// LOW-001 (audit): política de warnings por carpeta.
// Estado actual (2026-07-21): 1029 warnings (0 errors).
// Distribución aproximada:
//   - @typescript-eslint/no-explicit-any: ~700 (tipos laxos
//     en código legacy, refactor incremental)
//   - @typescript-eslint/no-unused-vars: ~250 (incluye
//     `err` no usado en catch, que la regla actual ignora
//     con `^_` pero el código no usa `_err`)
//   - no-console: ~50 (logs de debug olvidados)
//   - otros: ~30
// El CI falla con `--max-warnings=1100` (margen +71 sobre
// el conteo actual). Cualquier subida del contador rompe el
// build. Reducción por fases: 1029 → 800 → 500 → 0.
//
// Para ejecutar local:
//   npm run lint             # exit 0 (warnings no fallan)
//   npm run lint:strict       # exit 1 si hay warnings
//   npm run lint:per-folder   # budget por carpeta (ver scripts/lint-budget.mjs)
