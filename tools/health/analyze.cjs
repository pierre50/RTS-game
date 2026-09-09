const ts = require('typescript')
const path = require('node:path')
const crypto = require('node:crypto')

const REQUIRED_CHECKS = [
  'lint',
  'typecheck',
  'duplication',
  'deadcode',
  'architecture',
  'extendedLint',
  'tests',
  'coverage',
  'snapshot',
  'regressions',
]
const LIMITS = { complexity: 15, nesting: 4, lines: 80 }
const normalize = value => value.split(path.sep).join('/')
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)

function analyzeSource(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const functions = []
  const imports = []
  const safety = []
  let branches = 0
  let exports = 0
  const isFunction = node => ts.isFunctionLike(node) && node.body
  const isControl = node =>
    ts.isIfStatement(node) ||
    ts.isIterationStatement(node, false) ||
    ts.isSwitchStatement(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node)
  const isBranch = node =>
    ts.isIfStatement(node) ||
    ts.isIterationStatement(node, false) ||
    ts.isCaseClause(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node) ||
    (ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        node.operatorToken.kind
      ))
  function visit(node) {
    if (isBranch(node)) branches++
    if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) exports++
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require') &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text)
    if (
      node.kind === ts.SyntaxKind.AnyKeyword ||
      ts.isNonNullExpression(node) ||
      ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
        (ts.isAsExpression(node.expression) || ts.isTypeAssertionExpression(node.expression)))
    ) {
      safety.push({
        rule:
          node.kind === ts.SyntaxKind.AnyKeyword
            ? 'explicit-any'
            : ts.isNonNullExpression(node)
              ? 'non-null-assertion'
              : 'double-assertion',
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        identity: hash(node.parent.getText(tree).replace(/\s+/g, ' ')),
      })
    }
    if (isFunction(node)) {
      let complexity = 1
      let nesting = 0
      function measure(child, depth) {
        if (child !== node && isFunction(child)) return
        if (isBranch(child)) complexity++
        const next = depth + (isControl(child) ? 1 : 0)
        nesting = Math.max(nesting, next)
        ts.forEachChild(child, item => measure(item, next))
      }
      measure(node, 0)
      const start = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1
      const end = tree.getLineAndCharacterOfPosition(node.end).line + 1
      const names = []
      for (let parent = node; parent && parent !== tree; parent = parent.parent) {
        if (parent.name) names.unshift(parent.name.getText(tree))
      }
      const name = names.join('.') || '<anonymous>'
      // A content fingerprint allows moves/renames without resetting existing debt.
      const fingerprint = hash(node.body.getText(tree).replace(/\s+/g, ' '))
      functions.push({ file, name, line: start, lines: end - start + 1, complexity, nesting, fingerprint })
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source)
  const codeLines = new Set()
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const text = scanner.getTokenText()
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      for (const match of text.matchAll(/@ts-(?:ignore|nocheck|expect-error)|eslint-disable(?:-next-line|-line)?/g))
        safety.push({
          rule: 'suppression',
          line: tree.getLineAndCharacterOfPosition(scanner.getTokenPos() + match.index).line + 1,
          identity: hash(text.trim()),
        })
    } else if (
      ![ts.SyntaxKind.WhitespaceTrivia, ts.SyntaxKind.NewLineTrivia, ts.SyntaxKind.ShebangTrivia].includes(token)
    ) {
      const start = tree.getLineAndCharacterOfPosition(scanner.getTokenPos()).line
      const end = tree.getLineAndCharacterOfPosition(scanner.getTextPos()).line
      for (let line = start; line <= end; line++) codeLines.add(line)
    }
  }
  return {
    file,
    functions,
    imports,
    safety,
    branchCount: branches,
    functionCount: functions.length,
    importCount: imports.length,
    exportCount: exports,
    maxBlockLines: Math.max(0, ...functions.map(fn => fn.lines)),
    codeLines: codeLines.size,
    parseErrors: tree.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
  }
}

function findingsFor(files, root, compilerOptions) {
  const findings = []
  for (const file of files) {
    for (const fn of file.functions) {
      for (const [metric, limit] of Object.entries(LIMITS)) {
        if (fn[metric] > limit)
          findings.push({
            rule: `function-${metric}`,
            file: file.file,
            name: fn.name,
            line: fn.line,
            value: fn[metric],
            limit,
            identity: `${file.file}:${fn.name}`,
            fingerprint: fn.fingerprint,
          })
      }
    }
    for (const item of file.safety) findings.push({ ...item, file: file.file, value: 1, limit: 0 })
    const domain = /^(engine\/|app\/(classes|services|serialization)\/|app\/lib\/(combat|units)\/)/.test(file.file)
    if (domain)
      for (const request of file.imports) {
        const resolved = ts.resolveModuleName(
          request,
          path.join(root, file.file),
          compilerOptions,
          ts.sys
        ).resolvedModule
        if (!resolved) continue
        const target = normalize(path.relative(root, resolved.resolvedFileName))
        if (/^app\/(ui|screens)\//.test(target))
          findings.push({
            rule: 'domain-to-ui',
            file: file.file,
            identity: `${file.file}->${target}`,
            value: 1,
            limit: 0,
            target,
          })
      }
    for (const message of file.parseErrors)
      findings.push({ rule: 'syntax-error', file: file.file, identity: message, value: 1, limit: 0 })
  }
  return findings
}

function compareFindings(findings, baseline) {
  const remaining = [...baseline]
  const regressions = []
  for (const finding of findings) {
    const index = remaining.findIndex(
      old =>
        old.rule === finding.rule &&
        old.value >= finding.value &&
        ((old.file === finding.file && old.identity === finding.identity) ||
          (finding.fingerprint && old.fingerprint === finding.fingerprint))
    )
    if (index < 0) regressions.push(finding)
    else remaining.splice(index, 1)
  }
  return { regressions, resolved: remaining }
}

function evaluateGate(checks, score, regressions, minimum = 80) {
  const missing = REQUIRED_CHECKS.filter(id => !checks.some(check => check.id === id))
  const incomplete = checks.some(check => ['skipped', 'error'].includes(check.status)) || missing.length > 0
  const reasons = checks.filter(check => check.status !== 'pass').map(check => `${check.label}: ${check.status}`)
  reasons.push(...missing.map(id => `${id}: missing`))
  if (regressions.length) reasons.push(`${regressions.length} new or worsened debt finding(s)`)
  if (score < minimum) reasons.push(`Score ${score} below ${minimum}`)
  return { status: incomplete ? 'incomplete' : reasons.length ? 'fail' : 'pass', reasons }
}

function parseDuplication(source) {
  const data = JSON.parse(source)
  const total = data.statistics?.total
  if (
    !total ||
    !Number.isInteger(total.clones) ||
    total.clones < 0 ||
    !Number.isFinite(total.percentage) ||
    total.percentage < 0 ||
    total.percentage > 100 ||
    !Number.isInteger(total.sources) ||
    total.sources <= 0 ||
    !Array.isArray(data.duplicates) ||
    data.duplicates.length !== total.clones
  )
    throw new Error('Invalid or empty duplication report')
  return { clones: total.clones, percent: total.percentage, sources: total.sources }
}

function parseCycles(source) {
  const cycles = JSON.parse(source)
  if (
    !Array.isArray(cycles) ||
    cycles.some(
      cycle => !Array.isArray(cycle) || !cycle.length || cycle.some(file => typeof file !== 'string' || !file)
    )
  )
    throw new Error('Invalid cycles report')
  return { cycles: cycles.length, baseline: 0, cycleList: cycles, topCycles: cycles.slice(0, 20) }
}

function validateBaseline(baseline, version) {
  if (
    baseline?.version !== version ||
    !Array.isArray(baseline.findings) ||
    !Array.isArray(baseline.coverage) ||
    !baseline.coverage.length
  )
    throw new Error('Unsupported or malformed baseline')
  for (const row of baseline.findings) {
    if (
      typeof row.rule !== 'string' ||
      typeof row.file !== 'string' ||
      typeof row.identity !== 'string' ||
      !Number.isFinite(row.value) ||
      row.value < 0
    )
      throw new Error('Malformed debt baseline')
  }
  const seen = new Set()
  for (const row of baseline.coverage) {
    if (typeof row.file !== 'string' || seen.has(row.file)) throw new Error('Malformed coverage baseline file')
    seen.add(row.file)
    const branch = row.branches
    if (
      !branch ||
      !Number.isFinite(branch.pct) ||
      branch.pct < 0 ||
      branch.pct > 100 ||
      !Number.isInteger(branch.total) ||
      !Number.isInteger(branch.covered) ||
      branch.covered < 0 ||
      branch.total < branch.covered
    )
      throw new Error('Malformed coverage baseline counters')
  }
  return baseline
}

module.exports = {
  validateBaseline,
  REQUIRED_CHECKS,
  analyzeSource,
  findingsFor,
  compareFindings,
  evaluateGate,
  parseDuplication,
  parseCycles,
  LIMITS,
}
