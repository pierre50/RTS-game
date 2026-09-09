const path = require('node:path')

const BASELINE_VERSION = 1

const ROOT = path.resolve(__dirname, '../..')

const BASELINE_FILE = path.join(ROOT, 'reports', 'health-baseline.json')

const REPORT_DIR = path.join(ROOT, 'reports')

const MD_REPORT = path.join(REPORT_DIR, 'code-health.md')

const JSON_REPORT = path.join(REPORT_DIR, 'code-health.json')

const ARCHITECTURE_CYCLE_BASELINE = 0

const ARCHITECTURE_TOP_CYCLE_LIMIT = 20

const QUALITY_GATE_SCORE = 80

const TARGET_SCORE = 90

const HOTSPOT_CHURN_THRESHOLD = 8

const HOTSPOT_LOC_THRESHOLD = 600

const HOTSPOT_BRANCH_THRESHOLD = 80

const LARGE_FILE_THRESHOLD = 1000

const HUGE_FILE_THRESHOLD = 1500

const COMPLEX_BRANCH_THRESHOLD = 120

const COMPLEX_BLOCK_THRESHOLD = 160

const MAX_FILES_PER_FOLDER_WARNING = 24

const MAX_FILES_PER_FOLDER_SEVERE = 48

const MAX_LOC_PER_FOLDER_WARNING = 8000

const MAX_BRANCHES_PER_FOLDER_WARNING = 1200

const MAX_FOLDER_DEPTH_WARNING = 5

const INDEX_FILE_LOC_WARNING = 300

const CHECKS = [
  { id: 'lint', label: 'ESLint', command: 'pnpm lint' },
  { id: 'typecheck', label: 'TypeScript', command: 'pnpm typecheck' },
  { id: 'duplication', label: 'Duplication', command: 'pnpm duplication' },
  { id: 'deadcode', label: 'Dead code', command: 'pnpm deadcode' },
  {
    id: 'architecture',
    label: 'Import cycles',
    command: 'pnpm exec madge app engine --extensions ts --ts-config tsconfig.json --circular --json',
  },
  {
    id: 'extendedLint',
    label: 'Typed async rules',
    command: 'pnpm exec eslint "app/**/*.ts" "engine/**/*.ts" --format json',
  },
  {
    id: 'tests',
    label: 'Behavior tests',
    command:
      'node --require ./tools/health/coverage-hook.cjs --test --test-timeout=300000 --test-reporter=tap tests/*.test.cjs',
  },
]

const skipChecks = process.argv.includes('--skip-checks')

const quick = process.argv.includes('--quick')

const updateBaseline = process.argv.includes('--update-baseline')

const maxFiles = Number(process.argv.find(arg => arg.startsWith('--max-files='))?.split('=')[1] ?? 12)

module.exports = {
  ROOT,
  HOTSPOT_LOC_THRESHOLD,
  HOTSPOT_BRANCH_THRESHOLD,
  LARGE_FILE_THRESHOLD,
  HUGE_FILE_THRESHOLD,
  COMPLEX_BRANCH_THRESHOLD,
  COMPLEX_BLOCK_THRESHOLD,
  MAX_FILES_PER_FOLDER_WARNING,
  MAX_FILES_PER_FOLDER_SEVERE,
  MAX_LOC_PER_FOLDER_WARNING,
  MAX_BRANCHES_PER_FOLDER_WARNING,
  MAX_FOLDER_DEPTH_WARNING,
  INDEX_FILE_LOC_WARNING,
  HOTSPOT_CHURN_THRESHOLD,
  BASELINE_FILE,
  REPORT_DIR,
  JSON_REPORT,
  MD_REPORT,
  QUALITY_GATE_SCORE,
  TARGET_SCORE,
  maxFiles,
  skipChecks,
  quick,
  updateBaseline,
  BASELINE_VERSION,
  CHECKS,
}
