import { readdirSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, extname } from 'path';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';

// Static validation that runs without a live farmOS:
//  - every .alink.vue parses and its <script>/<template> compile
//  - repo.json is valid and only references .alink.vue URLs
//  - the shared .js helpers are syntactically valid (node --check, which does
//    not resolve their runtime imports)
const root = process.cwd();
const errors = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.alink.vue')) {
      checkAlink(full);
    }
  }
}

function checkAlink(file) {
  const source = readFileSync(file, 'utf8');
  const { descriptor, errors: parseErrors } = parse(source, { filename: file });
  if (parseErrors.length) {
    errors.push(`${file}: parse error: ${parseErrors.map((e) => e.message).join('; ')}`);
    return;
  }
  try {
    compileScript(descriptor, { id: file, inlineTemplate: false });
  } catch (e) {
    errors.push(`${file}: script compile error: ${e.message}`);
  }
  if (descriptor.template) {
    try {
      compileTemplate({ source: descriptor.template.content, filename: file, id: file });
    } catch (e) {
      errors.push(`${file}: template compile error: ${e.message}`);
    }
  }
}

// Validate repo.json
try {
  const repo = JSON.parse(readFileSync(join(root, 'jorblads-plugins.repo.json'), 'utf8'));
  if (!Array.isArray(repo.plugins)) {
    errors.push('repo.json: missing "plugins" array');
  } else {
    repo.plugins.forEach((p, i) => {
      if (!p.url || !p.url.endsWith('.alink.vue')) {
        errors.push(`repo.json plugins[${i}]: url must end with .alink.vue`);
      }
    });
  }
} catch (e) {
  errors.push(`repo.json: ${e.message}`);
}

// Syntax-check the shared .js helpers (their runtime imports are not resolved here).
for (const f of ['useFarmOS.js', 'AssetLogsPanel.js']) {
  try {
    execSync(`node --check ${f}`, { cwd: root, stdio: 'pipe' });
  } catch {
    errors.push(`${f}: syntax error`);
  }
}

walk(root);

if (errors.length) {
  console.error('Validation FAILED:');
  errors.forEach((e) => console.error(` - ${e}`));
  process.exit(1);
}

console.log('Validation OK: all plugins parse, repo.json is valid.');
