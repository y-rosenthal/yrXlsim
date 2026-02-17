# Testing yrXlsim

This document describes how the automated tests are implemented and how to run them.

## Overview

Tests are split into two suites:

1. **Core tests** (`test/core.test.js`) — Exercise the shared JavaScript core (`quarto-book/resources/yrxlsim.js`): parsing, fill expansion, grid building, values override, literal `'=` handling, and error conditions. They require the same dependencies as the app (`js-yaml`, `hyperformula`).
2. **CLI tests** (`test/cli.test.js`) — Exercise the command-line interface (`bin/yrxlsim.js`): help output, `render` with file and stdin, `--view`, `--format`, `--output`, invalid input, and `--examples`.

Both suites use Node’s built-in test runner (`node:test`) and assertions (`node:assert`). No extra test framework is installed. The `npm test` script runs the two test files explicitly (`test/core.test.js` and `test/cli.test.js`) for reliable discovery across environments.

## Requirements

- **Node.js 18 or later** — Required for `node --test` and `node:assert` (e.g. `assert.throws` with message).
- **Project dependencies** — From the repo root run `npm install` so `js-yaml` and `hyperformula` are available. The core is loaded by the tests with the same globals the CLI uses (`global.jsyaml`, `global.HyperFormula`).

## How to run tests

From the **project root**:

```bash
# Run all tests (core + CLI)
npm test

# Run only core tests
npm run test:core

# Run only CLI tests
npm run test:cli
```

Or directly with Node:

```bash
node --test test/core.test.js test/cli.test.js
node --test test/core.test.js
node --test test/cli.test.js
```

Tests run with the current working directory at the project root so that paths to `Examples/`, `bin/yrxlsim.js`, and `quarto-book/resources/yrxlsim.js` resolve correctly.

## Implementation details

### Core tests (`test/core.test.js`)

- **Setup:** Before requiring the core, the test file sets `global.jsyaml = require('js-yaml')` and `global.HyperFormula = require('hyperformula').HyperFormula`, then `require('…/quarto-book/resources/yrxlsim.js')`. This matches how `bin/yrxlsim.js` loads the core.
- **Coverage:**
  - **getSheets** — Single-sheet doc returns `[doc]`; multi-sheet doc returns `doc.sheets`; null/non-object returns `[]`.
  - **buildEffectiveGrid** — Rows-only; rows + cells overlay; cells-only (`rows: []`); block fill; row fill with relative ref adjustment.
  - **Literal `'=` (§2.2.1)** — Cell value `"'=not a formula"` is kept in the grid and appears in ASCII output as `=not a formula` (no leading quote).
  - **buildValuesGrid** — A1-keyed `values` override; array form of `values` (experimental).
  - **renderToAscii** — View `both` includes FORMULAS VIEW and VALUES VIEW; view `formulas` omits VALUES VIEW.
  - **Error conditions (§11)** — Empty document (no rows/cells/fill) throws; fill with missing template row or empty template column throws.
  - **Helpers** — `parseA1`, `colIndexToLetters`, `colLettersToIndex` (round-trip and invalid input).
  - **Examples directory** — For each `.yaml`/`.yml` in `Examples/`, one test parses the file and builds the effective grid for every sheet (smoke test).

### CLI tests (`test/cli.test.js`)

- **Execution:** The CLI is run via `child_process.spawnSync('node', [pathToBin, ...args], { cwd: projectRoot, encoding: 'utf8', input })`. No shell is used.
- **Coverage:**
  - **--help / -h** — Exit code 0; stdout contains “yrxlsim”, “render”, “--format”, “--view”.
  - **render &lt;file&gt;** — Exit 0; output includes FORMULAS VIEW and VALUES VIEW for default view.
  - **render &lt;file&gt; --view formulas|values** — Exit 0; formulas view omits VALUES VIEW.
  - **render &lt;file&gt; --format html -o &lt;path&gt;** — Exit 0; output file exists and contains “Formulas” and “Values”.
  - **render -** — Stdin: valid YAML renders and exits 0; invalid (e.g. `rows: []` only) exits non-zero and stderr/stdout mentions “invalid sheet”.
  - **Invocation errors** — No args; `render` without file; invalid `--view` or `--format`; all exit non-zero.
  - **--examples (-e)** — When `Examples/` exists, exit 0 and stdout contains YAML (e.g. “sheets:” or “rows:”).
- **Paths:** All file paths are under the project root (`path.join(__dirname, '..')`). If `Examples/01-minimal-document.yaml` is missing, file-based CLI tests are skipped (no failure).

## Examples and the spec

The files in `Examples/` are aligned with **YAML-SPEC v0.0.2**:

- Any example that previously had `version: "0.0.1"` now has `version: "0.0.2"`.
- `02-cell-value-types.yaml` includes the literal-equals example from §2.2.1: `"'=literal equals"`.

The core test “Examples directory” does not assert on the *content* of each example (e.g. exact used range); it only checks that each example parses and that `buildEffectiveGrid` runs without throwing. To tighten compliance, you could add snapshot or spec-based tests that compare effective grid or ASCII output to expected values.

## Adding or changing tests

- **New core test:** Add a `describe` or `it` in `test/core.test.js`. Use `assert.strictEqual`, `assert.ok`, `assert.throws`, etc. Load the core only once at top level (with globals set).
- **New CLI test:** Add a `describe` or `it` in `test/cli.test.js`. Use `runCli(args, input)` and assert on `r.status`, `r.stdout`, `r.stderr`.
- **New test file:** Add `test/<name>.test.js` and use `node:test` and `node:assert`. Run it with `node --test test/<name>.test.js` or `npm test` (which runs all `test/*.test.js` via `node --test test/`).
