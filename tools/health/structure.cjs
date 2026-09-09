const path = require('node:path')
const {
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
} = require('./config.cjs')

function getStructureDebt(files, folders = analyzeFolders(files)) {
  const largeFiles = files.filter(file => file.loc >= LARGE_FILE_THRESHOLD).length
  const hugeFiles = files.filter(file => file.loc >= HUGE_FILE_THRESHOLD).length
  const complexFiles = files.filter(
    file => file.branchCount >= COMPLEX_BRANCH_THRESHOLD || file.maxBlockLines >= COMPLEX_BLOCK_THRESHOLD
  ).length
  const crowdedFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_WARNING).length
  const severeFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_SEVERE).length
  const highLocFolders = folders.filter(folder => folder.loc > MAX_LOC_PER_FOLDER_WARNING).length
  const highBranchFolders = folders.filter(folder => folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING).length
  const deepFolders = folders.filter(folder => folder.depth > MAX_FOLDER_DEPTH_WARNING).length
  const heavyIndexes = getHeavyIndexFiles(files).length
  const namingViolations = getNamingViolations(files).length

  return [
    {
      signal: 'Large files',
      count: largeFiles,
      threshold: `LOC >= ${LARGE_FILE_THRESHOLD}`,
      penalty: largeFiles * 0.9,
    },
    {
      signal: 'Huge files',
      count: hugeFiles,
      threshold: `LOC >= ${HUGE_FILE_THRESHOLD}`,
      penalty: hugeFiles * 1.3,
    },
    {
      signal: 'Complex files',
      count: complexFiles,
      threshold: `branches >= ${COMPLEX_BRANCH_THRESHOLD} or max block >= ${COMPLEX_BLOCK_THRESHOLD}`,
      penalty: complexFiles * 0.8,
    },
    {
      signal: 'Crowded folders',
      count: crowdedFolders,
      threshold: `files > ${MAX_FILES_PER_FOLDER_WARNING}`,
      penalty: crowdedFolders * 0.7,
    },
    {
      signal: 'Severely crowded folders',
      count: severeFolders,
      threshold: `files > ${MAX_FILES_PER_FOLDER_SEVERE}`,
      penalty: severeFolders * 1.4,
    },
    {
      signal: 'High LOC folders',
      count: highLocFolders,
      threshold: `LOC > ${MAX_LOC_PER_FOLDER_WARNING}`,
      penalty: highLocFolders * 0.8,
    },
    {
      signal: 'High branch folders',
      count: highBranchFolders,
      threshold: `branches > ${MAX_BRANCHES_PER_FOLDER_WARNING}`,
      penalty: highBranchFolders * 0.8,
    },
    {
      signal: 'Deep folders',
      count: deepFolders,
      threshold: `depth > ${MAX_FOLDER_DEPTH_WARNING}`,
      penalty: deepFolders * 0.5,
    },
    {
      signal: 'Heavy index files',
      count: heavyIndexes,
      threshold: `index.ts LOC > ${INDEX_FILE_LOC_WARNING}`,
      penalty: heavyIndexes * 0.9,
    },
    {
      signal: 'Naming mismatches',
      count: namingViolations,
      threshold: 'folder naming convention mismatch',
      penalty: Math.min(2, namingViolations * 0.2),
    },
  ].map(row => ({ ...row, penalty: Math.round(row.penalty * 10) / 10 }))
}

function analyzeFolders(files) {
  const folders = new Map()
  for (const file of files) {
    const dir = path.dirname(file.file)
    const parts = dir.split(path.sep)
    const entry = folders.get(dir) ?? {
      folder: dir,
      files: 0,
      loc: 0,
      branches: 0,
      depth: parts.length,
    }
    entry.files += 1
    entry.loc += file.loc
    entry.branches += file.branchCount
    folders.set(dir, entry)
  }
  return [...folders.values()].sort((a, b) => b.files - a.files || b.loc - a.loc)
}

function folderRefactorReason(folder) {
  const reasons = []
  if (folder.files > MAX_FILES_PER_FOLDER_SEVERE) reasons.push(`severe file count > ${MAX_FILES_PER_FOLDER_SEVERE}`)
  else if (folder.files > MAX_FILES_PER_FOLDER_WARNING) reasons.push(`file count > ${MAX_FILES_PER_FOLDER_WARNING}`)
  if (folder.loc > MAX_LOC_PER_FOLDER_WARNING) reasons.push(`LOC > ${MAX_LOC_PER_FOLDER_WARNING}`)
  if (folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING) reasons.push(`branches > ${MAX_BRANCHES_PER_FOLDER_WARNING}`)
  if (folder.depth > MAX_FOLDER_DEPTH_WARNING) reasons.push(`depth > ${MAX_FOLDER_DEPTH_WARNING}`)
  return reasons.join(', ')
}

function folderRefactorSuggestion(folder) {
  if (folder.folder === 'app/lib')
    return 'Split by domain: i18n, lpc, map/terrain, gameplay helpers, rendering helpers.'
  if (folder.folder === 'app/ui') return 'Group related UI panels and overlays into feature folders.'
  if (folder.folder === 'app/classes/map')
    return 'Keep map orchestration thin; move terrain, resources, fog, blueprints, and water into focused modules.'
  if (folder.folder === 'app/classes/unit')
    return 'Keep Unit as composition root; move movement, actions, resources, experience, and runtime state into narrow modules.'
  return 'Split files by feature/domain until the folder has a clear single responsibility.'
}

function folderStructureRisk(folder) {
  return (
    Math.max(0, folder.files - MAX_FILES_PER_FOLDER_WARNING) * 2 +
    Math.max(0, folder.loc - MAX_LOC_PER_FOLDER_WARNING) / 120 +
    Math.max(0, folder.branches - MAX_BRANCHES_PER_FOLDER_WARNING) / 12 +
    Math.max(0, folder.depth - MAX_FOLDER_DEPTH_WARNING) * 8
  )
}

function getFolderRefactorCandidates(folders) {
  return folders
    .filter(
      folder =>
        folder.files > MAX_FILES_PER_FOLDER_WARNING ||
        folder.loc > MAX_LOC_PER_FOLDER_WARNING ||
        folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING ||
        folder.depth > MAX_FOLDER_DEPTH_WARNING
    )
    .map(folder => ({
      ...folder,
      risk: Math.round(folderStructureRisk(folder) * 10) / 10,
      why: folderRefactorReason(folder),
      suggestion: folderRefactorSuggestion(folder),
    }))
    .sort((a, b) => b.risk - a.risk || b.files - a.files)
}

function namingStyle(file) {
  const name = path.basename(file.file, '.ts')
  if (/^[A-Z][A-Za-z0-9]*$/.test(name)) return 'PascalCase'
  if (/^[a-z][A-Za-z0-9]*$/.test(name)) return 'camelCase'
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return 'kebab-case'
  return 'mixed'
}

function analyzeNaming(files) {
  const counts = new Map()
  for (const file of files) {
    const style = namingStyle(file)
    counts.set(style, (counts.get(style) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => b.count - a.count || a.style.localeCompare(b.style))
}

function expectedNamingStyle(file) {
  if (file.file.endsWith('/index.ts')) return null
  const basename = path.basename(file.file, '.ts')
  if (['config', 'constants', 'types', 'unitGroups'].includes(basename)) return 'camelCase'
  if (
    file.file.includes('/ui/utils/') ||
    file.file.includes('/ui/modals/') ||
    basename === 'pausableRuntime' ||
    basename === 'runtimeServices' ||
    basename === 'locomotion'
  ) {
    return 'camelCase'
  }
  if (
    file.file.includes('/ui/') ||
    file.file.includes('/screens/') ||
    file.file.includes('/classes/') ||
    file.file.includes('/ai/') ||
    file.file.includes('/services/') ||
    file.file.includes('/controllers/') ||
    file.file.includes('/serialization/')
  ) {
    return 'PascalCase'
  }
  if (file.file.includes('/lib/') || file.file.includes('/config/') || file.file.includes('/constants/')) {
    return 'camelCase'
  }
  return null
}

function getNamingViolations(files) {
  return files
    .map(file => ({
      file: file.file,
      style: namingStyle(file),
      expected: expectedNamingStyle(file),
    }))
    .filter(row => row.expected && row.style !== row.expected)
}

function getHeavyIndexFiles(files) {
  return files
    .filter(file => file.file.endsWith('/index.ts') && file.loc > INDEX_FILE_LOC_WARNING)
    .sort((a, b) => b.loc - a.loc)
}

function professionalRuleRows(files, folders) {
  const crowdedFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_WARNING).length
  const severeFolders = folders.filter(folder => folder.files > MAX_FILES_PER_FOLDER_SEVERE).length
  const highLocFolders = folders.filter(folder => folder.loc > MAX_LOC_PER_FOLDER_WARNING).length
  const highBranchFolders = folders.filter(folder => folder.branches > MAX_BRANCHES_PER_FOLDER_WARNING).length
  const deepFolders = folders.filter(folder => folder.depth > MAX_FOLDER_DEPTH_WARNING).length
  const heavyIndexes = getHeavyIndexFiles(files).length
  const namingViolations = getNamingViolations(files).length
  return [
    {
      rule: 'Dossiers trop charges',
      status: severeFolders ? 'FAIL' : crowdedFolders ? 'WARN' : 'OK',
      detail: `${crowdedFolders} dossier(s) avec plus de ${MAX_FILES_PER_FOLDER_WARNING} fichiers TS`,
    },
    {
      rule: 'Dossiers severement charges',
      status: severeFolders ? 'FAIL' : 'OK',
      detail: `${severeFolders} dossier(s) avec plus de ${MAX_FILES_PER_FOLDER_SEVERE} fichiers TS`,
    },
    {
      rule: 'Dossiers trop volumineux',
      status: highLocFolders ? 'WARN' : 'OK',
      detail: `${highLocFolders} dossier(s) avec plus de ${MAX_LOC_PER_FOLDER_WARNING} lignes`,
    },
    {
      rule: 'Dossiers trop branches',
      status: highBranchFolders ? 'WARN' : 'OK',
      detail: `${highBranchFolders} dossier(s) avec plus de ${MAX_BRANCHES_PER_FOLDER_WARNING} branches approx.`,
    },
    {
      rule: 'Profondeur de dossiers',
      status: deepFolders ? 'WARN' : 'OK',
      detail: `${deepFolders} dossier(s) au-dela de ${MAX_FOLDER_DEPTH_WARNING} niveaux`,
    },
    {
      rule: 'Index trop lourds',
      status: heavyIndexes ? 'WARN' : 'OK',
      detail: `${heavyIndexes} index.ts avec plus de ${INDEX_FILE_LOC_WARNING} lignes`,
    },
    {
      rule: 'Nomenclature par zone',
      status: namingViolations ? 'WARN' : 'OK',
      detail: `${namingViolations} fichier(s) ne suivent pas la convention attendue de leur dossier`,
    },
  ]
}

module.exports = {
  getStructureDebt,
  analyzeFolders,
  getFolderRefactorCandidates,
  getHeavyIndexFiles,
  analyzeNaming,
  getNamingViolations,
  professionalRuleRows,
}
