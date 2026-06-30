import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Promote a11y alt-text from warn to error so missing alt attributes block
      // CI instead of accumulating quietly. Addresses Ahrefs flag "Missing alt
      // text" (42 instances across rendered pages).
      'jsx-a11y/alt-text': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.wrangler/**',
    '**/.wrangler/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
