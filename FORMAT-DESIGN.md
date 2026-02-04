# Spreadsheet format design (yrXlsim)

**JSON/YAML layout for declarative sheets, sparse support, and HTML rendering.**

---

## 1. Goals

The spreadsheet format is designed to support:

- **Human editing** — Authors can create and modify sheets in a text editor. Rows are laid out horizontally (one row per line or array) for quick scanning and editing.
- **Sparse spreadsheets** — Blank cells need not be specified; only non-empty cells are required. Trailing blanks in a row can be omitted; isolated cells can be specified by address.
- **Dual rendering** — The same logical structure is the source of truth for:
  - **ASCII output** (CLI): column letters, row numbers, `+`/`-`/`|` grid; FORMULAS view and VALUES view.
  - **HTML output**: JavaScript loads the structure (JSON or parsed YAML), builds a grid, and renders to HTML with CSS so it looks like an Excel spreadsheet.
- **One source of truth** — Formulas (and optionally literal values) live in the file. An optional `values` override can freeze specific cell results for reproducible VALUES view (e.g. in published material) without changing formulas.

---

## 2. Survey of existing formats

| Approach | Structure | Sparse? | Row-based editing? | Notes |
|----------|-----------|---------|--------------------|--------|
| **SheetJS AOA** | Array of arrays: `[["A1","B1"],["A2","B2"]]` | No (holes/undefined) | Yes | Standard in JS; `aoa_to_sheet` / `sheet_to_json`. Dense; blanks = empty slots or null. |
| **SheetJS CSF** | Object keyed by A1: `{"A1":{t,v,f},"B2":{...},"!ref":"A1:B2"}` | Yes | No | Only non-empty cells; `!ref` gives used range. Ideal for sparse; poor for “one row per line” editing. |
| **Plan/PRD YAML** | `rows: [ ["first die", "second die", ...], [...], ... ]` | Optional cell map | Yes | Matches current yrXlsim spec; cell map (e.g. `A1: "x"`) for sparse. |
| **W3C CSV on the Web** | JSON with metadata (rows, cells, annotations) | Via metadata | Partially | Conversion-focused; heavier; not optimized for formula + sparse authoring. |
| **Table Dialect (FDP)** | Descriptor (delimiter, header, etc.) | N/A | N/A | Describes how to interpret tabular data, not a spreadsheet-with-formulas format. |
| **Paradicms** | First row = headers (JSON-LD terms); rows as data | No | Yes | Good for semantic tables; not aimed at Excel-like formulas and A1 refs. |

**References**

- SheetJS AOA: [Arrays of Data](https://docs.sheetjs.com/docs/api/utilities/array/)
- SheetJS CSF: [Common Spreadsheet Format](https://docs.sheetjs.com/docs/csf/), [Sheet Objects](https://docs.sheetjs.com/docs/csf/sheet/), [Cell Objects](https://docs.sheetjs.com/docs/csf/cell/)
- W3C CSV on the Web: [Generating JSON from Tabular Data](https://w3c.github.io/csvw/csv2json/)
- Table Dialect: [Table Dialect](https://datapackage.org/standard/table-dialect/)
- Paradicms: [Reference: spreadsheet format](https://paradicms.github.io/docs/reference/spreadsheet-format/)

**Conclusion:** No single standard fits “row-based + sparse + formulas” perfectly. The closest are: (1) **SheetJS AOA** for row-first, dense grids in JS; (2) **SheetJS CSF** for sparse, A1-keyed storage; (3) **YAML rows + optional cell map** (plan/PRD), which is a hybrid. This design adopts that hybrid and formalizes it as a single logical schema usable as YAML (authoring) and JSON (interchange/HTML).

---

## 3. Logical schema

The spreadsheet is a single object with the following keys. All keys except `rows` are optional.

### 3.1 `rows` (required)

- **Type:** Array of rows.
- **Each row:** Array of cell contents. Each cell is a string: either a formula (e.g. `=A2+B2`) or a literal value (e.g. `first die`, `42`). No separate type field; a value is a formula if it starts with `=`, otherwise it is literal.
- **Trailing blanks:** A row may have fewer elements than the number of columns in the sheet. Missing elements at the end of a row are treated as blank. No need to write `""` or `null` for every trailing cell.
- **Leading/middle blanks:** Use `""` or `null` (or omit and use `cells` for that row) to denote a blank. Semantics: empty string and `null` both mean “blank cell.”

### 3.2 `cells` (optional)

- **Type:** Object (map) keyed by A1-style cell address (e.g. `A1`, `B3`, `Z99`).
- **Value:** String (formula or literal), same as in `rows`.
- **Role:** Override or extend `rows`. For any cell, if `cells["<address>"]` is present, that value is used; otherwise the value comes from `rows[rowIndex][colIndex]`.
- **Use case:** Sparse sheets (e.g. one formula in D10); or adding cells without lengthening every row in `rows`.

Ranges (e.g. `A1:B2`) are reserved for future use (e.g. merged cells or bulk values); this version only defines single-cell keys.

### 3.3 `values` (optional)

- **Type:** Same shape as needed for reproducibility: either an A1-keyed map (like `cells`) or a structure mirroring `rows` (array of rows, each row array of evaluated values).
- **Role:** Override the result of formula evaluation for specific cells (e.g. freeze RANDBETWEEN results for the book). Used only for VALUES view; FORMULAS view always comes from `rows` + `cells`.
- **Detail:** Can be left minimal in this design doc (e.g. “A1-keyed map of display values” or “rows-shaped array of values”); implementers can choose one or both.

### 3.4 `meta` (optional)

- **Type:** Object.
- **Possible keys:** `cols` (column count hint), `defaultColWidth`, `seed` (for reproducible volatile functions), etc. Only introduce as needed; not required for the core format.

---

## 4. Sparsity rules

### 4.1 Used range

- **From `rows`:** Let `maxRow = rows.length`, and `maxCol = max(length(rows[i]))` over all row indices `i`.
- **From `cells`:** Parse each key that is a single-cell A1 address (e.g. `B5`); derive row and column; update `maxRow` and `maxCol` to include that cell.
- **Used range:** The rectangle from `A1` to the cell at `maxRow`, `maxCol` (column letter from index). Any cell inside this rectangle that is not given in `rows` or `cells` (or is given as `""`/`null`) is **blank**.

### 4.2 Blank cells

- **Blank** = not present in `cells` and (missing in `rows` or present as `""` or `null`).
- No need to list blanks in `cells`. No need to pad `rows` with `""` or `null` for trailing cells; only leading/middle blanks need an explicit empty value if using `rows` alone.

---

## 5. Examples

### 5.1 Dense (rows only)

All cells in a small grid; trailing blanks omitted on the last row.

**YAML:**

```yaml
rows:
  - ["first die", "second die", "Total on both dice"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A3+B3"]
```

**JSON (equivalent):**

```json
{
  "rows": [
    ["first die", "second die", "Total on both dice"],
    ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"],
    ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A3+B3"]
  ]
}
```

### 5.2 Sparse (cells only)

Only a few cells have content; no `rows` (or `rows: []`). Used range is derived from the cell keys.

**YAML:**

```yaml
cells:
  A1: "Title"
  B1: "Value"
  A2: "=RANDBETWEEN(1,100)"
  B2: "=A2"
```

**JSON:**

```json
{
  "cells": {
    "A1": "Title",
    "B1": "Value",
    "A2": "=RANDBETWEEN(1,100)",
    "B2": "=A2"
  }
}
```

### 5.3 Hybrid (rows + cells)

Most content in `rows` for easy row-based editing; a few cells overridden or added via `cells`.

**YAML:**

```yaml
rows:
  - ["Name", "Score"]
  - ["Alice", "=B2"]
  - ["Bob", "85"]
cells:
  B2: "=RANDBETWEEN(0,100)"
  D1: "Note"
  D2: "Volatile"
```

Here B2 is overridden by `cells` (formula); D1 and D2 are extra columns, so the used range extends to column D.

### 5.4 Values override (reproducible VALUES view)

Formulas in `rows`/`cells`; optional `values` freeze specific results for publication.

**YAML:**

```yaml
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
values:
  A2: 4
  B2: 2
  C2: 6
```

FORMULAS view shows the formulas; VALUES view shows 4, 2, 6 in row 2 when `values` is applied.

---

## 6. YAML authoring

- **Primary style:** Use `rows` with flow arrays for compact, horizontal layout: `- ["A", "B", "C"]`. One row per line.
- **Multi-line formulas:** For long formulas, use YAML multiline. Either quote and use `|` or `>` so the formula stays one logical line, or use a single-quoted block; ensure the leading `=` is preserved so the engine treats it as a formula.

Example:

```yaml
rows:
  - ["Header"]
  - ["=IF(A2>0,\n  SUM(B2:D2),\n  0)"]
```

Or keep formulas on one line in YAML and break only in comments if needed.

- **Sparse:** Use the `cells` map for one-off or distant cells. Keys are A1-style; no quotes needed for simple addresses in YAML, but quoted keys are fine (e.g. `"A1": "x"`).
- **Comments:** YAML allows `#` comments; use them for section headers or to document formulas.

---

## 7. JSON for HTML/JS

The same logical schema is used as JSON for the browser:

1. **Load:** Fetch or embed the JSON (or parse YAML in JS if a parser is available).
2. **Normalize:** Build an in-memory grid or A1 map:
   - **Option A:** 2D array `grid[rowIndex][colIndex]` by iterating `rows` and then applying `cells` overrides (A1 → row/col, then assign).
   - **Option B:** A1-keyed map only: from `rows` fill a `{ "A1": v, "B1": v, ... }` object, then overlay `cells`. Used range from §4.
3. **Render:** Generate HTML (e.g. `<table>` or a grid of `<div>`s). Use CSS to style like Excel (borders, column letters row, row numbers column, cell padding, fixed or auto column widths).
4. **Views:** If both FORMULAS and VALUES are needed in HTML, either evaluate formulas in JS (using the same engine as the CLI, or a subset) or supply precomputed VALUES in the JSON (e.g. from the CLI). The schema’s `values` key can carry that.

No new format is required; the same schema is the contract between the declarative file and the HTML renderer.

---

## 8. Optional: TOML

TOML does not have a native “array of arrays” structure. Rows could be represented in a keyed way, for example:

- **Rows as tables:** `[rows.1]`, `[rows.2]` with keys `A`, `B`, `C` for columns. That gives row-based editing per row but requires repeating column names and is verbose.
- **Cells as table:** `[cells]` with A1 keys; TOML keys would need to be quoted for addresses like `"A1"`. Sparse-only is possible; row-based editing is not natural.

Recommendation: **Treat TOML as secondary.** Use YAML (or JSON) as the primary format. If TOML support is added later, it can map to the same logical schema (e.g. emit or read `rows` + `cells` from TOML tables), with the caveat that row-first editing in TOML will be less convenient than in YAML.
