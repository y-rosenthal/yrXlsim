# yrXlsim Spreadsheet Format — YAML Specification

**Version:** 1.0  
**Format name:** yrXlsim sheet format (YAML)  
**File extension:** `.yaml` or `.yml`

This document is the normative specification for the YAML-based spreadsheet format used by yrXlsim. The same logical structure may be represented as JSON for interchange or HTML rendering; the rules in this spec apply to that representation as well.

---

## 1. Document structure

A valid sheet document is a single YAML mapping (object) at the root. All keys are defined by this specification; processors MUST ignore unknown keys.

### 1.1 Top-level keys

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `version` | No      | String | Spec version the document targets (e.g. `"1.0"`). Processors use it to select behavior when the spec changes. If absent, processors SHOULD assume the latest version they support. |
| `rows`    | Conditional | Array | List of rows; each row is an array of cell contents. Required unless `cells` is present and non-empty. |
| `cells`   | No      | Mapping | A1-keyed map of cell contents. Overrides and extends `rows`. |
| `fill`    | No      | Array  | List of fill (expand) operations: copy a row, column, or cell range with formula references adjusted. See §4. |
| `values`  | No      | Mapping or Array | Override evaluated values for VALUES view (reproducibility). |
| `meta`    | No      | Mapping | Optional metadata (e.g. `seed`, `cols`). |

**Constraint:** At least one of `rows`, `cells`, or `fill` MUST be present and supply at least one cell. If only `cells` is present, `rows` MAY be omitted or given as an empty array `[]`. If only `fill` is present (e.g. block fill), `rows` MAY be `[]` and `cells` MAY be absent; the used range is then derived from the fill operations.

**Processing order:** Processors MUST apply **fill expansion** (§4) first, producing an effective grid. **Resolution** (§5) and **used range** (§6) then apply to that effective grid (so `cells` override expanded content, and used range includes filled cells).

**Example (minimal document):**

```yaml
version: "1.0"
rows:
  - ["Label", "Data"]
  - ["X", "=A2"]
```

### 1.2 Version

- **Key:** `version`
- **Type:** String (e.g. `"1.0"`, `"1.1"`). Recommended format: major.minor.
- **Semantics:** Indicates which version of this spec the document targets. Processors SHOULD read this key and use it to select behavior (e.g. which features to apply, or whether to warn on unknown version). If absent, processors SHOULD assume the latest version they support. If the version is newer than the processor supports, the processor MAY warn or reject the document; if older, the processor SHOULD interpret the document according to that version’s rules when feasible.

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

**Example (cell value types in a row):**

```yaml
rows:
  - ["=A2+B2", "Total", "42", null, ""]
```
Formula, literal text, literal number-as-string, blank (null), blank (empty string).

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

- **Syntax:** One or more column letters (A–Z, then AA, AB, … AZ, BA, …) followed by a row number (1-based integer). No spaces. Case-insensitive; processors SHOULD accept `a1` and `A1` equivalently.
- **Examples:** `A1`, `B3`, `Z99`, `AA1`, `AB10`.
- **Reserved:** Range notation (e.g. `A1:B2`) is not defined in this version. Processors MUST ignore keys that contain `:` or otherwise do not match single-cell A1 syntax, or MAY treat them as an error.

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

The `fill` key allows a row, column, or cell to act as a **template** that is “dragged” to other rows, columns, or ranges without writing every cell in the YAML. Processors expand fill operations first; the result is as if the expanded content had been written in `rows` and `cells`. This keeps the YAML short and readable while expressing repeated patterns (e.g. “row 2 filled down to row 10”).

### 4.2 Type and shape

- **Key:** `fill`
- **Type:** Array of **fill operations**. Each operation is a mapping with keys that identify the template and the target. Operations are applied in order; later operations MAY overwrite cells produced by earlier ones.

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

#### 4.3.2 Row fill (fill down/up/right/left)

Copy one row’s content to other rows and/or extend the row to more columns; adjust **relative** references in formulas.

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `row`     | Yes      | Integer | 1-based row number of the template row. |
| `down`    | No       | Integer | Number of rows to fill below the template (default 0). |
| `up`      | No       | Integer | Number of rows to fill above the template (default 0). |
| `right`   | No       | Integer | Number of columns to extend the row to the right (default 0). |
| `left`    | No       | Integer | Number of columns to extend the row to the left (default 0). Only applies when the template row does not start at column A; otherwise no-op. |
| `toRow`   | No       | Integer | Alternative to `down`: last row to fill (inclusive). If present, `down` is ignored for the downward extent. |
| `toCol`   | No       | String | Alternative to `right`: last column to fill (inclusive). If present, `right` is ignored for the right extent. |

At least one of `down`, `up`, `right`, `left`, `toRow`, or `toCol` MUST be present and imply a positive extent.

**Semantics:** The template row is taken from the effective grid. Rows: fill from row `row − up` through `row + down` (or through `toRow` if given). Columns: the template row has a column extent (from the data); extend it `right` columns to the right and `left` columns to the left (left only when the template row’s first column is not A). For each target cell, apply (row_delta, col_delta) to relative refs in formulas; literals copy as-is.

**Example (row fill down):**

```yaml
rows:
  - ["ColA", "ColB"]
  - ["=A2+1", "=B2*2"]
fill:
  - row: 2
    down: 8
```
Rows 3–10 get formulas with relative refs adjusted (e.g. row 3: `=A3+1`, `=B3*2`).

**Example (row fill with toRow/toCol):**

```yaml
rows:
  - ["X", "Y"]
fill:
  - row: 1
    toRow: 4
    toCol: D
```
Template row 1 extended to rows 2–4 and columns through D.

#### 4.3.3 Column fill (fill right/left/down/up)

Copy one column’s content to other columns and/or extend the column to more rows; adjust **relative** references in formulas.

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `col`     | Yes      | String | Column letter(s) of the template column (e.g. `A`, `B`, `AA`). |
| `right`   | No       | Integer | Number of columns to fill to the right (default 0). |
| `left`    | No       | Integer | Number of columns to fill to the left (default 0). Column A has no left; otherwise fill the template column’s pattern left. |
| `down`    | No       | Integer | Number of rows to extend the column downward (default 0). |
| `up`      | No       | Integer | Number of rows to extend the column upward (default 0). |
| `toCol`   | No       | String | Alternative to `right`: last column to fill (inclusive). |
| `toRow`   | No       | Integer | Alternative to `down`: last row to fill (inclusive). |

At least one of `right`, `left`, `down`, `up`, `toCol`, or `toRow` MUST be present and imply a positive extent.

**Example (column fill right):**

```yaml
rows:
  - ["=A1", "=B1", "=C1"]
cells:
  A1: "Header"
fill:
  - col: A
    right: 2
    down: 3
```
Column A pattern (Header + formula) filled to B, C and down 3 rows; refs adjust.

**Semantics:** The template column is taken from the effective grid. Fill the template column’s pattern to the right/left and extend down/up; for each target cell, apply (row_delta, col_delta) to relative refs in formulas.

#### 4.3.4 Cell fill (fill down/up/right/left from one cell)

Copy one cell’s content to a rectangle; adjust references in formulas. Any combination of `down`, `up`, `right`, `left` defines the block.

| Key       | Required | Type   | Description |
|-----------|----------|--------|--------------|
| `from`    | Yes      | String | A1-style address of the template cell (e.g. `A1`, `C4`). |
| `down`    | No       | Integer | Number of rows to fill below the template (default 0). |
| `up`      | No       | Integer | Number of rows to fill above the template (default 0). |
| `right`   | No       | Integer | Number of columns to fill to the right (default 0). |
| `left`    | No       | Integer | Number of columns to fill to the left (default 0). |
| `to`      | No       | String | Alternative: bottom-right cell of the block (inclusive). If present, the block is from `from` to `to`; `down`/`up`/`right`/`left` are ignored. |

At least one of `down`, `up`, `right`, `left`, or `to` MUST be present. If `to` is used, the block is the rectangle from `from` to `to` (inclusive).

**Semantics:** The block is rows `(template_row − up)` through `(template_row + down)`, columns `(template_col − left)` through `(template_col + right)` (column indices). The template cell is included. For each target cell, set content from the template; for **formulas**, add (target_row − template_row) to relative row refs and (target_col − template_col) to relative column refs (negative for up/left). For **literals**, copy as-is.

**Example (cell fill down + right):**

```yaml
cells:
  A1: "=A1+1"
fill:
  - from: A1
    down: 3
    right: 2
```
Block A1:C4; e.g. B2 gets `=B2+1`, C4 gets `=C4+1` (relative refs adjust).

**Example (cell fill with to):**

```yaml
cells:
  C4: "=C4*2"
fill:
  - from: C4
    to: B2
```
Block B2:C4; template C4; B2, B3, B4, C2, C3 get formula with refs adjusted (up/left).

### 4.4 Reference adjustment rules

These rules apply to row fill, column fill, and cell fill. **Block fill** (§4.3.1) does not adjust references; every cell gets the same `value` string.

- **Relative reference:** Unanchored row or column (e.g. `A1`, `B2`). When filling **down** or **up**, add (target_row − template_row) to the row number of relative row refs (negative when filling up). When filling **right** or **left**, add (target_col − template_col) to the column part of relative column refs (negative when filling left).
- **Absolute reference:** `$A$1` — neither row nor column changes.
- **Mixed reference:** `$A1` (absolute column) — when filling down/up, row adjusts; when filling right/left, column does not. `A$1` (absolute row) — when filling down/up, row does not; when filling right/left, column adjusts.

Processors MUST parse formulas and adjust only the relative parts of cell references; literal text and function names are unchanged.

### 4.5 Interaction with rows and cells

- Fill uses the **effective** content of the template at expansion time. The template row/column/cell comes from `rows` and `cells` (resolution §5) **before** fill is applied. So if a cell is overridden in `cells`, the override is what gets filled. Block fill has no template; it uses only the `value` key.
- Cells produced by fill are treated as if they had been written in `rows` (for row/column fill) or `cells` (for cell fill and block fill). Resolution and used range then apply; thus `cells` overrides can still override filled-in cells if they appear later in the document or in the `cells` map.
- If multiple fill operations write to the same cell, the last operation wins.

---

## 5. Resolution: rows vs cells

For any cell address (row R, column C):

1. If `cells` is present and contains a key for that address (e.g. `A1`), the value for the cell is the value from `cells`.
2. Otherwise, if the effective `rows` (including any cells produced by fill) have a row at index R−1 (1-based R) and that row has an element at index C (0-based), the value for the cell is that element.
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

The **used range** is the smallest rectangle that contains every cell that either:

- Has a value (non-blank) in the effective grid after fill expansion (§4), i.e. in `rows`, `cells`, or cells produced by `fill`, or
- Is referenced by a formula in any cell (implementation may defer this).

**Computation:** Apply after fill expansion. Compute over the effective rows and `cells`:

- **From rows:** Let `maxRow = rows.length` (number of rows). Let `maxCol = 0`; for each row in the effective rows, set `maxCol = max(maxCol, row.length)` (number of columns in that row).
- **From cells:** For each key in `cells` that is a valid single-cell A1 address, parse row and column; set `maxRow = max(maxRow, parsedRow)` and `maxCol = max(maxCol, parsedCol)` (column as 0-based index).
- **Used range:** From cell `A1` to the cell at row `maxRow` and column index `maxCol` (convert to letter: 0→A, 1→B, …, 26→AA, etc.).

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
  - **Array of rows:** Same shape as `rows`; each element is the evaluated value for that cell. Processors that support this form use it to fill VALUES view by position; any cell not covered may fall back to evaluated formula or be blank.

This spec does not require processors to support both forms; at least the A1-keyed form MUST be supported.

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

**Example (values — array of rows, when supported):**

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
- `defaultColWidth`: integer; hint for column width in character or pixels.

Processors MUST ignore unknown `meta` keys.

**Example (meta with suggested keys):**

```yaml
version: "1.0"
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

## 9. YAML-specific rules

### 9.1 Encoding

Files SHOULD be UTF-8. Processors MAY accept other encodings; behavior is implementation-defined.

### 9.2 Key quoting

YAML allows unquoted keys for addresses that are alphanumeric (e.g. `A1`, `B2`). Keys that could be parsed as numbers (e.g. `1` alone) must not be used as cell addresses per A1 syntax. Quoted keys (e.g. `"A1": "x"`) are valid and equivalent.

### 9.3 Multiline formulas

Cell values that contain newlines (e.g. long formulas) MAY use YAML multiline scalars. The logical value MUST be a single string; the formula engine receives the string with newlines preserved or collapsed per YAML rules. Processors MUST treat a value as a formula only if, after parsing, it starts with `=`.

### 9.4 Comments

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

## 10. Conformance

- **Valid sheet:** A YAML document that, when parsed, yields a root mapping that satisfies §1.1 and §2–§8 (required keys, types, fill, resolution, and used range rules).
- **Processor:** A tool that reads a valid sheet and produces FORMULAS view and/or VALUES view (e.g. ASCII grid, HTML, or internal grid). A conforming processor MUST apply fill expansion (§4), resolution (§5), and used range (§6) as specified; MUST support `rows`, `cells`, and `fill`; MUST support the A1-keyed form of `values`; MUST support the `version` key (if present) and use it to select spec behavior when applicable. Processors MAY support the array form of `values` and any `meta` keys.

---

## 11. Examples (normative illustration)

Every example below is labeled with **Example** (or **Example (…)**) so that all spec examples can be found easily (e.g. by searching for "Example") and extracted into standalone `.yaml` files for testing or authoring.

### 11.1 Minimal (rows only)

**Example (minimal, rows only):**

```yaml
version: "1.0"
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
```

Used range: A1:C2. All cells from rows; no cells block. The `version` key identifies the spec version for processors.

### 11.2 Sparse (cells only)

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

### 11.3 Hybrid (rows + cells override)

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

### 11.4 Values override

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

### 11.5 Fill (row fill down)

**Example (fill, row fill down):**

```yaml
version: "1.0"
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
fill:
  - row: 2
    down: 8
```

Row 2 is the template; fill generates rows 3–10 with formulas adjusted (e.g. row 3 gets `=A3+B3` in C3, row 4 gets `=A4+B4`, etc.). Used range: A1:C10. Without `fill`, the YAML would need 9 more row entries; with `fill`, one template row plus a short directive keeps the file small and readable.

### 11.6 Fill (cell fill down)

**Example (fill, cell fill down):**

```yaml
version: "1.0"
cells:
  A1: "Score"
  A2: "=RANDBETWEEN(1,100)"
fill:
  - from: A2
    down: 5
```

Cell A2 is the template; fill generates A3–A7 with the formula adjusted (e.g. A3 gets `=RANDBETWEEN(1,100)` as a new evaluation; the formula text is the same for RANDBETWEEN, but for a formula like `=A1+1`, A3 would get `=A2+1`, A4 would get `=A3+1`, etc.). Used range: A1:A7.

### 11.7 Block fill (range + value)

**Example (fill, block fill):**

```yaml
version: "1.0"
rows: []
fill:
  - range: A1:C4
    value: "=RANDBETWEEN(1,6)"
```

Every cell in A1:C4 gets the same formula; no template, no reference adjustment. Used range: A1:C4. This is the most concise way to express “same formula in every cell of a rectangle.”

### 11.8 Cell fill (down + right)

**Example (fill, cell fill down + right):**

```yaml
version: "1.0"
cells:
  A1: "=RANDBETWEEN(1,6)"
fill:
  - from: A1
    down: 3
    right: 2
```

Template cell A1; block is A1:C4 (4 rows, 3 columns). Same formula in every cell when the formula has no relative refs; otherwise refs adjust per cell (e.g. `=A1+1` in A1 would become `=A2+1` in A2, `=B1+1` in B1, etc.).
