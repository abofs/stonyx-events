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
 * Imports are read from the TypeScript syntax tree, not from raw text, so an
 * import inside a comment or a string literal credits nothing.
 *
 * Limits, covered elsewhere: (2) proves a name is imported, not called (the
 * behavioural sample tests assert on what each call produced); it sees runtime
 * exports only, so type-only exports are left to `pnpm typecheck`; and it
 * counts top-level exports, not class methods.
 *
 * Package-agnostic: it reads the name and exports map from package.json and
 * locates the repo by the working directory, not by this file's location, so
 * it can be copied unchanged into a repo that runs tests from compiled output
 * (e.g. dist-test/). Run it from the repo root, as `pnpm test` does.
 */
import QUnit from 'qunit';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const { module, test } = QUnit;

type ExportTarget = string | { default?: string; import?: string };

const root = process.cwd();
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

/** The import declarations of a file, parsed rather than pattern-matched, so comments and strings are not imports. */
function importsOf(file: string): ts.ImportDeclaration[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  return source.statements.filter(ts.isImportDeclaration);
}

function specifierOf(declaration: ts.ImportDeclaration): string {
  return (declaration.moduleSpecifier as ts.StringLiteral).text;
}

/**
 * Runtime export names a file imports from `specifier`. Type-only imports are
 * excluded; a namespace import (`import * as ns`) credits nothing, so it fails
 * closed rather than crediting every export.
 */
function importedNames(file: string, specifier: string): string[] {
  const names: string[] = [];

  for (const declaration of importsOf(file)) {
    const clause = declaration.importClause;
    if (specifierOf(declaration) !== specifier || !clause || clause.isTypeOnly) continue;
    if (clause.name) names.push('default');

    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (!element.isTypeOnly) names.push((element.propertyName ?? element.name).text);
      }
    }
  }

  return names;
}

/** Files a test imports by relative path, resolved to their .ts source. */
function importedFiles(file: string): string[] {
  return importsOf(file)
    .map(specifierOf)
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => resolve(dirname(file), specifier).replace(/\.js$/, '.ts'));
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
    for (const { specifier } of subpaths) {
      const exported = Object.keys(await import(specifier));
      const imported = new Set(sampleFiles.flatMap((file) => importedNames(file, specifier)));
      const missing = exported.filter((name) => !imported.has(name));

      assert.ok(exported.length > 0, `${specifier} has runtime exports`);
      assert.deepEqual(missing, [], `every runtime export of ${specifier} is imported by a sample`);
    }
  });

  test('every sample is imported by a test', function (assert) {
    const imported = new Set(testFiles.flatMap(importedFiles));

    for (const file of sampleFiles) {
      const rel = relative(root, file).split(sep).join('/');
      assert.ok(imported.has(file), `${rel} is imported by a *-test.ts`);
    }
  });
});
