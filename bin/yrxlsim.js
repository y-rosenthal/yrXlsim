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

USAGE
  ${bin} render <file> [options]
  ${bin} render -                 Read YAML from stdin instead of a file

ARGUMENTS
  <file>    Path to a .yaml or .yml yrXlsim sheet file. Use - to read from stdin.

OPTIONS
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

SEE ALSO
  YAML format: YAML-SPEC.md and USER-GUIDE.md in the yrXlsim repo.
`;
}

function parseArgs(argv) {
  const args = { file: null, format: 'ascii', view: DEFAULT_VIEW, output: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
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

function readYaml(input) {
  const raw = input === '-' ? fs.readFileSync(process.stdin.fd, 'utf8') : fs.readFileSync(input, 'utf8');
  return global.jsyaml.load(raw);
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

function buildStandaloneHtml(doc, view) {
  const formulasHtml = yrxlsim.renderToHtml(doc, 'formulas');
  const valuesHtml = yrxlsim.renderToHtml(doc, 'values');
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
  if (argv.length === 0 || (argv[0] !== 'render')) {
    if (argv.length > 0 && (argv[0] === '-h' || argv[0] === '--help')) {
      process.stdout.write(usage());
      process.exit(0);
    }
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

  let doc;
  try {
    doc = readYaml(args.file);
  } catch (e) {
    process.stderr.write('Error parsing YAML: ' + e.message + '\n');
    process.exit(1);
  }
  if (!doc || typeof doc !== 'object') {
    process.stderr.write('Error: YAML did not produce an object.\n');
    process.exit(1);
  }

  let out;
  if (args.format === 'ascii') {
    out = yrxlsim.renderToAscii(doc, args.view);
  } else {
    out = buildStandaloneHtml(doc, args.view);
  }
  writeOutput(out, args.output);
}

main();
