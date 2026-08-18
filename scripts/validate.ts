const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const IGNORED_NAMES = new Set(['.git', 'node_modules']);
const PUBLIC_PATH_DENYLIST = new Set([
  'credential',
  'credentials',
  'customer',
  'customers',
  'incident',
  'incidents',
  'internal',
  'private',
  'secret',
  'secrets',
]);

const SECRET_PATTERNS = [
  { name: 'private key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { name: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Cloudflare artifact token', pattern: /\bart_v1_[A-Za-z0-9_-]{20,}\b/ },
  {
    name: 'quoted secret assignment',
    pattern: /\b(?:api[_-]?key|access[_-]?token|password|secret)\b\s*[:=]\s*["'][^"'\n]{16,}["']/i,
  },
];
const SCRIPT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.sh', '.ts']);

function exists(filePath) {
  return fs.existsSync(filePath);
}

function isDirectory(filePath) {
  return exists(filePath) && fs.statSync(filePath).isDirectory();
}

function isRegularFile(filePath) {
  return exists(filePath) && fs.statSync(filePath).isFile();
}

function listEntries(directory) {
  if (!isDirectory(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true });
}

function walkFiles(directory, relative = '') {
  if (!isDirectory(directory)) return [];
  const files = [];
  for (const entry of listEntries(directory)) {
    if (IGNORED_NAMES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const childRelative = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      files.push({ absolute, relative: childRelative, symlink: true });
    } else if (entry.isDirectory()) {
      files.push(...walkFiles(absolute, childRelative));
    } else if (entry.isFile()) {
      files.push({ absolute, relative: childRelative, symlink: false });
    }
  }
  return files;
}

function readText(filePath) {
  const content = fs.readFileSync(filePath);
  if (content.includes(0)) return null;
  return content.toString('utf8');
}

function parseFrontMatter(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return null;
  const values = {};
  for (const line of content.slice(4, end).split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function extractMarkdownLinks(content) {
  const links = [];
  const pattern = /!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g;
  for (const match of content.matchAll(pattern)) links.push(match[1]);
  return links;
}

function duplicateNames(values) {
  const byName = new Map();
  for (const value of values) {
    const current = byName.get(value.name) || [];
    current.push(value.source);
    byName.set(value.name, current);
  }
  return [...byName.entries()]
    .filter(([, sources]) => sources.length > 1)
    .map(([name, sources]) => ({ name, sources }));
}

function scanTextForSecrets(content) {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(({ name }) => name);
}

function validateRelativeLinks(file, content, errors, root = ROOT) {
  for (const rawLink of extractMarkdownLinks(content)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(rawLink)) continue;
    const withoutFragment = rawLink.split('#', 1)[0];
    if (!withoutFragment) continue;
    const target = path.resolve(path.dirname(file.absolute), decodeURIComponent(withoutFragment));
    const relativeTarget = path.relative(root, target);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget) || !exists(target)) {
      errors.push(`${file.relative}: missing relative reference ${rawLink}`);
    }
  }
}

function validateScriptLayout(root, errors) {
  const scriptFiles = [
    ...walkFiles(path.join(root, 'scripts')),
    ...walkFiles(path.join(root, '.agents', 'skills')).filter((file) => file.relative.split(path.sep).includes('scripts')),
  ];
  for (const file of scriptFiles) {
    if (file.symlink) continue;
    if (path.basename(file.relative).startsWith('.')) continue;
    const extension = path.extname(file.relative).toLowerCase();
    if (!SCRIPT_EXTENSIONS.has(extension)) {
      errors.push(`${file.relative}: unsupported script extension ${extension || '(none)'}`);
      continue;
    }
    const content = readText(file.absolute);
    if (content === null) {
      errors.push(`${file.relative}: scripts must be text files`);
    } else if (extension === '.sh' && !content.startsWith('#!')) {
      errors.push(`${file.relative}: shell scripts must start with a shebang`);
    }
  }
}

function validateRepository(root = ROOT) {
  const errors = [];
  const warnings = [];
  const files = walkFiles(root);
  const skillsRoot = path.join(root, '.agents', 'skills');
  const rulesRoot = path.join(root, '.agents', 'rules');
  const resourcesRoot = path.join(root, '.agents', 'resources');

  for (const file of files) {
    const parts = file.relative.split(path.sep);
    if (parts.some((part) => PUBLIC_PATH_DENYLIST.has(part.toLowerCase()))) {
      errors.push(`${file.relative}: path is outside the public repository boundary`);
    }
    if (file.symlink) {
      errors.push(`${file.relative}: symlinks are not allowed in the public content tree`);
      continue;
    }
    const content = readText(file.absolute);
    if (content !== null) {
      const secretMatches = scanTextForSecrets(content);
      for (const match of secretMatches) errors.push(`${file.relative}: possible ${match}`);
      if (path.extname(file.relative).toLowerCase() === '.md') {
        validateRelativeLinks(file, content, errors, root);
      }
    }
  }

  const requiredFiles = [
    'README.md',
    'LICENSE',
    'CONTRIBUTING.md',
    'docs/authoring.md',
    'docs/runtime-contract.md',
    'package.json',
    'scripts/validate.ts',
    'scripts/validate.test.ts',
  ];
  for (const relative of requiredFiles) {
    if (!isRegularFile(path.join(root, relative))) errors.push(`${relative}: required file is missing`);
  }

  const licensePath = path.join(root, 'LICENSE');
  const license = isRegularFile(licensePath) ? fs.readFileSync(licensePath, 'utf8') : '';
  if (!license.includes('MIT License') || !license.includes('Permission is hereby granted')) {
    errors.push('LICENSE: expected MIT license text was not found');
  }

  const packageFile = path.join(root, 'package.json');
  if (isRegularFile(packageFile)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      if (packageJson.license !== 'MIT') errors.push('package.json: license must be MIT');
      if (packageJson.scripts?.validate !== 'node scripts/validate.ts') {
        errors.push('package.json: validate script must run scripts/validate.ts');
      }
      if (packageJson.scripts?.test !== 'node --test scripts/validate.test.ts') {
        errors.push('package.json: test script must run scripts/validate.test.ts');
      }
    } catch (error) {
      errors.push(`package.json: invalid JSON (${error.message})`);
    }
  }

  for (const directory of [skillsRoot, rulesRoot, resourcesRoot, path.join(root, 'scripts')]) {
    if (!isDirectory(directory)) errors.push(`${path.relative(root, directory)}: required directory is missing`);
  }

  validateScriptLayout(root, errors);

  const skills = [];
  for (const entry of listEntries(skillsRoot)) {
    if (entry.name.startsWith('.')) continue;
    const skillDirectory = path.join(skillsRoot, entry.name);
    if (!entry.isDirectory()) {
      errors.push(`.agents/skills/${entry.name}: skills must be directories`);
      continue;
    }
    const skillFile = path.join(skillDirectory, 'SKILL.md');
    if (!isRegularFile(skillFile)) {
      errors.push(`.agents/skills/${entry.name}: SKILL.md is required`);
      continue;
    }
    const metadata = parseFrontMatter(fs.readFileSync(skillFile, 'utf8'));
    if (!metadata) {
      errors.push(`.agents/skills/${entry.name}/SKILL.md: YAML front matter is required`);
      continue;
    }
    if (!metadata.name) errors.push(`.agents/skills/${entry.name}/SKILL.md: name is required`);
    if (!metadata.description) errors.push(`.agents/skills/${entry.name}/SKILL.md: description is required`);
    if (metadata.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name)) {
      errors.push(`.agents/skills/${entry.name}/SKILL.md: name must be lowercase kebab-case`);
    }
    if (metadata.name && metadata.name !== entry.name) {
      errors.push(`.agents/skills/${entry.name}/SKILL.md: name must match the directory name`);
    }
    if (metadata.name) skills.push({ name: metadata.name, source: `.agents/skills/${entry.name}` });
  }

  const rules = [];
  for (const file of walkFiles(rulesRoot)) {
    if (file.symlink) continue;
    const base = path.basename(file.relative);
    if (base.startsWith('.') || base === 'README.md') continue;
    if (path.extname(base).toLowerCase() !== '.md') {
      errors.push(`${file.relative}: rules must be Markdown files`);
      continue;
    }
    rules.push({ name: path.basename(base, path.extname(base)).toLowerCase(), source: file.relative });
  }

  for (const duplicate of duplicateNames(skills)) {
    warnings.push(`duplicate skill name ${duplicate.name}: ${duplicate.sources.join(', ')}`);
  }
  for (const duplicate of duplicateNames(rules)) {
    warnings.push(`duplicate rule name ${duplicate.name}: ${duplicate.sources.join(', ')}`);
  }

  const workflowFiles = files.filter((file) => /^\.github[\\/]workflows[\\/].+\.ya?ml$/.test(file.relative));
  if (workflowFiles.length === 0) errors.push('.github/workflows: validation workflow is required');
  for (const workflow of workflowFiles) {
    const content = readText(workflow.absolute) || '';
    if (!/pull_request/.test(content) || !/push:/.test(content)) {
      errors.push(`${workflow.relative}: must run for pull requests and pushes`);
    }
    if (!/contents:\s*read/.test(content)) errors.push(`${workflow.relative}: contents: read permission is required`);
    if (/contents:\s*write/.test(content) || /secrets\./.test(content)) {
      errors.push(`${workflow.relative}: runtime or write credentials are not allowed`);
    }
  }

  const runtimePath = path.join(root, 'docs/runtime-contract.md');
  const runtimeContract = isRegularFile(runtimePath) ? fs.readFileSync(runtimePath, 'utf8').toLowerCase() : '';
  for (const phrase of ['anonymous', 'read-only', 'no cloudflare mirror', 'no runtime github credential']) {
    if (!runtimeContract.includes(phrase)) errors.push(`docs/runtime-contract.md: missing required contract phrase ${phrase}`);
  }

  return { errors, warnings, counts: { files: files.length, skills: skills.length, rules: rules.length } };
}

function main() {
  const result = validateRepository();
  console.log(`Validated ${result.counts.files} files (${result.counts.skills} skills, ${result.counts.rules} rules).`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Public repository contract passed.');
}

module.exports = {
  duplicateNames,
  extractMarkdownLinks,
  parseFrontMatter,
  scanTextForSecrets,
  validateRepository,
};

if (require.main === module) main();
