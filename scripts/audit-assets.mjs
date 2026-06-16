#!/usr/bin/env node
/**
 * Audit unused/missing assets by comparing:
 *  - public/assets/ (files on disk)
 *  - app/config/assetManifest.js (declared assets)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets')
const MANIFEST_PATH = path.join(ROOT, 'app', 'config', 'assetManifest.js')

// ── Parse manifest ────────────────────────────────────────────────────────────

function extractManifestPaths() {
  const src = fs.readFileSync(MANIFEST_PATH, 'utf8')
  const paths = new Set()

  // Direct string literals: 'assets/...' (only actual file paths with extension)
  const directMatches = src.matchAll(/'(assets\/[^']+\.[a-z0-9]+)'/g)
  for (const m of directMatches) paths.add(m[1])

  // toTextureBundle('assets/graphics', [...ids...])
  // → generates assets/graphics/{id}/texture.json
  const textureBundleMatch = src.match(/toTextureBundle\('([^']+)',\s*\[([^\]]+)\]/s)
  if (textureBundleMatch) {
    const basePath = textureBundleMatch[1]
    const ids = textureBundleMatch[2].matchAll(/'(\d+)'/g)
    for (const m of ids) {
      paths.add(`${basePath}/${m[1]}/texture.json`)
    }
  }

  // toSoundBundle([...ids...]) → assets/sounds/{id}.wav
  const soundBundleMatch = src.match(/toSoundBundle\(\s*\[([^\]]+)\]/s)
  if (soundBundleMatch) {
    const ids = soundBundleMatch[1].matchAll(/'(\d+)'/g)
    for (const m of ids) {
      paths.add(`assets/sounds/${m[1]}.wav`)
    }
  }

  return paths
}

// ── Walk disk ─────────────────────────────────────────────────────────────────

function walkDir(dir, base = PUBLIC_ASSETS) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full, base))
    } else if (entry.name !== '.DS_Store') {
      // Produce path relative to public/ so it matches manifest style: assets/...
      results.push(path.relative(path.join(ROOT, 'public'), full))
    }
  }
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────

const manifestPaths = extractManifestPaths()
const diskFiles = walkDir(PUBLIC_ASSETS)

const unused = diskFiles.filter(f => !manifestPaths.has(f))
const missing = [...manifestPaths].filter(p => !diskFiles.includes(p))

// Group unused by category
function groupBy(files) {
  return files.reduce((acc, f) => {
    const parts = f.replace('assets/', '').split('/')
    const cat = parts[0]
    ;(acc[cat] ??= []).push(f)
    return acc
  }, {})
}

// ── Report ────────────────────────────────────────────────────────────────────

const totalDisk = diskFiles.length
const totalManifest = manifestPaths.size

console.log('\n═══════════════════════════════════════════════')
console.log('           ASSET AUDIT REPORT')
console.log('═══════════════════════════════════════════════')
console.log(`Files on disk:        ${totalDisk}`)
console.log(`Paths in manifest:    ${totalManifest}`)
console.log(`Unused (on disk, not in manifest): ${unused.length}`)
console.log(`Missing (in manifest, not on disk): ${missing.length}`)

if (unused.length > 0) {
  console.log('\n───────────────────────────────────────────────')
  console.log(' UNUSED FILES (on disk but not in manifest)')
  console.log('───────────────────────────────────────────────')
  const grouped = groupBy(unused)
  for (const [cat, files] of Object.entries(grouped)) {
    console.log(`\n[${cat}] — ${files.length} file(s)`)
    // For graphics, just show folder IDs (not every .png inside)
    if (cat === 'graphics') {
      const folderIds = [...new Set(files.map(f => f.split('/')[2]))]
      console.log(`  Folder IDs: ${folderIds.join(', ')}`)
    } else {
      for (const f of files) console.log(`  ${f}`)
    }
  }
}

if (missing.length > 0) {
  console.log('\n───────────────────────────────────────────────')
  console.log(' MISSING FILES (in manifest but not on disk)')
  console.log('───────────────────────────────────────────────')
  const grouped = groupBy(missing)
  for (const [cat, files] of Object.entries(grouped)) {
    console.log(`\n[${cat}] — ${files.length} file(s)`)
    for (const f of files) console.log(`  ${f}`)
  }
}

// Disk usage of unused files
const unusedBytes = unused.reduce((sum, f) => {
  try {
    return sum + fs.statSync(path.join(ROOT, 'public', f)).size
  } catch {
    return sum
  }
}, 0)

const unusedMb = (unusedBytes / 1024 / 1024).toFixed(1)

if (unused.length > 0) {
  console.log(`\nDisk space recoverable: ~${unusedMb} MB`)
}

console.log('\n═══════════════════════════════════════════════\n')

// ── JSON export ───────────────────────────────────────────────────────────────

const report = {
  summary: {
    filesOnDisk: totalDisk,
    pathsInManifest: totalManifest,
    unusedCount: unused.length,
    missingCount: missing.length,
    recoverableMb: parseFloat(unusedMb),
  },
  unused: groupBy(unused),
  missing: groupBy(missing),
}

const outPath = path.join(ROOT, 'scripts', 'asset-audit-report.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(`Report written to: scripts/asset-audit-report.json\n`)
