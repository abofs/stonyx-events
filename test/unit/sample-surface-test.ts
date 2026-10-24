/**
 * Sample surface guard.
 *
 * Keeps test/sample/ honest as the canonical usage reference:
 *  1. every package.json#exports subpath resolves to the built entry, so the
 *     samples exercise what consumers install, not src/;
 *  2. every runtime export of every subpath is named in an import clause of
 *     some sample;
 *  3. every sample file is imported by some *-test.ts, so no sample goes
 *     unexecuted.
 *
 * Limits, covered elsewhere: (2) proves a name is imported, not called (the
 * behavioural sample tests assert on what each call produced); it sees runtime
 * exports only, so type-only exports are not checked; and it counts top-level
 * exports, not class methods.
 *
 * Package-agnostic: it reads the name and exports map from package.json, so it
 * can be copied unchanged into other Stonyx library repos.
 */
import QUnit from 'qunit';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { module, test } = QUnit;

type ExportTarget = string | { default?: string; import?: string };

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string;
  exports: Record<string, ExportTarget>;
};

const subpaths = Object.entries(pkg.exports).map(([key, target]) => ({
  specifier: key === '.' ? pkg.name : `${pkg.name}/${key.replace(/^\.\//, '')}`,
  entry: (typeof target === 'string' ? target : (target.import ?? target.default ?? '')).replace(/^\.\//, ''),
}));

function listFiles(dir: string, suffix: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith(suffix))
    .map((file) => join(dir, file));
}

const sampleDir = join(root, 'test', 'sample');
const sampleFiles = listFiles(sampleDir, '.ts');
const testFiles = listFiles(join(root, 'test'), '-test.ts');

/**
 * Resolve a specifier the way an ESM consumer does. Runs in a child process
 * because tsx compiles this file to CommonJS, where import.meta.resolve is
 * unavailable. The eval module's parent URL is the repo root, so the package
 * self-references through its own exports map.
 */
function resolveAsConsumer(specifier: string): string {
  const url = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', 'process.stdout.write(import.meta.resolve(process.argv[1]))', specifier],
    { cwd: root, encoding: 'utf8' },
  );
  return fileURLToPath(url);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Runtime export names named in `import ... from '<specifier>'` clauses (type-only imports excluded). */
function importedNames(source: string, specifier: string): Set<string> {
  const names = new Set<string>();
  const clause = new RegExp(`import\\s+(?!type\\s)([^;]*?)\\s+from\\s+['"]${escapeRegExp(specifier)}['"]`, 'g');

  for (const [, body] of source.matchAll(clause)) {
    const braceAt = body.indexOf('{');
    const head = (braceAt === -1 ? body : body.slice(0, braceAt)).replace(/,\s*$/, '').trim();
    if (head && !head.startsWith('*')) names.add('default');

    if (braceAt !== -1) {
      for (const part of body.slice(braceAt + 1, body.indexOf('}')).split(',')) {
        const item = part.trim();
        if (!item || item.startsWith('type ')) continue;
        names.add(item.split(/\s+as\s+/)[0].trim());
      }
    }
  }

  return names;
}

module('[Unit] Sample surface', function () {
  test('test/sample/ contains samples', function (assert) {
    assert.ok(sampleFiles.length > 0, `found ${sampleFiles.length} sample file(s)`);
    assert.ok(subpaths.length > 0, `package.json declares ${subpaths.length} export subpath(s)`);
  });

  test('every export subpath resolves to the built entry', function (assert) {
    for (const { specifier, entry } of subpaths) {
      assert.ok(entry.startsWith('dist/'), `${specifier} is declared as built output (${entry})`);
      const resolved = resolveAsConsumer(specifier);
      assert.strictEqual(relative(root, resolved).split(sep).join('/'), entry, `${specifier} -> ${entry}`);
    }
  });

  test('every runtime export is imported by a sample', async function (assert) {
    const sources = sampleFiles.map((file) => readFileSync(file, 'utf8'));

    for (const { specifier } of subpaths) {
      const exported = Object.keys(await import(specifier));
      const imported = new Set(sources.flatMap((source) => [...importedNames(source, specifier)]));
      const missing = exported.filter((name) => !imported.has(name));

      assert.ok(exported.length > 0, `${specifier} has runtime exports`);
      assert.deepEqual(missing, [], `every runtime export of ${specifier} is imported by a sample`);
    }
  });

  test('every sample is imported by a test', function (assert) {
    const tests = testFiles.map((file) => readFileSync(file, 'utf8'));

    for (const file of sampleFiles) {
      const rel = relative(sampleDir, file).split(sep).join('/').replace(/\.ts$/, '.js');
      const pattern = new RegExp(`from\\s+['"][^'"]*/sample/${escapeRegExp(rel)}['"]`);
      assert.ok(tests.some((source) => pattern.test(source)), `test/sample/${rel.replace(/\.js$/, '.ts')} is imported by a *-test.ts`);
    }
  });
});
