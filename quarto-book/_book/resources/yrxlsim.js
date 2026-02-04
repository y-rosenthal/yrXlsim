/**
 * yrXlsim — render YAML sheet spec as Excel-like HTML table (FORMULAS view).
 * Depends on: js-yaml (loaded separately). Run yrxlsim.renderAll() after DOM ready.
 */
(function (global) {
  'use strict';

  function colLettersToIndex(letters) {
    const s = letters.toUpperCase().replace(/\$/g, '');
    let n = 0;
    for (let i = 0; i < s.length; i++)
      n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1; // 0-based (A=0)
  }

  function colIndexToLetters(c) {
    let n = c + 1;
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function parseA1(a1) {
    const m = String(a1).toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    return { row: parseInt(m[2], 10), col: colLettersToIndex(m[1]) };
  }

  function parseRange(rangeStr) {
    const parts = String(rangeStr).toUpperCase().split(':');
    if (parts.length !== 2) return null;
    const top = parseA1(parts[0].trim());
    const bottom = parseA1(parts[1].trim());
    if (!top || !bottom) return null;
    return {
      r1: Math.min(top.row, bottom.row),
      r2: Math.max(top.row, bottom.row),
      c1: Math.min(top.col, bottom.col),
      c2: Math.max(top.col, bottom.col)
    };
  }

  function adjustRefInFormula(formula, dr, dc) {
    if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) return formula;
    return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, function (_, absCol, colLetters, absRow, rowNum) {
      let c = colLettersToIndex(colLetters);
      let r = parseInt(rowNum, 10);
      if (!absCol) c += dc;
      if (!absRow) r += dr;
      r = Math.max(1, r);
      c = Math.max(0, c);
      return (absCol || '') + colIndexToLetters(c) + (absRow || '') + r;
    });
  }

  function getCell(grid, row, col) {
    const r = grid[row - 1];
    if (!r) return undefined;
    const v = r[col];
    return v === undefined || v === null || v === '' ? '' : String(v).trim();
  }

  function setCell(grid, row, col, value) {
    while (grid.length < row) grid.push([]);
    const r = grid[row - 1];
    while (r.length <= col) r.push('');
    r[col] = value == null || value === '' ? '' : value;
  }

  function cloneRow(row) {
    return row ? row.map(function (c) { return c; }) : [];
  }

  function expandFill(doc) {
    const rows = (doc.rows || []).map(function (r) { return (r || []).map(function (c) { return c == null || c === '' ? '' : String(c); }); });
    const cells = doc.cells || {};
    const fillOps = doc.fill || [];

    // Apply cells over rows for initial grid (resolution)
    const grid = rows.map(cloneRow);
    Object.keys(cells).forEach(function (key) {
      const p = parseA1(key);
      if (!p || key.includes(':')) return;
      setCell(grid, p.row, p.col, cells[key] == null ? '' : String(cells[key]));
    });

    fillOps.forEach(function (op) {
      // Block fill
      if (op.value !== undefined && (op.range || (op.from && op.to))) {
        const range = op.range ? parseRange(op.range) : (parseA1(op.from) && parseA1(op.to) ? {
          r1: Math.min(parseA1(op.from).row, parseA1(op.to).row),
          r2: Math.max(parseA1(op.from).row, parseA1(op.to).row),
          c1: Math.min(parseA1(op.from).col, parseA1(op.to).col),
          c2: Math.max(parseA1(op.from).col, parseA1(op.to).col)
        } : null);
        if (range)
          for (let r = range.r1; r <= range.r2; r++)
            for (let c = range.c1; c <= range.c2; c++)
              setCell(grid, r, c, op.value);
        return;
      }

      // Row fill
      if (op.row !== undefined) {
        const templateRow = op.row;
        const rowData = getRow(grid, templateRow);
        const maxColIdx = Math.max(0, rowData.length - 1);
        const down = op.down !== undefined ? op.down : (op.toRow !== undefined ? Math.max(0, op.toRow - templateRow) : 0);
        const up = op.up || 0;
        const right = op.right !== undefined ? op.right : (op.toCol !== undefined ? Math.max(0, colLettersToIndex(op.toCol) - maxColIdx) : 0);
        for (let r = templateRow - up; r <= templateRow + down; r++) {
          if (r === templateRow) continue;
          const dr = r - templateRow;
          for (let c = 0; c <= maxColIdx + right; c++) {
            const val = rowData[c] !== undefined && rowData[c] !== '' ? rowData[c] : getCell(grid, templateRow, c);
            setCell(grid, r, c, (val && val.startsWith('=')) ? adjustRefInFormula(val, dr, 0) : (val || ''));
          }
        }
        return;
      }

      // Column fill: copy template column to the right and optionally extend down
      if (op.col !== undefined) {
        const colLetter = String(op.col).toUpperCase().replace(/\$/g, '');
        const templateCol = colLettersToIndex(colLetter);
        const right = op.right !== undefined ? op.right : (op.toCol !== undefined ? Math.max(0, colLettersToIndex(op.toCol) - templateCol) : 0);
        const down = op.down !== undefined ? op.down : (op.toRow !== undefined ? Math.max(0, op.toRow - grid.length) : 0);
        const maxRow = Math.max(grid.length, grid.length + down);
        for (let c = templateCol; c <= templateCol + right; c++) {
          const dc = c - templateCol;
          for (let r = 1; r <= maxRow; r++) {
            const val = getCell(grid, r, templateCol);
            setCell(grid, r, c, (val && val.startsWith('=')) ? adjustRefInFormula(val, 0, dc) : (val || ''));
          }
        }
        return;
      }

      // Cell fill: from + down/up/right/left or to
      if (op.from !== undefined) {
        const from = parseA1(op.from);
        if (!from) return;
        let r1 = from.row, r2 = from.row, c1 = from.col, c2 = from.col;
        if (op.to !== undefined) {
          const to = parseA1(op.to);
          if (to) {
            r1 = Math.min(from.row, to.row);
            r2 = Math.max(from.row, to.row);
            c1 = Math.min(from.col, to.col);
            c2 = Math.max(from.col, to.col);
          }
        } else {
          if (op.down !== undefined) r2 = from.row + op.down;
          if (op.up !== undefined) r1 = from.row - op.up;
          if (op.right !== undefined) c2 = from.col + op.right;
          if (op.left !== undefined) c1 = from.col - op.left;
        }
        const templateVal = getCell(grid, from.row, from.col);
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const dr = r - from.row, dc = c - from.col;
            const val = (templateVal && templateVal.startsWith('=')) ? adjustRefInFormula(templateVal, dr, dc) : templateVal;
            setCell(grid, r, c, val);
          }
        }
      }
    });

    return grid;
  }

  function getRow(grid, row1) {
    const r = grid[row1 - 1];
    if (!r) return [];
    return r.map(function (c) { return c === undefined || c === null ? '' : c; });
  }

  function usedRange(grid, cells) {
    let maxRow = grid.length;
    let maxCol = 0;
    grid.forEach(function (row) { maxCol = Math.max(maxCol, row.length); });
    if (cells) {
      Object.keys(cells).forEach(function (key) {
        if (key.indexOf(':') >= 0) return;
        const p = parseA1(key);
        if (p) {
          maxRow = Math.max(maxRow, p.row);
          maxCol = Math.max(maxCol, p.col + 1);
        }
      });
    }
    return { maxRow: maxRow, maxCol: maxCol };
  }

  function resolveGrid(doc, expandedGrid) {
    const grid = expandedGrid.map(cloneRow);
    const cells = doc.cells || {};
    Object.keys(cells).forEach(function (key) {
      const p = parseA1(key);
      if (!p || key.includes(':')) return;
      setCell(grid, p.row, p.col, cells[key] == null ? '' : String(cells[key]));
    });
    return grid;
  }

  function buildEffectiveGrid(doc) {
    const expanded = expandFill(doc);
    const grid = resolveGrid(doc, expanded);
    const ur = usedRange(grid, doc.cells);
    return { grid: grid, maxRow: ur.maxRow, maxCol: ur.maxCol };
  }

  function renderToHtml(doc) {
    const effective = buildEffectiveGrid(doc);
    const grid = effective.grid;
    const maxRow = effective.maxRow;
    const maxCol = Math.max(effective.maxCol, 1);
    const colHeaders = [];
    for (let c = 0; c < maxCol; c++) colHeaders.push(colIndexToLetters(c));
    let html = '<div class="yrxlsim-sheet"><table class="yrxlsim-table"><thead><tr><th class="yrxlsim-corner"></th>';
    colHeaders.forEach(function (h) {
      html += '<th class="yrxlsim-col-header">' + escapeHtml(h) + '</th>';
    });
    html += '</tr></thead><tbody>';
    for (let r = 1; r <= maxRow; r++) {
      html += '<tr><th class="yrxlsim-row-header">' + r + '</th>';
      const row = grid[r - 1] || [];
      for (let c = 0; c < maxCol; c++) {
        const val = row[c] === undefined || row[c] === null ? '' : row[c];
        const isFormula = typeof val === 'string' && val.startsWith('=');
        const cls = isFormula ? ' yrxlsim-formula' : '';
        html += '<td class="yrxlsim-cell' + cls + '">' + escapeHtml(displayValue(val)) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function displayValue(v) {
    if (v === undefined || v === null || v === '') return '\u00A0';
    return String(v);
  }

  function escapeHtml(s) {
    const el = document.createElement('div');
    el.textContent = s;
    return el.innerHTML;
  }

  function renderAll() {
    if (typeof global.jsyaml === 'undefined') {
      console.warn('yrxlsim: js-yaml not loaded. Include <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script> and ensure it exposes jsyaml.');
      return;
    }
    document.querySelectorAll('code.yrxlsim, pre.yrxlsim code').forEach(function (block) {
      const pre = block.closest('pre');
      const yamlText = block.textContent || block.innerText || '';
      let doc;
      try {
        doc = global.jsyaml.load(yamlText);
      } catch (e) {
        if (pre) pre.outerHTML = '<div class="yrxlsim-error">Invalid YAML: ' + escapeHtml(e.message) + '</div>';
        return;
      }
      if (!doc || typeof doc !== 'object') {
        if (pre) pre.outerHTML = '<div class="yrxlsim-error">YAML did not produce an object.</div>';
        return;
      }
      const tableHtml = renderToHtml(doc);
      if (pre) {
        const wrap = document.createElement('div');
        wrap.className = 'yrxlsim-wrapper';
        wrap.innerHTML = tableHtml;
        pre.parentNode.replaceChild(wrap, pre);
      } else {
        block.outerHTML = tableHtml;
      }
    });
  }

  global.yrxlsim = {
    colLettersToIndex: colLettersToIndex,
    colIndexToLetters: colIndexToLetters,
    parseA1: parseA1,
    parseRange: parseRange,
    buildEffectiveGrid: buildEffectiveGrid,
    renderToHtml: renderToHtml,
    renderAll: renderAll
  };

  function run() {
    if (typeof global.jsyaml !== 'undefined') {
      renderAll();
    } else if (typeof global.YAML !== 'undefined') {
      global.jsyaml = global.YAML;
      renderAll();
    } else {
      console.warn('yrxlsim: YAML parser not found. Include js-yaml (e.g. <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>).');
    }
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', run);
    else
      run();
  }
})(typeof window !== 'undefined' ? window : this);
