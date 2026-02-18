#!/usr/bin/env node
/**
 * yrxlsim CLI — render yrXlsim YAML to ASCII (terminal) or standalone HTML.
 * Uses the same quarto-book/resources/yrxlsim.js core as the Quarto browser renderer.
 */

const fs = require('fs');
const path = require('path');

// Provide dependencies for the shared core (same as browser: js-yaml + HyperFormula)
global.jsyaml = require('js-yaml');
const { HyperFormula } = require('hyperformula');
global.HyperFormula = HyperFormula;

// Single source of truth: quarto-book/resources/yrxlsim.js (used by Quarto and CLI)
const yrxlsim = require('../quarto-book/resources/yrxlsim.js');

const DEFAULT_VIEW = 'both';
const VIEWS = ['formulas', 'values', 'both'];
const FORMATS = ['ascii', 'html'];

function usage() {
  const bin = path.basename(process.argv[1]);
  return `
yrxlsim — render yrXlsim YAML spreadsheet files to ASCII (terminal) or standalone HTML.

DESCRIPTION
  Reads a yrXlsim sheet definition (YAML with rows, cells, fill, values, meta) and
  outputs either:
    • ASCII — Column letters, row numbers, and + - | grid; FORMULAS view and/or
      VALUES view (evaluated with HyperFormula). Suitable for terminals and
      inclusion in docs (e.g. Quarto bash chunks).
    • HTML  — A single HTML file with bundled CSS and pre-rendered Formulas and
      Values tables. No external scripts; open in any browser.

  Uses the same JavaScript core (quarto-book/resources/yrxlsim.js) as the
  Quarto in-browser renderer, so formula evaluation and behavior match exactly.

INPUT FORMAT (YAML spec v0.0.2)
  The input file is a YAML document: either a single sheet (rows, cells, fill,
  values, meta) or multiple sheets via a top-level "sheets" array of sheet objects.
  Single-sheet top-level keys:
    rows     List of rows; each row is a list of cell values (formulas or literals).
    cells    Optional A1-keyed map (e.g. A1: "Title", B2: "=A2") for sparse/patch.
    fill     Optional list of expand ops: block (range/value or from/to/value), row,
             col, or cell fill. Extension before replication; boundary clamping per spec.
    values   Optional override of evaluated results (for reproducible VALUES view).
    meta     Optional hints (e.g. seed, cols, defaultColWidth).
  Cell values: string starting with = is a formula; otherwise literal; null or "" = blank.
  Literal string starting with =: prefix with single quote, e.g. "'=not a formula".
  At least one of rows, cells, or fill must define at least one cell.
  Multi-sheet: use top-level key "sheets:" with an array of sheet objects; each
  is rendered in sequence. Full spec: YAML-SPEC-v0.0.2.md and USER-GUIDE.md in the repo's docs folder.

USAGE
  ${bin} render <file> [options]
  ${bin} render -                 Read YAML from stdin instead of a file
  ${bin} -e
  ${bin} --examples                Output all example sheets as one YAML (to stdout)
                                   and usage instructions. Pipe to render or save to file.

ARGUMENTS
  <file>    Path to a .yaml or .yml yrXlsim sheet file. Use - to read from stdin.

OPTIONS
  -e, --examples       Output a single YAML document containing all example sheets
                       (from the Examples/ directory) to stdout, then print instructions
                       for piping to "yrxlsim render -" or saving to a file and rendering.
                       See EXAMPLES below.

  --format <format>     Output format (default: ascii)
                        ascii   Print FORMULAS and/or VALUES view as ASCII grid
                        html    Write standalone HTML with bundled CSS

  --view <view>         Which view(s) to include (default: both)
                        formulas  Only formula text per cell
                        values    Only evaluated values per cell
                        both      Formulas block then Values block (ASCII) or
                                  both sections (HTML)

  --output <path>, -o <path>   Write output to this file instead of stdout.
                               For ASCII, omit for terminal output.

  -h, --help            Show this help and exit.

EXAMPLES
  ${bin} render sheet.yaml
  ${bin} render sheet.yaml --format html -o sheet.html
  ${bin} render sheet.yaml --view values
  cat sheet.yaml | ${bin} render -
  ${bin} render - --format ascii -o grid.txt

  # Render all bundled examples (pipe -e output to render):
  ${bin} -e | ${bin} render -
  # Save examples to a file, then render:
  ${bin} --examples > examples.yaml
  ${bin} render examples.yaml

SEE ALSO
  YAML format: YAML-SPEC-v0.0.2.md and USER-GUIDE.md in the yrXlsim repo's docs folder.
`;
}

function parseArgs(argv) {
  const args = { file: null, format: 'ascii', view: DEFAULT_VIEW, output: null, help: false, examples: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '-e' || a === '--examples') {
      args.examples = true;
    } else if (a === '--format' && argv[i + 1]) {
      args.format = argv[++i];
    } else if (a === '--view' && argv[i + 1]) {
      args.view = argv[++i];
    } else if ((a === '--output' || a === '-o') && argv[i + 1]) {
      args.output = argv[++i];
    } else if (a === 'render' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      args.file = argv[++i];
    } else if (a === 'render' && argv[i + 1] === '-') {
      i++;
      args.file = '-';
    }
  }
  return args;
}

/** Read stdin fully (for pipes). fs.readFileSync(process.stdin.fd) can raise EAGAIN on pipes. */
function readStdin() {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (chunk) { chunks.push(chunk); });
    process.stdin.on('end', function () { resolve(chunks.join('')); });
    process.stdin.on('error', reject);
  });
}

function readYaml(input) {
  const raw = input === '-' ? null : fs.readFileSync(input, 'utf8');
  if (raw !== null) return global.jsyaml.load(raw);
  throw new Error('readYaml(-) requires async readStdin; use readYamlFromStdin()');
}

function readYamlFromStdin(raw) {
  return global.jsyaml.load(raw);
}

function getExamplesDir() {
  const candidates = [
    path.join(__dirname, '..', 'Examples'),
    path.join(path.dirname(process.execPath || __dirname), '..', 'Examples')
  ];
  if (process.pkg) {
    candidates.unshift(path.join(path.dirname(process.execPath), 'Examples'));
  }
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch (_) {}
  }
  return null;
}

function runExamples() {
  const bin = path.basename(process.argv[1]);
  const examplesDir = getExamplesDir();
  if (!examplesDir) {
    process.stderr.write('yrxlsim: Examples directory not found. Run from the yrXlsim repo root or install with Examples.\n');
    process.exit(1);
  }
  let files;
  try {
    files = fs.readdirSync(examplesDir)
      .filter(function (f) { return /\.ya?ml$/i.test(f); })
      .sort();
  } catch (e) {
    process.stderr.write('yrxlsim: Cannot read Examples directory: ' + e.message + '\n');
    process.exit(1);
  }
  if (files.length === 0) {
    process.stderr.write('yrxlsim: No .yaml files in Examples directory.\n');
    process.exit(1);
  }
  const sheets = [];
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(examplesDir, files[i]);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const doc = global.jsyaml.load(raw);
      if (doc && typeof doc === 'object') sheets.push(doc);
    } catch (e) {
      process.stderr.write('yrxlsim: Skip ' + files[i] + ': ' + e.message + '\n');
    }
  }
  const out = { sheets: sheets };
  process.stdout.write(global.jsyaml.dump(out, { lineWidth: -1 }));
  process.stdout.write('\n# --- Instructions ---\n');
  process.stdout.write('# To render the above YAML to ASCII, pipe it to yrxlsim:\n');
  process.stdout.write('#   ' + bin + ' -e | ' + bin + ' render -\n');
  process.stdout.write('# To save to a file and then render:\n');
  process.stdout.write('#   ' + bin + ' --examples > examples.yaml\n');
  process.stdout.write('#   ' + bin + ' render examples.yaml\n');
  process.stdout.write('# (Remove the comment lines above when piping or saving.)\n');
}

function writeOutput(content, outPath) {
  if (outPath) {
    fs.writeFileSync(outPath, content, 'utf8');
  } else {
    process.stdout.write(content);
  }
}

function getCssPath() {
  // When packaged with pkg, assets are next to the executable; __dirname is inside the snapshot
  if (process.pkg) {
    const exeDir = path.dirname(process.execPath);
    const paths = [
      path.join(exeDir, 'quarto-book', 'resources', 'yrxlsim.css'),
      path.join(exeDir, 'yrxlsim.css')
    ];
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (_) {}
    }
    return null;
  }
  return path.join(__dirname, '..', 'quarto-book', 'resources', 'yrxlsim.css');
}

function buildStandaloneHtml(sheets, view) {
  const sheetArray = Array.isArray(sheets) ? sheets : [sheets];
  let formulasHtml = '';
  let valuesHtml = '';
  for (let i = 0; i < sheetArray.length; i++) {
    if (sheetArray.length > 1) {
      formulasHtml += '<div class="yrxlsim-sheet-label">Sheet ' + (i + 1) + '</div>';
      valuesHtml += '<div class="yrxlsim-sheet-label">Sheet ' + (i + 1) + '</div>';
    }
    formulasHtml += yrxlsim.renderToHtml(sheetArray[i], 'formulas');
    valuesHtml += yrxlsim.renderToHtml(sheetArray[i], 'values');
  }
  const cssPath = getCssPath();
  let css = '';
  if (cssPath) {
    try {
      css = fs.readFileSync(cssPath, 'utf8');
    } catch (e) {}
  }
  if (!css) {
    css = '/* yrxlsim styles */ .yrxlsim-sheet{overflow-x:auto;border:1px solid #d4d4d4;}.yrxlsim-table{border-collapse:collapse;font-size:13px;}';
  }
  const showFormulas = view === 'formulas' || view === 'both';
  const showValues = view === 'values' || view === 'both';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="generator" content="yrxlsim">
  <title>yrXlsim sheet</title>
  <style>
${css}
.yrxlsim-standalone-section { margin: 1.5em 0; }
.yrxlsim-standalone-section h2 { font-size: 1em; color: #555; margin-bottom: 0.25em; }
.yrxlsim-sheet-label { font-size: 0.85em; font-weight: 600; color: #666; margin-top: 1em; margin-bottom: 0.25em; }
  </style>
</head>
<body>
${showFormulas ? `<div class="yrxlsim-standalone-section"><h2>Formulas</h2>${formulasHtml}</div>` : ''}
${showValues ? `<div class="yrxlsim-standalone-section"><h2>Values</h2>${valuesHtml}</div>` : ''}
</body>
</html>
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length > 0 && (argv[0] === '-e' || argv[0] === '--examples')) {
    runExamples();
    process.exit(0);
  }
  if (argv.length > 0 && (argv[0] === '-h' || argv[0] === '--help')) {
    process.stdout.write(usage());
    process.exit(0);
  }
  if (argv.length === 0 || argv[0] !== 'render') {
    process.stderr.write(usage());
    process.exit(1);
  }

  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }
  if (!args.file) {
    process.stderr.write('Error: render requires <file> or -\n' + usage());
    process.exit(1);
  }
  if (!VIEWS.includes(args.view)) {
    process.stderr.write('Error: --view must be one of: ' + VIEWS.join(', ') + '\n');
    process.exit(1);
  }
  if (!FORMATS.includes(args.format)) {
    process.stderr.write('Error: --format must be one of: ' + FORMATS.join(', ') + '\n');
    process.exit(1);
  }

  function doRender(doc) {
    if (!doc || typeof doc !== 'object') {
      process.stderr.write('Error: YAML did not produce an object.\n');
      process.exit(1);
    }
    const sheets = yrxlsim.getSheets(doc);
    let out;
    if (args.format === 'ascii') {
      const parts = [];
      for (let i = 0; i < sheets.length; i++) {
        if (sheets.length > 1 && i > 0) parts.push('\n--- Sheet ' + (i + 1) + ' ---\n\n');
        parts.push(yrxlsim.renderToAscii(sheets[i], args.view));
      }
      out = parts.join('\n\n');
    } else {
      out = buildStandaloneHtml(sheets, args.view);
    }
    writeOutput(out, args.output);
  }

  if (args.file === '-') {
    readStdin()
      .then(function (raw) {
        let doc;
        try {
          doc = readYamlFromStdin(raw);
        } catch (e) {
          process.stderr.write('Error parsing YAML: ' + e.message + '\n');
          process.exit(1);
        }
        doRender(doc);
      })
      .catch(function (e) {
        process.stderr.write('Error reading stdin: ' + e.message + '\n');
        process.exit(1);
      });
    return;
  }

  let doc;
  try {
    doc = readYaml(args.file);
  } catch (e) {
    process.stderr.write('Error parsing YAML: ' + e.message + '\n');
    process.exit(1);
  }
  doRender(doc);
}

main();
