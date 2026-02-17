/**
 * Automated tests for the yrxlsim core (quarto-book/resources/yrxlsim.js).
 * Run with: node --test test/core.test.js
 * Requires Node 18+ (node:test). Dependencies: js-yaml, hyperformula (same as main app).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
global.jsyaml = require('js-yaml');
const { HyperFormula } = require('hyperformula');
global.HyperFormula = HyperFormula;

const yrxlsim = require(path.join(projectRoot, 'quarto-book/resources/yrxlsim.js'));

describe('getSheets', () => {
  it('returns single sheet as one-element array when root has no sheets key', () => {
    const doc = { rows: [['A', 'B']] };
    const sheets = yrxlsim.getSheets(doc);
    assert.strictEqual(Array.isArray(sheets), true);
    assert.strictEqual(sheets.length, 1);
    assert.strictEqual(sheets[0], doc);
  });

  it('returns sheets array when root has non-empty sheets key', () => {
    const doc = {
      sheets: [
        { rows: [['Sheet1']] },
        { rows: [['Sheet2']] }
      ]
    };
    const sheets = yrxlsim.getSheets(doc);
    assert.strictEqual(sheets.length, 2);
    assert.strictEqual(sheets[0].rows[0][0], 'Sheet1');
    assert.strictEqual(sheets[1].rows[0][0], 'Sheet2');
  });

  it('returns empty array for null or non-object', () => {
    assert.deepStrictEqual(yrxlsim.getSheets(null), []);
    assert.deepStrictEqual(yrxlsim.getSheets(undefined), []);
    assert.deepStrictEqual(yrxlsim.getSheets(42), []);
  });
});

describe('buildEffectiveGrid', () => {
  it('builds grid from rows only', () => {
    const doc = { rows: [['Label', 'Data'], ['X', '=A2']] };
    const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(maxRow, 2);
    assert.strictEqual(maxCol, 2);
    assert.strictEqual(grid[0][0], 'Label');
    assert.strictEqual(grid[0][1], 'Data');
    assert.strictEqual(grid[1][0], 'X');
    assert.strictEqual(grid[1][1], '=A2');
  });

  it('overlays cells and applies cells again after fill (cells win)', () => {
    const doc = {
      rows: [['A', 'B'], ['1', '2']],
      cells: { B2: 'overridden', D1: 'extra' }
    };
    const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(grid[1][1], 'overridden');
    assert.strictEqual(grid[0][3], 'extra');
    assert.strictEqual(maxRow, 2);
    assert.strictEqual(maxCol, 4);
  });

  it('cells-only document (rows: [])', () => {
    const doc = {
      rows: [],
      cells: { A1: 'Title', B2: '=A1' }
    };
    const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(grid[0][0], 'Title');
    assert.strictEqual(grid[1][1], '=A1');
    assert.strictEqual(maxRow, 2);
    assert.strictEqual(maxCol, 2);
  });

  it('block fill expands range with same value', () => {
    const doc = {
      rows: [],
      fill: [{ range: 'A1:B2', value: '=1+1' }]
    };
    const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(maxRow, 2);
    assert.strictEqual(maxCol, 2);
    assert.strictEqual(grid[0][0], '=1+1');
    assert.strictEqual(grid[0][1], '=1+1');
    assert.strictEqual(grid[1][0], '=1+1');
    assert.strictEqual(grid[1][1], '=1+1');
  });

  it('row fill down adjusts relative refs', () => {
    const doc = {
      rows: [['ColA', 'ColB'], ['=A1+1', '=B1*2']],
      fill: [{ row: 2, down: 2 }]
    };
    const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(maxRow, 4);
    assert.strictEqual(grid[2][0], '=A2+1');
    assert.strictEqual(grid[2][1], '=B2*2');
    assert.strictEqual(grid[3][0], '=A3+1');
    assert.strictEqual(grid[3][1], '=B3*2');
  });
});

describe('literal equals (§2.2.1)', () => {
  it('cell starting with \'= is stored and displayed without leading quote', () => {
    const doc = { rows: [["'=not a formula"]] };
    const { grid } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(grid[0][0], "'=not a formula");
    const ascii = yrxlsim.renderToAscii(doc, 'formulas');
    assert.ok(ascii.includes('=not a formula'));
    assert.ok(!ascii.includes("'=not a formula"));
  });
});

describe('buildValuesGrid', () => {
  it('applies values override (A1-keyed)', () => {
    const doc = {
      rows: [['=RANDBETWEEN(1,6)']],
      values: { A1: 4 }
    };
    const { grid } = yrxlsim.buildValuesGrid(doc);
    assert.strictEqual(grid[0][0], 4);
  });

  it('supports array form of values (experimental)', () => {
    const doc = {
      rows: [['A', 'B'], ['=1+1', '=A2*2']],
      values: [[null, null], [2, 4]]
    };
    const { grid } = yrxlsim.buildValuesGrid(doc);
    assert.strictEqual(grid[1][0], 2);
    assert.strictEqual(grid[1][1], 4);
  });
});

describe('renderToAscii', () => {
  it('includes FORMULAS and VALUES when view is both', () => {
    const doc = { rows: [['X', 'Y']] };
    const out = yrxlsim.renderToAscii(doc, 'both');
    assert.ok(out.includes('FORMULAS VIEW'));
    assert.ok(out.includes('VALUES VIEW'));
    assert.ok(out.includes('X'));
    assert.ok(out.includes('Y'));
  });

  it('formulas-only view has no VALUES VIEW heading', () => {
    const doc = { rows: [['A']] };
    const out = yrxlsim.renderToAscii(doc, 'formulas');
    assert.ok(!out.includes('VALUES VIEW'));
    assert.ok(out.includes('A'));
  });
});

describe('error conditions (§11)', () => {
  it('throws when no rows, cells, or fill supply any cell', () => {
    const doc = { rows: [] };
    assert.throws(
      () => yrxlsim.buildEffectiveGrid(doc),
      /at least one of rows, cells, or fill/
    );
  });

  it('throws when fill references non-existent template row', () => {
    const doc = { rows: [['A']], fill: [{ row: 5, down: 1 }] };
    assert.throws(
      () => yrxlsim.buildEffectiveGrid(doc),
      /template row 5 which does not exist/
    );
  });

  it('throws when fill references template column with no cells', () => {
    const doc = { rows: [['A']], fill: [{ col: 'Z', right: 1 }] };
    assert.throws(
      () => yrxlsim.buildEffectiveGrid(doc),
      /template column .* which has no cells/
    );
  });
});

describe('multi-sheet (v0.0.2 §1.4)', () => {
  it('getSheets returns each sheet; each builds effective grid independently', () => {
    const doc = {
      sheets: [
        { rows: [['Label', 'Data'], ['X', '=A2']] },
        { rows: [['=A1+B1', 'Sum']] }
      ]
    };
    const sheets = yrxlsim.getSheets(doc);
    assert.strictEqual(sheets.length, 2);
    const g1 = yrxlsim.buildEffectiveGrid(sheets[0]);
    const g2 = yrxlsim.buildEffectiveGrid(sheets[1]);
    assert.strictEqual(g1.grid[0][0], 'Label');
    assert.strictEqual(g1.grid[1][1], '=A2');
    assert.strictEqual(g2.grid[0][0], '=A1+B1');
    assert.strictEqual(g2.grid[0][1], 'Sum');
  });
});

describe('fill up with boundary clamping (v0.0.2 §13.9)', () => {
  it('cell fill up produces A2–A5; row 1 (A1) not filled by fill', () => {
    const doc = {
      cells: { A5: '=A4*2' },
      fill: [{ from: 'A5', up: 3 }]
    };
    const { grid, maxRow } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(grid[4][0], '=A4*2');
    assert.strictEqual(grid[3][0], '=A3*2');
    assert.strictEqual(grid[2][0], '=A2*2');
    assert.strictEqual(grid[1][0], '=A1*2');
    assert.ok(maxRow >= 5);
    const a1 = grid[0] && grid[0][0];
    assert.ok(a1 === '' || a1 === undefined, 'A1 not filled by fill (boundary clamping)');
  });
});

describe('column fill left (v0.0.2 §13.10)', () => {
  it('replicates template column C left to B and A with column ref adjustment', () => {
    const doc = {
      rows: [[null, null, '=C1+1'], [null, null, '=C2+1']],
      cells: { C1: '100' },
      fill: [{ col: 'C', left: 2 }]
    };
    const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(maxCol, 3);
    assert.strictEqual(grid[0][0], '100');
    assert.strictEqual(grid[0][1], '100');
    assert.strictEqual(grid[0][2], '100');
    assert.strictEqual(grid[1][0], '=A2+1');
    assert.strictEqual(grid[1][1], '=B2+1');
    assert.strictEqual(grid[1][2], '=C2+1');
  });
});

describe('cells override fill (pipeline step 4)', () => {
  it('explicit cells entry wins over content produced by fill', () => {
    const doc = {
      rows: [['Hdr', 'Val'], ['a', '=A2+1']],
      fill: [{ row: 2, down: 2 }],
      cells: { B3: 'overridden' }
    };
    const { grid } = yrxlsim.buildEffectiveGrid(doc);
    assert.strictEqual(grid[2][1], 'overridden');
    assert.strictEqual(grid[1][1], '=A2+1');
    assert.strictEqual(grid[3][1], '=A4+1');
  });
});

describe('parseA1 / colIndexToLetters / colLettersToIndex', () => {
  it('parseA1 parses valid A1 addresses', () => {
    assert.deepStrictEqual(yrxlsim.parseA1('A1'), { row: 1, col: 0 });
    assert.deepStrictEqual(yrxlsim.parseA1('B2'), { row: 2, col: 1 });
    assert.deepStrictEqual(yrxlsim.parseA1('AA10'), { row: 10, col: 26 });
    assert.strictEqual(yrxlsim.parseA1('invalid'), null);
    assert.strictEqual(yrxlsim.parseA1('A1:B2'), null);
  });

  it('colIndexToLetters and colLettersToIndex round-trip', () => {
    for (let c = 0; c <= 30; c++) {
      const letters = yrxlsim.colIndexToLetters(c);
      assert.strictEqual(yrxlsim.colLettersToIndex(letters), c);
    }
  });
});

describe('Examples directory', () => {
  const examplesDir = path.join(projectRoot, 'Examples');
  if (!fs.existsSync(examplesDir)) return;

  const yamlFiles = fs.readdirSync(examplesDir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .sort();

  for (const file of yamlFiles) {
    it(`Example ${file} parses and builds effective grid without throwing`, () => {
      const filePath = path.join(examplesDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const doc = global.jsyaml.load(raw);
      assert.ok(doc && typeof doc === 'object', 'YAML must parse to object');
      const sheets = yrxlsim.getSheets(doc);
      assert.ok(sheets.length >= 1, 'must have at least one sheet');
      for (const sheet of sheets) {
        const { grid, maxRow, maxCol } = yrxlsim.buildEffectiveGrid(sheet);
        assert.ok(Array.isArray(grid));
        assert.ok(maxRow >= 0 && maxCol >= 0);
      }
    });
  }
});
