/**
 * yrXlsim — shared core: parse YAML sheet spec, expand fill, resolve grid,
 * render as HTML (browser) or ASCII (CLI). Used by Quarto (browser) and by
 * the yrxlsim CLI (Node). Depends on: js-yaml; for Values view: HyperFormula.
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

  /** §2.2.1: literal string starting with = is stored as '=...'; strip leading ' for display. */
  function cellDisplayValue(v) {
    const s = v === undefined || v === null || v === '' ? '' : String(v).trim();
    if (s.length >= 2 && s[0] === "'" && s[1] === '=') return s.slice(1);
    return s;
  }

  /** True if cell content is a formula (starts with = but not literal '=). */
  function isFormula(val) {
    if (!val || typeof val !== 'string') return false;
    const s = val.trim();
    return s.startsWith('=') && !(s.length >= 2 && s[0] === "'" && s[1] === '=');
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

  function getRow(grid, row1) {
    const r = grid[row1 - 1];
    if (!r) return [];
    return r.map(function (c) { return c === undefined || c === null ? '' : c; });
  }

  function expandFill(doc) {
    const rows = (doc.rows || []).map(function (r) { return (r || []).map(function (c) { return c == null || c === '' ? '' : String(c); }); });
    const cells = doc.cells || {};
    const fillOps = doc.fill || [];

    function hasContent() {
      if (rows.length > 0 && rows.some(function (row) { return row.some(function (c) { return c !== ''; }); })) return true;
      const cellKeys = Object.keys(cells).filter(function (k) { return !k.includes(':') && parseA1(k); });
      if (cellKeys.length > 0) return true;
      return fillOps.length > 0;
    }
    if (!hasContent()) {
      const err = new Error('yrxlsim: invalid sheet — at least one of rows, cells, or fill must supply at least one cell (§1.1).');
      if (typeof global.console !== 'undefined' && global.console.error) global.console.error(err.message);
      throw err;
    }

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

      // Row fill (§4.3.2): extension (right/left) then replication (down/up); §4.5 clamp
      if (op.row !== undefined) {
        const templateRow = op.row;
        const rowData = getRow(grid, templateRow);
        if (grid.length < templateRow) {
          const err = new Error('yrxlsim: fill references template row ' + templateRow + ' which does not exist (§11).');
          if (typeof global.console !== 'undefined' && global.console.error) global.console.error(err.message);
          throw err;
        }
        const maxColIdx = Math.max(0, rowData.length - 1);
        const down = op.down !== undefined ? op.down : (op.toRow !== undefined ? Math.max(0, op.toRow - templateRow) : 0);
        const up = op.up || 0;
        const right = op.right !== undefined ? op.right : (op.toCol !== undefined ? Math.max(0, colLettersToIndex(String(op.toCol).toUpperCase()) - maxColIdx) : 0);
        const left = op.left || 0;
        const minCol = Math.max(0, -left);
        const maxCol = maxColIdx + right;
        for (let r = templateRow - up; r <= templateRow + down; r++) {
          if (r === templateRow) continue;
          if (r < 1) continue;
          const dr = r - templateRow;
          for (let c = minCol; c <= maxCol; c++) {
            let val; let dc = 0;
            if (c < 0) continue;
            if (c <= maxColIdx) {
              val = rowData[c] !== undefined && rowData[c] !== '' ? rowData[c] : getCell(grid, templateRow, c);
            } else {
              val = (rowData[maxColIdx] !== undefined && rowData[maxColIdx] !== '') ? rowData[maxColIdx] : getCell(grid, templateRow, maxColIdx);
              dc = c - maxColIdx;
            }
            setCell(grid, r, c, isFormula(val) ? adjustRefInFormula(val, dr, dc) : (val || ''));
          }
        }
        return;
      }

      // Column fill (§4.3.3): extension (down/up) then replication (right/left); §4.5 clamp
      if (op.col !== undefined) {
        const colLetter = String(op.col).toUpperCase().replace(/\$/g, '');
        const templateCol = colLettersToIndex(colLetter);
        let maxTemplateRow = 0;
        for (let r = grid.length; r >= 1; r--) {
          if (getCell(grid, r, templateCol) !== '' || (grid[r - 1] && grid[r - 1][templateCol] !== undefined)) {
            maxTemplateRow = r;
            break;
          }
        }
        if (maxTemplateRow === 0) {
          const err = new Error('yrxlsim: fill references template column ' + colLetter + ' which has no cells in the grid (§11).');
          if (typeof global.console !== 'undefined' && global.console.error) global.console.error(err.message);
          throw err;
        }
        const right = op.right !== undefined ? op.right : (op.toCol !== undefined ? Math.max(0, colLettersToIndex(String(op.toCol).toUpperCase()) - templateCol) : 0);
        const left = op.left || 0;
        const down = op.down !== undefined ? op.down : (op.toRow !== undefined ? Math.max(0, op.toRow - maxTemplateRow) : 0);
        const up = op.up || 0;
        const minCol = Math.max(0, templateCol - left);
        const maxCol = templateCol + right;
        const minRow = Math.max(1, 1 - up);
        const maxRow = maxTemplateRow + down;
        for (let c = minCol; c <= maxCol; c++) {
          if (c < 0) continue;
          const dc = c - templateCol;
          for (let r = minRow; r <= maxRow; r++) {
            let val; let dr = 0;
            if (r <= maxTemplateRow) {
              val = getCell(grid, r, templateCol);
            } else {
              val = getCell(grid, maxTemplateRow, templateCol);
              dr = r - maxTemplateRow;
            }
            setCell(grid, r, c, isFormula(val) ? adjustRefInFormula(val, dr, dc) : (val || ''));
          }
        }
        return;
      }

      // Cell fill (§4.3.4): from + down/up/right/left or to; §4.5 clamp
      if (op.from !== undefined && op.value === undefined) {
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
        r1 = Math.max(1, r1);
        c1 = Math.max(0, c1);
        const templateVal = getCell(grid, from.row, from.col);
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const dr = r - from.row, dc = c - from.col;
            const val = isFormula(templateVal) ? adjustRefInFormula(templateVal, dr, dc) : (templateVal || '');
            setCell(grid, r, c, val);
          }
        }
      }
    });

    return grid;
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

  /**
   * Return an array of sheet documents. If root has a "sheets" array, return it;
   * otherwise treat the root as a single sheet and return [root].
   */
  function getSheets(doc) {
    if (!doc || typeof doc !== 'object') return [];
    if (Array.isArray(doc.sheets) && doc.sheets.length > 0) return doc.sheets;
    return [doc];
  }

  function buildValuesGrid(doc) {
    const effective = buildEffectiveGrid(doc);
    const grid = effective.grid;
    const maxRow = effective.maxRow;
    const maxCol = Math.max(effective.maxCol, 1);
    const valuesOverride = doc.values;
    let valuesGrid;

    var HyperFormula = global.HyperFormula || global.hyperformula;
    if (typeof HyperFormula !== 'undefined') {
      try {
        const seed = (doc.meta && doc.meta.seed != null) ? Number(doc.meta.seed) : undefined;
        const config = { licenseKey: 'gpl-v3' };
        if (seed != null && !isNaN(seed)) {
          config.randomSeed = seed;
        }
        const sheetData = [];
        for (let r = 0; r < maxRow; r++) {
          const row = [];
          for (let c = 0; c < maxCol; c++) {
            let cell = (grid[r] && grid[r][c]) !== undefined && grid[r][c] !== null && grid[r][c] !== '' ? grid[r][c] : '';
            cell = typeof cell === 'string' ? cell : String(cell);
            if (cell.length >= 2 && cell[0] === "'" && cell[1] === '=') {
              cell = '="' + cell.slice(1).replace(/"/g, '""') + '"';
            }
            row.push(cell);
          }
          sheetData.push(row);
        }
        const hf = HyperFormula.buildFromArray(sheetData, config);
        const hfValues = hf.getSheetValues(0);
        hf.destroy();
        valuesGrid = [];
        for (let r = 0; r < maxRow; r++) {
          const row = [];
          for (let c = 0; c < maxCol; c++) {
            let v = (hfValues[r] && hfValues[r][c]) !== undefined ? hfValues[r][c] : '';
            if (v != null && typeof v === 'object' && typeof v.value !== 'undefined') {
              v = v.value;
            }
            row.push(v);
          }
          valuesGrid.push(row);
        }
      } catch (e) {
        valuesGrid = grid.map(function (row) {
          return (row || []).map(function (cell) {
            if (cell == null || cell === '') return '';
            if (cell.length >= 2 && cell[0] === "'" && cell[1] === '=') return cell.slice(1);
            return (isFormula(cell)) ? '(error)' : cell;
          });
        });
      }
    } else {
      if (typeof global.console !== 'undefined' && global.console.warn) {
        global.console.warn('yrxlsim: HyperFormula not loaded. Values view will show … for formula cells. Include hyperformula.full.min.js before yrxlsim.js.');
      }
      valuesGrid = grid.map(function (row) {
        return (row || []).map(function (cell) {
          if (cell == null || cell === '') return '';
          if (cell.length >= 2 && cell[0] === "'" && cell[1] === '=') return cell.slice(1);
          if (isFormula(cell)) return '\u2026';
          return cell;
        });
      });
    }

    if (valuesOverride !== undefined && valuesOverride !== null) {
      for (let r = 1; r <= maxRow; r++) {
        for (let c = 0; c < maxCol; c++) {
          const a1 = colIndexToLetters(c) + r;
          let v;
          if (typeof valuesOverride === 'object' && !Array.isArray(valuesOverride) && valuesOverride[a1] !== undefined) {
            v = valuesOverride[a1];
          } else if (Array.isArray(valuesOverride) && valuesOverride[r - 1] && valuesOverride[r - 1][c] !== undefined) {
            v = valuesOverride[r - 1][c];
          } else {
            continue;
          }
          valuesGrid[r - 1][c] = v;
        }
      }
    }

    return { grid: valuesGrid, maxRow: maxRow, maxCol: maxCol };
  }

  function displayValue(v) {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'object' && v !== null && typeof v.value !== 'undefined') return String(v.value);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return String(v);
  }

  function escapeHtml(s) {
    const str = String(s);
    if (typeof global.document !== 'undefined' && global.document.createElement) {
      const el = global.document.createElement('div');
      el.textContent = str;
      return el.innerHTML;
    }
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTableHtml(data, maxRow, maxCol, view) {
    const colHeaders = [];
    for (let c = 0; c < maxCol; c++) colHeaders.push(colIndexToLetters(c));
    let html = '<div class="yrxlsim-sheet"><table class="yrxlsim-table"><thead><tr><th class="yrxlsim-corner"></th>';
    colHeaders.forEach(function (h) {
      html += '<th class="yrxlsim-col-header">' + escapeHtml(h) + '</th>';
    });
    html += '</tr></thead><tbody>';
    for (let r = 1; r <= maxRow; r++) {
      html += '<tr><th class="yrxlsim-row-header">' + r + '</th>';
      const row = data[r - 1] || [];
      for (let c = 0; c < maxCol; c++) {
        const val = row[c];
        const isFormulaCell = view === 'formulas' && isFormula(val);
        const cls = isFormulaCell ? ' yrxlsim-formula' : '';
        const display = (view === 'values' && (val === null || val === undefined)) ? '' : (view === 'formulas' ? cellDisplayValue(val) : val);
        const disp = view === 'formulas' ? display : displayValue(display);
        html += '<td class="yrxlsim-cell' + cls + '">' + escapeHtml(disp === '' ? '\u00A0' : disp) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderToHtml(doc, view) {
    view = view || 'formulas';
    if (view === 'formulas') {
      const effective = buildEffectiveGrid(doc);
      return renderTableHtml(effective.grid, effective.maxRow, Math.max(effective.maxCol, 1), 'formulas');
    }
    const values = buildValuesGrid(doc);
    return renderTableHtml(values.grid, values.maxRow, values.maxCol, 'values');
  }

  /** Pad string to width (no truncation; spaces on right). */
  function padRight(str, width) {
    const s = String(str);
    if (s.length >= width) return s;
    return s + Array(width - s.length + 1).join(' ');
  }

  /** Center string in width (pad left and right; extra space on right if odd). */
  function padCenter(str, width) {
    const s = String(str);
    if (s.length >= width) return s;
    const total = width - s.length;
    const left = Math.floor(total / 2);
    const right = total - left;
    return Array(left + 1).join(' ') + s + Array(right + 1).join(' ');
  }

  /** Render one grid as ASCII: unboxed centered column/row headers; data cells only are boxed. */
  function renderTableAscii(data, maxRow, maxCol, view) {
    const minCellWidth = 2;
    const rowHeaderWidth = Math.max(1, String(maxRow).length);
    const colWidths = [];
    for (let c = 0; c < maxCol; c++) {
      let w = minCellWidth;
      w = Math.max(w, colIndexToLetters(c).length);
      for (let r = 0; r < maxRow; r++) {
        const row = data[r] || [];
        const val = row[c];
        const disp = (view === 'values' && (val === null || val === undefined)) ? '' : (view === 'formulas' ? cellDisplayValue(val) : displayValue(val));
        w = Math.max(w, String(disp).length);
      }
      colWidths.push(w);
    }

    const lines = [];
    // Column headers (unboxed): centered in each column width
    let headerLine = padCenter('', rowHeaderWidth);
    for (let c = 0; c < maxCol; c++) {
      headerLine += padCenter(colIndexToLetters(c), colWidths[c]);
    }
    lines.push(headerLine);
    // Separator for data grid only (after row-header column)
    function dataSep() {
      let s = Array(rowHeaderWidth + 1).join(' ') + '+';
      for (let c = 0; c < maxCol; c++) s += Array(colWidths[c] + 1).join('-') + '+';
      lines.push(s);
    }
    dataSep();
    for (let r = 1; r <= maxRow; r++) {
      const rowData = data[r - 1] || [];
      // Row header (unboxed): row number centered in row-header width, then data cells boxed
      let line = padCenter(String(r), rowHeaderWidth) + ' ';
      line += '|';
      for (let c = 0; c < maxCol; c++) {
        const val = rowData[c];
        const disp = (view === 'values' && (val === null || val === undefined)) ? '' : (view === 'formulas' ? cellDisplayValue(val) : displayValue(val));
        line += padRight(disp, colWidths[c]) + '|';
      }
      lines.push(line);
    }
    dataSep();
    return lines.join('\n');
  }

  /**
   * Render doc to ASCII. view: 'formulas' | 'values' | 'both'.
   * Returns string suitable for stdout or terminal.
   */
  function renderToAscii(doc, view) {
    view = view || 'both';
    const effective = buildEffectiveGrid(doc);
    const formulasGrid = effective.grid;
    const maxRow = effective.maxRow;
    const maxCol = Math.max(effective.maxCol, 1);

    if (view === 'formulas') {
      return renderTableAscii(formulasGrid, maxRow, maxCol, 'formulas');
    }
    if (view === 'values') {
      const values = buildValuesGrid(doc);
      return renderTableAscii(values.grid, values.maxRow, values.maxCol, 'values');
    }
    const values = buildValuesGrid(doc);
    return 'FORMULAS VIEW\n\n' + renderTableAscii(formulasGrid, maxRow, maxCol, 'formulas') +
      '\n\nVALUES VIEW\n\n' + renderTableAscii(values.grid, values.maxRow, values.maxCol, 'values');
  }

  function renderAll() {
    if (typeof global.jsyaml === 'undefined') {
      if (global.console && global.console.warn) {
        global.console.warn('yrxlsim: js-yaml not loaded. Include js-yaml and ensure it exposes jsyaml.');
      }
      return;
    }
    if (typeof global.document === 'undefined' || !global.document.querySelectorAll) return;
    global.document.querySelectorAll('code.yrxlsim, pre.yrxlsim code').forEach(function (block) {
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
      const sheets = getSheets(doc);
      let formulasHtml = '';
      let valuesHtml = '';
      for (let i = 0; i < sheets.length; i++) {
        if (sheets.length > 1) {
          formulasHtml += '<div class="yrxlsim-sheet-label">Sheet ' + (i + 1) + '</div>';
          valuesHtml += '<div class="yrxlsim-sheet-label">Sheet ' + (i + 1) + '</div>';
        }
        formulasHtml += renderToHtml(sheets[i], 'formulas');
        valuesHtml += renderToHtml(sheets[i], 'values');
      }
      if (pre) {
        const wrap = global.document.createElement('div');
        wrap.className = 'yrxlsim-wrapper';
        const yamlLabel = global.document.createElement('div');
        yamlLabel.className = 'yrxlsim-label yrxlsim-label-yaml';
        yamlLabel.textContent = 'YAML';
        const formulasSection = global.document.createElement('div');
        formulasSection.className = 'yrxlsim-preview yrxlsim-preview-formulas';
        formulasSection.setAttribute('data-label', 'Formulas');
        formulasSection.innerHTML = formulasHtml;
        const valuesSection = global.document.createElement('div');
        valuesSection.className = 'yrxlsim-preview yrxlsim-preview-values';
        valuesSection.setAttribute('data-label', 'Values');
        valuesSection.innerHTML = valuesHtml;
        const parent = pre.parentNode;
        parent.replaceChild(wrap, pre);
        wrap.appendChild(yamlLabel);
        wrap.appendChild(pre);
        wrap.appendChild(formulasSection);
        wrap.appendChild(valuesSection);
      } else {
        block.outerHTML = formulasHtml;
      }
    });
  }

  global.yrxlsim = {
    colLettersToIndex: colLettersToIndex,
    colIndexToLetters: colIndexToLetters,
    parseA1: parseA1,
    parseRange: parseRange,
    buildEffectiveGrid: buildEffectiveGrid,
    buildValuesGrid: buildValuesGrid,
    getSheets: getSheets,
    renderToHtml: renderToHtml,
    renderToAscii: renderToAscii,
    renderTableAscii: renderTableAscii,
    renderAll: renderAll
  };

  function run() {
    if (typeof global.jsyaml !== 'undefined') {
      renderAll();
    } else if (typeof global.YAML !== 'undefined') {
      global.jsyaml = global.YAML;
      renderAll();
    } else if (typeof global.document !== 'undefined' && global.console && global.console.warn) {
      global.console.warn('yrxlsim: YAML parser not found. Include js-yaml (e.g. from CDN or npm).');
    }
  }
  if (typeof global.document !== 'undefined') {
    function scheduleRun() {
      if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', run);
      } else {
        run();
      }
    }
    scheduleRun();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.yrxlsim;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
