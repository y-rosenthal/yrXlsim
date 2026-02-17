# yrXlsim Spreadsheet Format — YAML Specification

**Version:** 0.0.2  
**Format name:** yrXlsim sheet format (YAML)  
**File extension:** `.yaml` or `.yml`

The following is a spec intended to provide a file format for describing the contents of an Excel document. It could be used for rendering an image of said document or for specifying the contents of the spreadsheet with the intent of calculating the formulas and rendering the resulting image of the calculated spreadsheet. The format of the file is intended to make editing, maintaining and using a file that follows the format with minimal effort and minimal chance for errors creeping in. The goal is to have a file format that enables processing the file (i.e. rendering and calculating) using both CLI tools (primarily Bash) and Javascript (for use on websites) with the same core codebase.

YAML was chosen as the underlying format. The same logical structure may be represented as JSON for interchange or HTML rendering; the rules in this spec apply to that representation as well.

This document is the normative specification for the YAML-based spreadsheet format used by yrXlsim.

---

## 1. Document structure

A valid sheet document is a single YAML mapping (object) at the root. All keys are defined by this specification; processors MUST ignore unknown keys.

### 1.1 Top-level keys

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `version` | No      | String | Spec version the document targets (e.g. `"0.0.2"`). Processors use it to select behavior when the spec changes. If absent, processors SHOULD assume the latest version they support. |
| `rows`    | Conditional | Array | List of rows; each row is an array of cell contents. Required unless `cells` is present and non-empty. |
| `cells`   | No      | Mapping | A1-keyed map of cell contents. Overrides and extends `rows`. |
| `fill`    | No      | Array  | List of fill (expand) operations: copy a row, column, or cell range with formula references adjusted. See §4. |
| `values`  | No      | Mapping or Array | Override evaluated values for VALUES view (reproducibility). |
| `meta`    | No      | Mapping | Optional metadata (e.g. `seed`, `cols`). |
| `sheets`  | No      | Array  | Multi-sheet mode. When present and non-empty, the root is a multi-sheet document (§1.3); all other root keys are ignored. |

**Constraint:** At least one of `rows`, `cells`, or `fill` MUST be present and supply at least one cell. If only `cells` is present, `rows` MAY be omitted or given as an empty array `[]`. If only `fill` is present (e.g. block fill), `rows` MAY be `[]` and `cells` MAY be absent; the used range is then derived from the fill operations.

**Example (minimal document):**

```yaml
version: "0.0.2"
rows:
  - ["Label", "Data"]
  - ["X", "=A2"]
```

### 1.2 Processing pipeline

Processors MUST execute the following steps in order. This sequence is **canonical**; there is no alternative ordering.

| Step | Action | Input | Output |
|------|--------|-------|--------|
| 1. Parse | Parse the YAML document. | Raw file | Root mapping |
| 2. Merge rows + cells into base grid | Build a grid from `rows`. Then overlay `cells`: for every key in `cells`, set that cell in the grid (overwriting any value from `rows`). | `rows`, `cells` | Base grid |
| 3. Expand fill | Apply each fill operation (§4) in array order. Each operation reads from the current state of the grid (including results of earlier fill operations) and writes its output into the grid. | Base grid, `fill` array | Expanded grid |
| 4. Apply cells overrides | Overlay `cells` onto the expanded grid a second time. This ensures that explicit `cells` entries take priority over any content produced by fill. | Expanded grid, `cells` | Effective grid |
| 5. Compute used range | Determine the used range (§6) from the effective grid. | Effective grid | Used range |
| 6. Evaluate / Render | Evaluate formulas (VALUES view) or display formula text (FORMULAS view). Apply `values` overrides (§7) for VALUES view only. | Effective grid, `values` | Output |

> **Rationale for step 4:** `cells` is applied twice — once before fill (so fill templates pick up cell overrides) and once after fill (so explicit cell entries are never clobbered by fill output). This is equivalent to the rule "`cells` always wins."

### 1.3 Version

- **Key:** `version`
- **Type:** String (e.g. `"0.0.2"`). Recommended format: major.minor.patch.
- **Semantics:** Indicates which version of this spec the document targets. Processors SHOULD read this key and use it to select behavior (e.g. which features to apply, or whether to warn on unknown version). If absent, processors SHOULD assume the latest version they support.

**Compatibility rules:**

| Condition | Processor behavior |
|-----------|-------------------|
| Document major version > processor major version | Processor MAY reject the document; MUST warn. |
| Document minor version > processor minor version (same major) | Processor SHOULD warn; MUST NOT reject. |
| Document patch version > processor patch version (same major.minor) | Processor MUST accept silently. |
| Document version < processor version | Processor SHOULD interpret the document according to that version's rules when feasible. |

- **Major** increments signal breaking changes; backward compatibility is not guaranteed.
- **Minor** increments add features in a backward-compatible way.
- **Patch** increments are editorial or clarification-only; no behavioral change.

### 1.4 Multi-sheet documents

- **Key:** `sheets`
- **Type:** Array of sheet documents. Each element is a mapping (object) with the same top-level keys as a single-sheet document (§1.1): `version`, `rows`, `cells`, `fill`, `values`, `meta`.
- **Semantics:** When present and non-empty, the root document represents **multiple sheets**. Processors MUST render each element in array order (e.g. Sheet 1, Sheet 2, …). When `sheets` is present and non-empty, root-level `rows`, `cells`, `fill`, `values`, and `meta` MUST be ignored — they have no effect on any sheet. Each sheet element is processed independently through the pipeline in §1.2.
- **Single-sheet compatibility:** If the root has no `sheets` key (or `sheets` is absent/empty), the root is treated as one sheet and the document is a **single-sheet** document as described in §1.1.

**Example (multi-sheet):**

```yaml
sheets:
  - version: "0.0.2"
    rows:
      - ["Label", "Data"]
      - ["X", "=A2"]
  - rows:
      - ["=A1+B1", "Sum"]
```

---

## 2. Rows

### 2.1 Type and shape

- **Key:** `rows`
- **Type:** Array of arrays. Each element is a **row**. Row order is significant: the first element is row 1, the second is row 2, and so on (1-based row index in A1 notation).
- **Row:** An array of **cell values**. Each element corresponds to a column, left to right: index 0 is column A, 1 is B, etc.

### 2.2 Cell value (in rows)

Each element in a row is a **cell value**. Permitted types and meaning:

| Type    | Meaning | Example |
|---------|---------|---------|
| String  | Formula if it starts with `=`, otherwise literal (text or number as string). | `"=A2+B2"`, `"Total"`, `"42"` |
| Null    | Blank cell. | `null` (YAML `~` or `null`) |
| Empty string | Blank cell. Equivalent to null for display. | `""` |

Numbers and booleans MAY be accepted by processors; they MUST be treated as literals and rendered as their string representation (e.g. `42` → `"42"`). This spec does not require a separate type for numbers; string `"42"` is equivalent for authoring.

#### 2.2.1 Literal strings that begin with `=`

A cell value that starts with `=` is always treated as a formula. To represent a **literal** string that begins with `=`, prefix it with a single quote: `"'=not a formula"`. Processors MUST strip the leading `'` before display (the displayed value is `=not a formula`). This follows the same convention used by Excel and other spreadsheet applications.

**Example (cell value types in a row):**

```yaml
rows:
  - ["=A2+B2", "Total", "42", null, "", "'=literal equals"]
```
Formula, literal text, literal number-as-string, blank (null), blank (empty string), literal string starting with `=`.

### 2.3 Trailing blanks

A row MAY have fewer elements than other rows or than the number of columns in the sheet. Missing elements at the end of a row are treated as **blank**. Processors MUST NOT require trailing `""` or `null` for alignment.

### 2.4 Leading or middle blanks

To represent a blank cell before or between non-blank cells in a row, use `""` or `null` in the row array at the corresponding index.

**Example (leading or middle blanks):**

```yaml
rows:
  - ["A", "", "C"]    # B is blank
  - ["", "B2", ""]    # A and C blank
  - ["X", "Y"]        # row 3 has two cells; trailing cells are blank
```

---

## 3. Cells (A1 map)

### 3.1 Purpose

The `cells` key allows specifying or overriding cell contents by A1-style address. It supports sparse sheets (only non-empty cells) and overrides to `rows` without editing the row arrays.

### 3.2 Type and shape

- **Key:** `cells`
- **Type:** Mapping (object). Keys are A1-style cell addresses. Values are cell values (same as in §2.2: string formula or literal, or empty string / null for blank).

### 3.3 A1-style address

- **Syntax:** One or more uppercase column letters followed by a 1-based row number. No spaces.
- **Grammar (ABNF):**

```
cell-address = col-letters row-number
col-letters  = 1*3ALPHA        ; A–Z, AA–ZZ, AAA–XFD (uppercase)
row-number   = nonzero-digit *digit
nonzero-digit = "1" / "2" / ... / "9"
digit         = "0" / "1" / ... / "9"
```

- **Case:** Case-insensitive; processors MUST normalize to uppercase internally. Authors SHOULD use uppercase.
- **Examples:** `A1`, `B3`, `Z99`, `AA1`, `AB10`.
- **Reserved:** Range notation (e.g. `A1:B2`) is not valid as a `cells` key. Processors MUST ignore keys that contain `:` or otherwise do not match the grammar above, or MAY treat them as an error.

### 3.4 Cell value (in cells)

Same as §2.2: string (formula if starting with `=`, else literal), or `""` / `null` for blank. Setting a cell to blank in `cells` overrides a value from `rows` for that cell.

**Example (sparse cells only):**

```yaml
rows: []
cells:
  A1: "Title"
  B2: "=A1"
  C3: null
```
Used range A1:C3; A2, B1, B3, C1, C2 are blank.

---

## 4. Fill (expand)

### 4.1 Purpose

The `fill` key allows a row, column, or cell to act as a **template** that is "dragged" to other rows, columns, or ranges without writing every cell in the YAML. Processors expand fill operations first; the result is as if the expanded content had been written in `rows` and `cells`. This keeps the YAML short and readable while expressing repeated patterns (e.g. "row 2 filled down to row 10").

### 4.2 Type and shape

- **Key:** `fill`
- **Type:** Array of **fill operations**. Each operation is a mapping with keys that identify the template and the target. Operations MUST be applied in array order (index 0 first, then index 1, etc.); each operation reads from and writes to the current grid state. Later operations MAY overwrite cells produced by earlier ones; the last write to any cell wins.

### 4.3 Fill operation kinds

Each fill operation MUST be one of the following. All row and column references use 1-based row numbers and A1-style column letters (e.g. `A`, `B`, `AA`).

#### 4.3.1 Block fill (range + value)

Fill an entire rectangle with a **single value** (formula or literal). No template cell; no reference adjustment. Use when every cell in the range should get the same content (e.g. `=RANDBETWEEN(1,6)` in A1:C4).

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `range`   | Conditional | String | A1-style range (e.g. `A1:C4`). Exactly one of `range` or `from`+`to` MUST be present. |
| `from`    | Conditional | String | Top-left cell of the block (e.g. `A1`). |
| `to`      | Conditional | String | Bottom-right cell of the block (e.g. `C4`). |
| `value`   | Yes      | String | Formula or literal; every cell in the block gets this value. |

**Semantics:** Every cell in the rectangle (inclusive) is set to `value`. No parsing or adjustment of references. The block contributes to the used range.

**Example (block fill — range):**

```yaml
rows: []
fill:
  - range: A1:C4
    value: "=RANDBETWEEN(1,6)"
```
All 12 cells get that formula; no reference adjustment.

**Example (block fill — from/to):**

```yaml
fill:
  - from: A1
    to: C4
    value: "=RANDBETWEEN(1,6)"
```
Same effect as above using `from` and `to`.

#### 4.3.2 Row fill

Copy one row's content to other rows (replication) and/or extend the template row to more columns (extension); adjust **relative** references in formulas.

**Terminology:** In row fill, `down` and `up` are **replication** directions — they copy the entire template row to new rows. `right` and `left` are **extension** directions — they widen the template row itself before replication. These are distinct operations: replication creates new rows from the template; extension creates new columns within the template.

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `row`     | Yes      | Integer | 1-based row number of the template row. |
| `down`    | No       | Integer | Number of rows to replicate below the template (default 0). |
| `up`      | No       | Integer | Number of rows to replicate above the template (default 0). |
| `right`   | No       | Integer | Number of columns to extend the template row to the right (default 0). |
| `left`    | No       | Integer | Number of columns to extend the template row to the left (default 0). See §4.5 for boundary rules. |
| `toRow`   | No       | Integer | Alternative to `down`: last row to replicate to (inclusive). If present, `down` is ignored for the downward extent. |
| `toCol`   | No       | String | Alternative to `right`: last column to extend to (inclusive). If present, `right` is ignored for the right extent. |

At least one of `down`, `up`, `right`, `left`, `toRow`, or `toCol` MUST be present and imply a positive extent.

**Semantics:** The template row is taken from the current grid state. 

- **Replication (down/up):** The template row is copied to rows `(row − up)` through `(row + down)` (or through `toRow` if given), excluding the template row itself. For each target cell, add `(target_row − template_row)` to relative row references in formulas; column references are unchanged. Literals copy as-is.
- **Extension (right/left):** Before replication, the template row's column span is widened. New columns are generated by copying the last (for `right`) or first (for `left`) cell of the template and adjusting relative column references by the column delta. Extension happens before replication so that replicated rows include the extended columns.

**Example (row fill down — replication):**

```yaml
rows:
  - ["ColA", "ColB"]
  - ["=A1+1", "=B1*2"]
fill:
  - row: 2
    down: 8
```
Rows 3–10 get formulas with relative row refs adjusted (e.g. row 3: `=A2+1`, `=B2*2`; row 4: `=A3+1`, `=B3*2`).

**Example (row fill with toRow/toCol):**

```yaml
rows:
  - ["X", "Y"]
fill:
  - row: 1
    toRow: 4
    toCol: D
```
Template row 1 extended to columns C–D (extension), then replicated to rows 2–4 (replication).

#### 4.3.3 Column fill

Copy one column's content to other columns (replication) and/or extend the template column to more rows (extension); adjust **relative** references in formulas.

**Terminology:** In column fill, `right` and `left` are **replication** directions — they copy the entire template column to new columns. `down` and `up` are **extension** directions — they lengthen the template column itself before replication.

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `col`     | Yes      | String | Column letter(s) of the template column (e.g. `A`, `B`, `AA`). |
| `right`   | No       | Integer | Number of columns to replicate to the right (default 0). |
| `left`    | No       | Integer | Number of columns to replicate to the left (default 0). See §4.5 for boundary rules. |
| `down`    | No       | Integer | Number of rows to extend the column downward (default 0). |
| `up`      | No       | Integer | Number of rows to extend the column upward (default 0). See §4.5 for boundary rules. |
| `toCol`   | No       | String | Alternative to `right`: last column to replicate to (inclusive). |
| `toRow`   | No       | Integer | Alternative to `down`: last row to extend to (inclusive). |

At least one of `right`, `left`, `down`, `up`, `toCol`, or `toRow` MUST be present and imply a positive extent.

**Semantics:** The template column is taken from the current grid state.

- **Replication (right/left):** The template column is copied to columns to the right and/or left of it. For each target cell, add `(target_col − template_col)` to relative column references in formulas; row references are unchanged. Literals copy as-is.
- **Extension (down/up):** Before replication, the template column's row span is lengthened. New rows are generated by copying the last (for `down`) or first (for `up`) cell of the template and adjusting relative row references by the row delta.

**Example (column fill right — replication):**

```yaml
rows:
  - ["Header"]
  - ["=A1+1"]
  - ["=A2+1"]
fill:
  - col: A
    right: 2
```
Columns B and C get the same pattern with column refs adjusted (B1: `Header`, B2: `=B1+1`, B3: `=B2+1`; C similarly).

**Example (column fill right + down — replication + extension):**

```yaml
rows:
  - ["Header"]
  - ["=A1+1"]
fill:
  - col: A
    right: 2
    down: 3
```
Column A extended to 5 rows (extension: A3–A5 generated from template), then replicated to B and C (replication).

#### 4.3.4 Cell fill (fill from one cell)

Copy one cell's content to a rectangle; adjust references in formulas. Any combination of `down`, `up`, `right`, `left` defines the block.

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `from`    | Yes      | String | A1-style address of the template cell (e.g. `A1`, `C4`). |
| `down`    | No       | Integer | Number of rows to fill below the template (default 0). |
| `up`      | No       | Integer | Number of rows to fill above the template (default 0). |
| `right`   | No       | Integer | Number of columns to fill to the right (default 0). |
| `left`    | No       | Integer | Number of columns to fill to the left (default 0). |
| `to`      | No       | String | Alternative: opposite corner of the block (inclusive). If present, the block is from `from` to `to`; `down`/`up`/`right`/`left` are ignored. |

At least one of `down`, `up`, `right`, `left`, or `to` MUST be present. If `to` is used, the block is the rectangle from `from` to `to` (inclusive); `to` may be any corner relative to `from`.

**Semantics:** The block is rows `(template_row − up)` through `(template_row + down)`, columns `(template_col − left)` through `(template_col + right)` (column indices). The template cell is included. For each target cell, set content from the template; for **formulas**, add (target_row − template_row) to relative row refs and (target_col − template_col) to relative column refs (negative for up/left). For **literals**, copy as-is.

**Example (cell fill down + right):**

```yaml
rows:
  - ["Score"]
cells:
  A2: "=A1+1"
fill:
  - from: A2
    down: 3
    right: 2
```
Block A2:C5; A2 has `=A1+1`. A3 gets `=A2+1`, A4 gets `=A3+1`, A5 gets `=A4+1`. B2 gets `=B1+1`, C2 gets `=C1+1`. B3 gets `=B2+1`, etc.

**Example (cell fill with to):**

```yaml
cells:
  A1: "=ROW()*COLUMN()"
fill:
  - from: A1
    to: C4
```
Block A1:C4; template A1. Each cell gets the formula with refs adjusted. Since `ROW()` and `COLUMN()` have no cell references, the formula text is the same in every cell, but each cell evaluates to its own row × column.

### 4.4 Reference adjustment rules

These rules apply to row fill, column fill, and cell fill. **Block fill** (§4.3.1) does not adjust references; every cell gets the same `value` string.

#### 4.4.1 Reference types

- **Relative reference:** Unanchored row and column (e.g. `A1`, `B2`). Both row and column adjust.
- **Absolute reference:** `$A$1` — neither row nor column changes.
- **Mixed reference:** `$A1` (absolute column, relative row) — row adjusts, column does not. `A$1` (relative column, absolute row) — column adjusts, row does not.

#### 4.4.2 Adjustment

For a given target cell with deltas `(row_delta, col_delta)` relative to the template:

- Add `row_delta` to the row number of every **relative row** component.
- Add `col_delta` to the column index of every **relative column** component (convert letter(s) to 0-based index, add delta, convert back).

Processors MUST parse formulas and adjust only the relative parts of cell references; literal text, function names, and string arguments are unchanged.

#### 4.4.3 Reference parsing scope

This spec requires processors to recognize and adjust **A1-style cell references** within formulas. The minimal reference pattern (expressed as a regular expression) is:

```
(\$?)([A-Z]{1,3})(\$?)([1-9][0-9]*)
```

Where capture group 1 is the optional column anchor (`$`), group 2 is the column letters, group 3 is the optional row anchor (`$`), and group 4 is the row number.

Processors MUST NOT adjust references that appear inside **string literals** within formulas (text enclosed in double quotes, e.g. `"A1"` inside a `CONCATENATE` call). Full Excel formula grammar is out of scope for this spec; processors are responsible for distinguishing string literals from cell references at minimum. Processors MAY support additional reference forms (e.g. sheet-qualified references like `Sheet1!A1`) but this is not required.

### 4.5 Boundary behavior

Fill operations that would place cells outside the valid grid MUST be clamped:

| Condition | Rule |
|-----------|------|
| Fill up past row 1 | Cells that would land at row ≤ 0 are silently discarded. The fill produces cells only for rows ≥ 1. |
| Fill left past column A | Cells that would land at column index < 0 (before A) are silently discarded. The fill produces cells only for columns ≥ A. |
| Reference adjustment produces invalid ref | If adjusting a relative reference would produce row ≤ 0 or column before A, the behavior is implementation-defined. Processors MAY produce an error value (e.g. `#REF!`), clamp to the boundary, or treat it as an error. |

**Example (fill up clamped at row 1):**

```yaml
cells:
  A3: "=A2+1"
fill:
  - from: A3
    up: 5
```
Only A1 and A2 are produced (up 2 rows from A3). The 3 additional rows that would be at row 0, −1, −2 are discarded. A1 gets `=A0+1` which is an invalid reference — processor handles per implementation (e.g. `#REF!`).

### 4.6 Interaction with rows and cells

- Fill uses the **current grid state** at expansion time. Before fill runs, `rows` and `cells` have already been merged (pipeline step 2 in §1.2). So if a cell is overridden in `cells`, the override is what gets used as the template.
- After all fill operations complete, `cells` is applied again (pipeline step 4) so that explicit `cells` entries always take priority over filled content.
- If multiple fill operations write to the same cell, the last operation wins (array order).

---

## 5. Resolution: rows vs cells

For any cell address (row R, column C) in the **effective grid** (after pipeline steps 1–4 in §1.2):

1. If `cells` contains a key for that address, the value is from `cells` (this was enforced by pipeline step 4).
2. Otherwise, if the grid has a value at that position (from `rows` or fill), that value is used.
3. Otherwise, the cell is **blank**.

Blank in `rows` or `cells` (empty string or null) is still a defined value: the cell is blank. Omission (no key in `cells`, or no element at that index in `rows`) also means blank. So: **cells override rows** (and filled content); within either, presence of `""` or `null` means blank, and omission of trailing elements in a row means blank.

**Example (resolution: cells override rows):**

```yaml
rows:
  - ["A", "B", "C"]
  - ["1", "2", "3"]
cells:
  B2: "overridden"
  D1: "extra"
```
B2 shows "overridden" (not "2"); D1 extends the grid. A2, C2, D2 from rows/omission.

---

## 6. Used range

The **used range** is the smallest rectangle that contains every cell that has a value (non-blank) in the effective grid after the processing pipeline (§1.2, steps 1–4).

> **Note:** Earlier versions of this spec mentioned including cells referenced by formulas in the used range. This is **not** required. Used range is determined solely by cells that have content (non-blank values from `rows`, `cells`, or `fill` output). Processors MAY expand the used range to include referenced cells, but this is non-normative and MUST NOT be relied upon for conformance.

**Computation:** Apply after pipeline step 4. Compute over the effective grid:

- **From rows:** Let `maxRow = rows.length` (number of rows). Let `maxCol = 0`; for each row in the effective rows, set `maxCol = max(maxCol, row.length)` (number of columns in that row).
- **From cells:** For each key in `cells` that is a valid single-cell A1 address, parse row and column; set `maxRow = max(maxRow, parsedRow)` and `maxCol = max(maxCol, parsedCol)` (column as 0-based index).
- **From fill output:** Include all cells written by fill operations in the maxRow/maxCol calculation.
- **Used range:** From cell `A1` to the cell at row `maxRow` and column index `maxCol` (convert to letter: 0→A, 1→B, …, 25→Z, 26→AA, etc.).

If the effective grid is empty (no rows, no cells, no fill output), the used range is undefined; processors MAY treat the sheet as empty (no grid) or as a single blank cell at A1.

**Example (used range from rows and cells):**

```yaml
rows:
  - ["X", "Y"]
  - ["a", "b", "c"]
cells:
  E1: "far"
```
Max row 2 (rows), max column E (index 4 from cells); used range A1:E2.

---

## 7. Values (reproducibility override)

### 7.1 Purpose

The `values` key overrides the result of formula evaluation for the VALUES view only. It is used to freeze volatile results (e.g. RANDBETWEEN) for reproducible output (e.g. in published material). FORMULAS view is unaffected and always comes from `rows` and `cells`.

### 7.2 Type and shape

- **Key:** `values`
- **Type:** Either:
  - **Mapping (A1-keyed):** Same key style as `cells`. Values are the displayed value for that cell in VALUES view (number, string, boolean, or null for blank). Processors MAY coerce to string for display.
  - **Array of rows (experimental):** Same shape as `rows`; each element is the evaluated value for that cell. Processors that support this form use it to fill VALUES view by position; any cell not covered may fall back to evaluated formula or be blank.

The A1-keyed form MUST be supported by all conforming processors. The array form is **experimental in version 0.0.2** and MAY be supported; authors who need maximum portability SHOULD use the A1-keyed form. The array form may be promoted to required or removed in a future version.

### 7.3 Semantics

- For VALUES view: if a cell has an entry in `values` (by address or by position in the array form), that value is used instead of evaluating the formula (or literal) from `rows`/`cells`.
- For FORMULAS view: `values` is ignored; display always comes from the effective grid (formula text or literal).

**Example (values — A1-keyed):**

```yaml
rows:
  - ["=RANDBETWEEN(1,6)"]
values:
  A1: 4
```
FORMULAS view: `=RANDBETWEEN(1,6)`; VALUES view: 4.

**Example (values — array of rows, experimental):**

```yaml
rows:
  - ["A", "B"]
  - ["=1+1", "=A2*2"]
values:
  - [null, null]
  - [2, 4]
```
VALUES view row 2 shows 2 and 4 instead of evaluating formulas.

---

## 8. Meta

- **Key:** `meta`
- **Type:** Mapping. Keys and meaning are implementation-defined. This spec does not mandate any keys.

**Suggested keys (non-normative):**

- `seed`: integer or string; used to seed the formula engine for reproducible volatile functions.
- `cols`: integer; hint for minimum or fixed column count (e.g. for layout).
- `defaultColWidth`: integer; hint for column width in characters or pixels.

Processors MUST ignore unknown `meta` keys.

**Example (meta with suggested keys):**

```yaml
version: "0.0.2"
rows:
  - ["Roll"]
  - ["=RANDBETWEEN(1,6)"]
meta:
  seed: 42
  cols: 5
  defaultColWidth: 12
```
Reproducible dice when seed is used; layout hints for display.

---

## 9. Limits

This spec does not mandate hard limits, but defines recommended minimums that conforming processors SHOULD support:

| Dimension | Recommended minimum |
|-----------|-------------------|
| Rows | 1,048,576 (2²⁰) |
| Columns | 16,384 (A–XFD, matching Excel) |
| Formula length | 8,192 characters |
| Cell content length | 32,767 characters |
| Fill operations | 1,000 |
| Sheets (multi-sheet) | 256 |

Processors MAY impose lower limits; if a document exceeds a processor's limits, the processor MUST report an error (not silently truncate).

---

## 10. YAML-specific rules

### 10.1 Encoding

Files SHOULD be UTF-8. Processors MAY accept other encodings; behavior is implementation-defined.

### 10.2 Key quoting

YAML allows unquoted keys for addresses that are alphanumeric (e.g. `A1`, `B2`). Keys that could be parsed as numbers (e.g. `1` alone) must not be used as cell addresses per A1 syntax. Quoted keys (e.g. `"A1": "x"`) are valid and equivalent.

### 10.3 Multiline formulas

Cell values that contain newlines (e.g. long formulas) MAY use YAML multiline scalars. The logical value MUST be a single string; the formula engine receives the string with newlines preserved or collapsed per YAML rules. Processors MUST treat a value as a formula only if, after parsing, it starts with `=`.

### 10.4 Comments

YAML comments (`#`) are allowed anywhere and MUST be ignored by processors.

**Example (quoted key and multiline formula):**

```yaml
rows: []
cells:
  A1: "Title"
  "B2": "=SUM(\n  A1:A10\n)"
```
Quoted `"B2"` is valid; formula in B2 may be written as multiline; after parsing it must start with `=` to be treated as formula.

---

## 11. Error conditions

Processors MUST handle the following error conditions. The spec does not mandate a specific error-reporting mechanism (e.g. exceptions, error codes, log messages), but processors MUST NOT silently produce incorrect output.

| Condition | Required behavior |
|-----------|------------------|
| No `rows`, `cells`, or `fill` present | MUST reject the document as invalid. |
| `fill` references a template row that does not exist in the grid | MUST report an error for that fill operation. Other fill operations and cells are unaffected. |
| `fill` references a template column with no cells in the grid | MUST report an error for that fill operation. |
| `fill` references a template cell (`from`) that is blank | MAY treat as valid (fill blank to the target range) or MAY warn. |
| `cells` key is not a valid A1 address | MUST ignore the key or report an error. MUST NOT crash. |
| `from` > `to` in block fill (e.g. `from: C4`, `to: A1`) | MUST treat as valid; the rectangle is normalized (swap corners). |
| Formula evaluation error (e.g. `#DIV/0!`) | Implementation-defined; processors MAY display error values. |
| Circular reference in formulas | Implementation-defined. Processors MAY report an error, limit iterations, or display an error value. |

---

## 12. Conformance

- **Valid sheet:** A YAML document that, when parsed, yields a root mapping that satisfies §1.1 and §2–§8 (required keys, types, fill, resolution, and used range rules).
- **Processor:** A tool that reads a valid sheet and produces FORMULAS view and/or VALUES view (e.g. ASCII grid, HTML, or internal grid). A conforming processor MUST:
  - Execute the processing pipeline in the order defined in §1.2.
  - Support `rows`, `cells`, and `fill` (all four fill kinds).
  - Support the A1-keyed form of `values`.
  - Support the `version` key and apply compatibility rules (§1.3).
  - Handle error conditions per §11.
  - Clamp boundary violations per §4.5.
- A conforming processor MAY additionally support the array form of `values` and any `meta` keys.

---

## 13. Examples (normative illustration)

Every example below is labeled with **Example** (or **Example (…)**) so that all spec examples can be found easily (e.g. by searching for "Example") and extracted into standalone `.yaml` files for testing or authoring.

### 13.1 Minimal (rows only)

**Example (minimal, rows only):**

```yaml
version: "0.0.2"
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
```

Used range: A1:C2. All cells from rows; no cells block. The `version` key identifies the spec version for processors.

### 13.2 Sparse (cells only)

**Example (sparse, cells only):**

```yaml
rows: []
cells:
  A1: "Title"
  B1: "Value"
  A2: "=RANDBETWEEN(1,100)"
  B2: "=A2"
```

Used range: A1:B2. Resolution: only `cells` contribute.

### 13.3 Hybrid (rows + cells override)

**Example (hybrid, rows + cells override):**

```yaml
rows:
  - ["Name", "Score"]
  - ["Alice", "=B2"]
  - ["Bob", "85"]
cells:
  B2: "=RANDBETWEEN(0,100)"
  D1: "Note"
```

B2 is overridden by `cells`. D1 extends the used range to column D. Row 3 has no D cell in rows; C3 is "85", D3 is blank (no override).

### 13.4 Values override

**Example (values override):**

```yaml
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
values:
  A2: 4
  B2: 2
  C2: 6
```

FORMULAS view: formulas in row 2. VALUES view: 4, 2, 6 in row 2 when `values` is applied.

### 13.5 Fill (row fill down)

**Example (fill, row fill down):**

```yaml
version: "0.0.2"
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
fill:
  - row: 2
    down: 8
```

Row 2 is the template; fill replicates it to rows 3–10 with row references adjusted (e.g. row 3 gets `=A3+B3` in C3, row 4 gets `=A4+B4`, etc.). Used range: A1:C10. Without `fill`, the YAML would need 9 more row entries; with `fill`, one template row plus a short directive keeps the file small and readable.

### 13.6 Fill (cell fill down with relative refs)

**Example (fill, cell fill down with relative refs):**

```yaml
version: "0.0.2"
cells:
  A1: "Score"
  A2: "=A1+1"
fill:
  - from: A2
    down: 5
```

Cell A2 is the template (`=A1+1`); fill generates A3–A7 with the row reference adjusted: A3 gets `=A2+1`, A4 gets `=A3+1`, A5 gets `=A4+1`, etc. Used range: A1:A7.

### 13.7 Block fill (range + value)

**Example (fill, block fill):**

```yaml
version: "0.0.2"
rows: []
fill:
  - range: A1:C4
    value: "=RANDBETWEEN(1,6)"
```

Every cell in A1:C4 gets the same formula; no template, no reference adjustment. Used range: A1:C4. This is the most concise way to express "same formula in every cell of a rectangle."

### 13.8 Cell fill (down + right)

**Example (fill, cell fill down + right):**

```yaml
version: "0.0.2"
rows:
  - ["Score"]
cells:
  A2: "=A1+1"
fill:
  - from: A2
    down: 2
    right: 2
```

Template cell A2 (`=A1+1`); block is A2:C4 (3 rows, 3 columns). A3 gets `=A2+1`, A4 gets `=A3+1`. B2 gets `=B1+1`, B3 gets `=B2+1`, B4 gets `=B3+1`. C2 gets `=C1+1`, etc.

### 13.9 Fill up (with boundary clamping)

**Example (fill, cell fill up with clamping):**

```yaml
version: "0.0.2"
cells:
  A5: "=A4*2"
fill:
  - from: A5
    up: 3
```

Template A5 (`=A4*2`). Fill produces A4 (`=A3*2`), A3 (`=A2*2`), A2 (`=A1*2`). Row 1 is not reached because `up: 3` from row 5 stops at row 2. If `up: 5` were specified, A1 would get `=A0*2` (invalid ref — implementation-defined) and rows 0 and −1 would be discarded per §4.5.

### 13.10 Column fill left

**Example (fill, column fill left):**

```yaml
version: "0.0.2"
rows:
  - [null, null, "=C1+1"]
  - [null, null, "=C2+1"]
cells:
  C1: "100"
fill:
  - col: C
    left: 2
```

Template column C (C1: `100`, C2: `=C2+1`). Replicating left 2 columns: B gets B1: `100`, B2: `=B2+1`; A gets A1: `100`, A2: `=A2+1`. Column references adjust leftward.
