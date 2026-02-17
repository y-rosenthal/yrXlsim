/**
 * Automated tests for the yrxlsim CLI (bin/yrxlsim.js).
 * Run with: node --test test/cli.test.js
 * Requires Node 18+ (node:test). Runs the CLI via child_process.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const cliPath = path.join(projectRoot, 'bin/yrxlsim.js');
const examplesDir = path.join(projectRoot, 'Examples');

function runCli(args, input) {
  const result = spawnSync('node', [cliPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    input: input || undefined,
    timeout: 15000
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    error: result.error
  };
}

describe('CLI --help', () => {
  it('--help exits 0 and prints usage', () => {
    const r = runCli(['--help']);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('yrxlsim'));
    assert.ok(r.stdout.includes('render'));
    assert.ok(r.stdout.includes('--format'));
    assert.ok(r.stdout.includes('--view'));
  });

  it('-h exits 0', () => {
    const r = runCli(['-h']);
    assert.strictEqual(r.status, 0);
  });
});

describe('CLI render (file)', () => {
  const sampleYaml = path.join(examplesDir, '01-minimal-document.yaml');
  const hasExamples = fs.existsSync(sampleYaml);

  it('render <file> exits 0 and output includes FORMULAS VIEW when view is both', () => {
    if (!hasExamples) return;
    const r = runCli(['render', sampleYaml]);
    assert.strictEqual(r.status, 0, 'exit 0');
    assert.ok(r.stdout.includes('FORMULAS VIEW'));
    assert.ok(r.stdout.includes('VALUES VIEW'));
    assert.ok(r.stdout.includes('Label'));
  });

  it('render <file> --view formulas exits 0 and omits VALUES VIEW', () => {
    if (!hasExamples) return;
    const r = runCli(['render', sampleYaml, '--view', 'formulas']);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes('VALUES VIEW'));
    assert.ok(r.stdout.includes('Label'));
  });

  it('render <file> --view values exits 0', () => {
    if (!hasExamples) return;
    const r = runCli(['render', sampleYaml, '--view', 'values']);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.length > 0);
  });

  it('render <file> --format html -o <path> writes file', () => {
    if (!hasExamples) return;
    const outPath = path.join(projectRoot, 'test', 'cli-output-test.html');
    const r = runCli(['render', sampleYaml, '--format', 'html', '--output', outPath]);
    assert.strictEqual(r.status, 0);
    assert.ok(fs.existsSync(outPath));
    const content = fs.readFileSync(outPath, 'utf8');
    assert.ok(content.includes('Formulas'));
    assert.ok(content.includes('Values'));
    try { fs.unlinkSync(outPath); } catch (_) {}
  });
});

describe('CLI render (stdin)', () => {
  it('render - reads YAML from stdin and renders', () => {
    const r = runCli(['render', '-'], 'version: "0.0.2"\nrows:\n  - ["A", "B"]\n');
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('A'));
  });

  it('render - with invalid doc (empty) exits non-zero', () => {
    const r = runCli(['render', '-'], 'rows: []\n');
    assert.notStrictEqual(r.status, 0);
    assert.ok(r.stderr.includes('invalid sheet') || r.stdout.includes('invalid sheet'));
  });
});

describe('CLI invocation errors', () => {
  it('no args prints usage to stderr and exits non-zero', () => {
    const r = runCli([]);
    assert.notStrictEqual(r.status, 0);
    assert.ok(r.stderr.length > 0 || r.stdout.length > 0);
  });

  it('render without file argument exits non-zero', () => {
    const r = runCli(['render']);
    assert.notStrictEqual(r.status, 0);
  });

  it('invalid --view value exits non-zero', () => {
    const sampleYaml = path.join(examplesDir, '01-minimal-document.yaml');
    if (!fs.existsSync(sampleYaml)) return;
    const r = runCli(['render', sampleYaml, '--view', 'invalid']);
    assert.notStrictEqual(r.status, 0);
  });

  it('invalid --format value exits non-zero', () => {
    const sampleYaml = path.join(examplesDir, '01-minimal-document.yaml');
    if (!fs.existsSync(sampleYaml)) return;
    const r = runCli(['render', sampleYaml, '--format', 'pdf']);
    assert.notStrictEqual(r.status, 0);
  });
});

describe('CLI --examples', () => {
  it('-e exits 0 and prints YAML with sheets key when Examples exist', () => {
    if (!fs.existsSync(examplesDir)) return;
    const r = runCli(['-e']);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('sheets:') || r.stdout.includes('rows:'));
  });
});
