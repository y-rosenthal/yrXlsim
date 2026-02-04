# yrXlsim Spreadsheet Format — YAML Specification

**Version:** 1.0  
**Format name:** yrXlsim sheet format (YAML)  
**File extension:** `.yaml` or `.yml`

This document is the normative specification for the YAML-based spreadsheet format used by yrXlsim. The same logical structure may be represented as JSON for interchange or HTML rendering; the rules in this spec apply to that representation as well.

---

## 1. Document structure

A valid sheet document is a single YAML mapping (object) at the root. All keys are defined by this specification; processors MUST ignore unknown keys.

### 1.1 Top-level keys

| Key      | Required | Type   | Description |
|----------|----------|--------|--------------|
| `rows`   | Conditional | Array | List of rows; each row is an array of cell contents. Required unless `cells` is present and non-empty. |
| `cells`  | No      | Mapping | A1-keyed map of cell contents. Overrides and extends `rows`. |
| `values` | No      | Mapping or Array | Override evaluated values for VALUES view (reproducibility). |
| `meta`   | No      | Mapping | Optional metadata (e.g. `seed`, `cols`). |

**Constraint:** At least one of `rows` or `cells` MUST be present. If only `cells` is present, `rows` MAY be omitted or given as an empty array `[]`.

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

### 2.3 Trailing blanks

A row MAY have fewer elements than other rows or than the number of columns in the sheet. Missing elements at the end of a row are treated as **blank**. Processors MUST NOT require trailing `""` or `null` for alignment.

### 2.4 Leading or middle blanks

To represent a blank cell before or between non-blank cells in a row, use `""` or `null` in the row array at the corresponding index.

**Example:**

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

---

## 4. Resolution: rows vs cells

For any cell address (row R, column C):

1. If `cells` is present and contains a key for that address (e.g. `A1`), the value for the cell is the value from `cells`.
2. Otherwise, if `rows` is present and has a row at index R−1 (1-based R) and that row has an element at index C (0-based), the value for the cell is that element.
3. Otherwise, the cell is **blank**.

Blank in `rows` or `cells` (empty string or null) is still a defined value: the cell is blank. Omission (no key in `cells`, or no element at that index in `rows`) also means blank. So: **cells override rows**; within either, presence of `""` or `null` means blank, and omission of trailing elements in a row means blank.

---

## 5. Used range

The **used range** is the smallest rectangle that contains every cell that either:

- Has a value (non-blank) in `rows` or `cells`, or
- Is referenced by a formula in any cell (implementation may defer this).

**Computation:**

- **From rows:** Let `maxRow = rows.length` (number of rows). Let `maxCol = 0`; for each row in `rows`, set `maxCol = max(maxCol, row.length)` (number of columns in that row).
- **From cells:** For each key in `cells` that is a valid single-cell A1 address, parse row and column; set `maxRow = max(maxRow, parsedRow)` and `maxCol = max(maxCol, parsedCol)` (column as 0-based index).
- **Used range:** From cell `A1` to the cell at row `maxRow` and column index `maxCol` (convert to letter: 0→A, 1→B, …, 26→AA, etc.).

If `rows` is empty or absent and `cells` is empty or absent, the used range is undefined; processors MAY treat the sheet as empty (no grid) or as a single blank cell at A1.

---

## 6. Values (reproducibility override)

### 6.1 Purpose

The `values` key overrides the result of formula evaluation for the VALUES view only. It is used to freeze volatile results (e.g. RANDBETWEEN) for reproducible output (e.g. in published material). FORMULAS view is unaffected and always comes from `rows` and `cells`.

### 6.2 Type and shape

- **Key:** `values`
- **Type:** Either:
  - **Mapping (A1-keyed):** Same key style as `cells`. Values are the displayed value for that cell in VALUES view (number, string, boolean, or null for blank). Processors MAY coerce to string for display.
  - **Array of rows:** Same shape as `rows`; each element is the evaluated value for that cell. Processors that support this form use it to fill VALUES view by position; any cell not covered may fall back to evaluated formula or be blank.

This spec does not require processors to support both forms; at least the A1-keyed form MUST be supported.

### 6.3 Semantics

- For VALUES view: if a cell has an entry in `values` (by address or by position in the array form), that value is used instead of evaluating the formula (or literal) from `rows`/`cells`.
- For FORMULAS view: `values` is ignored; display always comes from `rows` and `cells` (formula text or literal).

---

## 7. Meta

- **Key:** `meta`
- **Type:** Mapping. Keys and meaning are implementation-defined. This spec does not mandate any keys.

**Suggested keys (non-normative):**

- `seed`: integer or string; used to seed the formula engine for reproducible volatile functions.
- `cols`: integer; hint for minimum or fixed column count (e.g. for layout).
- `defaultColWidth`: integer; hint for column width in character or pixels.

Processors MUST ignore unknown `meta` keys.

---

## 8. YAML-specific rules

### 8.1 Encoding

Files SHOULD be UTF-8. Processors MAY accept other encodings; behavior is implementation-defined.

### 8.2 Key quoting

YAML allows unquoted keys for addresses that are alphanumeric (e.g. `A1`, `B2`). Keys that could be parsed as numbers (e.g. `1` alone) must not be used as cell addresses per A1 syntax. Quoted keys (e.g. `"A1": "x"`) are valid and equivalent.

### 8.3 Multiline formulas

Cell values that contain newlines (e.g. long formulas) MAY use YAML multiline scalars. The logical value MUST be a single string; the formula engine receives the string with newlines preserved or collapsed per YAML rules. Processors MUST treat a value as a formula only if, after parsing, it starts with `=`.

### 8.4 Comments

YAML comments (`#`) are allowed anywhere and MUST be ignored by processors.

---

## 9. Conformance

- **Valid sheet:** A YAML document that, when parsed, yields a root mapping that satisfies §1.1 and §2–§7 (required keys, types, and resolution rules).
- **Processor:** A tool that reads a valid sheet and produces FORMULAS view and/or VALUES view (e.g. ASCII grid, HTML, or internal grid). A conforming processor MUST apply resolution (§4) and used range (§5) as specified; MUST support `rows` and `cells` and the A1-keyed form of `values`; MAY support the array form of `values` and any `meta` keys.

---

## 10. Examples (normative illustration)

### 10.1 Minimal (rows only)

```yaml
rows:
  - ["first die", "second die", "Total"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
```

Used range: A1:C2. All cells from rows; no cells block.

### 10.2 Sparse (cells only)

```yaml
rows: []
cells:
  A1: "Title"
  B1: "Value"
  A2: "=RANDBETWEEN(1,100)"
  B2: "=A2"
```

Used range: A1:B2. Resolution: only `cells` contribute.

### 10.3 Hybrid (rows + cells override)

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

### 10.4 Values override

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
