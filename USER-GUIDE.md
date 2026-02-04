# yrXlsim Sheet Format — User Guide

This guide explains how to create and edit spreadsheet documents in the **yrXlsim YAML format** (`.yaml` or `.yml`). It’s written for authors and editors; for the full technical rules, see [YAML-SPEC.md](YAML-SPEC.md).

---

## What is this format?

A yrXlsim sheet file is a single YAML document that describes:

- **Cells** — text, numbers, or formulas
- **Fill** — “drag” a row, column, or cell to repeat it (with formulas adjusted)
- **Values** — optional frozen results for reproducible output
- **Meta** — optional hints like seed and column width

You can use **rows** (array of rows), **cells** (A1-style map), or both. Fill runs first; then `cells` can override anything. The result is a grid you can view as **formulas** or as **evaluated values**.

---

## Quick start

Smallest useful example:

```yaml
version: "0.0.1"
rows:
  - ["Label", "Data"]
  - ["X", "=A2"]
```

- Row 1: two literals.
- Row 2: literal `"X"` in A2, formula `=A2` in B2 (so B2 shows the same as A2).

You need at least one of: `rows`, `cells`, or `fill`, and they must supply at least one cell.

---

## Defining the grid

### Option 1: Rows

`rows` is a list of rows. Row 1 is the first element, row 2 the second, and so on. Each row is a list of cell values, left to right (column A, B, C, …).

```yaml
rows:
  - ["Name", "Score", "Grade"]
  - ["Alice", 90, "A"]
  - ["Bob", 85, "B"]
```

- You can use fewer cells in one row than in another; missing cells at the end are blank.
- Use `""` or `null` for a blank in the middle or start of a row: `["A", "", "C"]` leaves B blank.

### Option 2: Cells (A1 map)

`cells` is a map from **A1-style addresses** to values. Good for sparse sheets or when you want to override specific cells without touching `rows`.

```yaml
rows: []
cells:
  A1: "Title"
  B2: "=A1"
  C3: null
```

- Addresses: `A1`, `B3`, `Z99`, `AA1`, etc. (letters + 1-based row). Case doesn’t matter.
- Only list the cells you care about; the rest are blank.
- You can combine with `rows`: put the main content in `rows` and use `cells` for overrides or extra cells (e.g. `D1: "Note"`).

### Option 3: Rows + cells

If both are present, **cells override rows** for any address that appears in `cells`. So you can define the bulk in `rows` and patch or extend with `cells`.

```yaml
rows:
  - ["Name", "Score"]
  - ["Alice", "=B2"]
cells:
  B2: "=RANDBETWEEN(0,100)"
  D1: "Note"
```

Here B2 comes from `cells` (not from `rows`), and D1 extends the grid.

---

## Cell values

In both `rows` and `cells`:

| You write | Meaning |
|-----------|--------|
| `"=A1+B1"` | **Formula** (starts with `=`) |
| `"Total"`, `"42"` | **Literal** (text or number as string) |
| `null` or `""` | **Blank** |

Numbers and booleans are allowed and treated as literals (e.g. `42` is like `"42"`). No need to quote numbers unless you want them as text.

---

## Fill (expand)

Fill lets you repeat a row, column, or cell (or fill a block with one value) so you don’t type every cell. The processor expands fill **first**; then resolution and used range apply. So you get a grid as if you had written all the filled cells.

### Block fill — same value in a rectangle

Use when every cell in a range should get the **exact same** formula or literal. No reference adjustment.

```yaml
rows: []
fill:
  - range: A1:C4
    value: "=RANDBETWEEN(1,6)"
```

Or with `from` and `to`:

```yaml
fill:
  - from: A1
    to: C4
    value: "=RANDBETWEEN(1,6)"
```

All 12 cells get that formula.

### Row fill — copy a row down/up or extend right/left

Takes one row as a template and fills other rows (and optionally more columns). **Relative** references in formulas are adjusted (e.g. `A2` becomes `A3` one row down).

```yaml
rows:
  - ["ColA", "ColB"]
  - ["=A2+1", "=B2*2"]
fill:
  - row: 2
    down: 8
```

Rows 3–10 get the same pattern with row refs adjusted (e.g. row 3: `=A3+1`, `=B3*2`).

You can use **toRow** and **toCol** instead of counts:

```yaml
fill:
  - row: 1
    toRow: 4
    toCol: D
```

Template row 1 is extended to rows 2–4 and out to column D.

### Column fill — copy a column right/left or extend down/up

Same idea as row fill, but the template is one column. Refs adjust when you fill right/left or down/up.

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

Column A’s pattern is filled to B and C and down 3 rows; relative refs are adjusted.

### Cell fill — copy one cell to a block

Template is a single cell. You specify how far to fill down, up, right, and/or left. Formulas are adjusted by (row delta, column delta).

```yaml
cells:
  A1: "=A1+1"
fill:
  - from: A1
    down: 3
    right: 2
```

Block A1:C4; e.g. B2 gets `=B2+1`, C4 gets `=C4+1`.

Using **to** for the bottom-right corner:

```yaml
cells:
  C4: "=C4*2"
fill:
  - from: C4
    to: B2
```

Fills the rectangle from C4 back to B2 (B2:B4, C2:C4) with the formula adjusted in each cell.

### Reference rules when filling

- **Relative** (e.g. `A1`, `B2`): row/column change with the fill direction.
- **Absolute** (`$A$1`): unchanged everywhere.
- **Mixed** (`$A1`, `A$1`): only the non-$ part adjusts.

Block fill does **not** adjust refs; every cell gets the same string.

---

## Values (reproducible output)

The **values** key overrides the **evaluated** result for the VALUES view only. Use it to freeze volatile results (e.g. `RANDBETWEEN`) so output is reproducible. The FORMULAS view always shows what’s in `rows`/`cells`.

**A1-keyed form** (always supported):

```yaml
rows:
  - ["=RANDBETWEEN(1,6)"]
values:
  A1: 4
```

- FORMULAS view: `=RANDBETWEEN(1,6)`
- VALUES view: `4`

**Array-of-rows form** (if the processor supports it): same shape as `rows`; each entry is the value to show for that cell in VALUES view.

---

## Meta (optional hints)

`meta` is a free-form map. The spec doesn’t require any keys; processors ignore unknown ones. Common uses:

- **seed** — e.g. integer or string to seed the formula engine for reproducible randoms.
- **cols** — hint for minimum or fixed column count.
- **defaultColWidth** — hint for column width.

```yaml
meta:
  seed: 42
  cols: 5
  defaultColWidth: 12
```

---

## Version

Set **version** (e.g. `"0.0.1"`) so processors know which spec rules to use. If you omit it, they typically assume the latest version they support.

---

## YAML tips

- **Encoding:** Use UTF-8.
- **Addresses as keys:** `A1` and `"A1"` are both fine. Use quotes if it helps readability.
- **Long formulas:** You can use YAML multiline; the value is still one string and is a formula only if it starts with `=` after parsing.
- **Comments:** Use `#`; processors ignore them.

---

## Summary

| Goal | Use |
|------|-----|
| Simple table | `rows` with arrays of cell values |
| Sparse or patch cells | `cells` (A1 map) alone or with `rows` |
| Same value in a rectangle | `fill` with `range` (or `from`/`to`) and `value` |
| Repeat a row with adjusted formulas | `fill` with `row` and `down`/`up`/`right`/`left` or `toRow`/`toCol` |
| Repeat a column | `fill` with `col` and direction keys |
| Repeat one cell to a block | `fill` with `from` and `down`/`up`/`right`/`left` or `to` |
| Freeze evaluated results | `values` (A1 map or array of rows) |
| Reproducible randoms | `meta.seed` and `values` for the cells to freeze |
| Spec version | `version: "0.0.1"` (or your target version) |

For exact rules, conformance, and all edge cases, see **YAML-SPEC.md**.
