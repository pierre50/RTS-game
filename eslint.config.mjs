import tsParser from '@typescript-eslint/parser'

const browserGlobals = {
  alert: 'readonly',
  console: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  structuredClone: 'readonly',
  window: 'readonly',
}

export default [
  {
    ignores: ['build/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['app/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      globals: browserGlobals,
    },
    rules: {},
  },
  {
    files: ['main.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
    rules: {},
  },
]
