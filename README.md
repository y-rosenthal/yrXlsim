# yrXlsim

**yrXlsim** is a declarative, YAML-based spreadsheet format and tooling for authoring “Excel-like” sheets in plain text. Define cells, formulas, and fill operations in a single YAML file; render them as **Formulas** and **Values** views in HTML (e.g. in Quarto books) or—in the planned CLI—as ASCII-art grids for the terminal and documentation.

Use it when writing books, tutorials, or docs: keep spreadsheets in version control, edit in any text editor, and get consistent, reproducible output with full Excel-style formula evaluation (including modern functions like `IFS`, `XLOOKUP`, `RANDBETWEEN`).

---

## What’s in this repo

| Item | Description |
|------|-------------|
| **YAML format** | A formal spec for the sheet format: `rows`, `cells` (A1 map), `fill` (block/row/column/cell expand), `values` overrides, and `meta`. |
| **HTML/Quarto renderer** | JavaScript that parses YAML in `.yrxlsim` code blocks, expands fill, resolves the grid, and renders Formulas + Values in the browser (using [HyperFormula](https://hyperformula.handsontable.com/) for evaluation). |
| **Sample Quarto book** | `quarto-book/` — a minimal book that embeds yrXlsim YAML and shows the live tables. |
| **Examples** | `Examples/` — 25+ example YAML files covering every feature of the spec. |
| **Docs** | Spec, user guide, format design, and PRD for the (planned) ASCII CLI. |

---

## Quick example

Minimal sheet in YAML:

```yaml
version: "0.0.1"
rows:
  - ["Label", "Data"]
  - ["X", "=A2"]
```

- **Rows**: Row 1 has two literals; row 2 has literal `"X"` in A2 and formula `=A2` in B2.
- **Views**: **Formulas** shows the formula text; **Values** shows the evaluated result (B2 shows the same as A2).

In a Quarto document, use a fenced code block with the `yrxlsim` class so the JavaScript renderer turns it into a table:

````markdown
```{.yrxlsim}
version: "0.0.1"
rows:
  - ["Label", "Data"]
  - ["X", "=A2"]
```
````

---

## The YAML format at a glance

- **`rows`** — Array of rows; each row is an array of cell values (formulas start with `=`, otherwise literals; `null` or `""` = blank). Row order is significant (row 1, 2, …).
- **`cells`** — Optional A1-keyed map (e.g. `A1: "Title"`, `B2: "=A2"`). Overrides and extends `rows`; good for sparse sheets or patching single cells.
- **`fill`** — Optional list of expand operations applied **first**:
  - **Block fill**: same value in a range (`range: A1:C4`, `value: "=RANDBETWEEN(1,6)"`).
  - **Row fill**: copy a row down/up/right/left with relative refs adjusted (`row: 2`, `down: 8`).
  - **Column fill**: copy a column right/left/down/up with refs adjusted.
  - **Cell fill**: copy one cell to a rectangle with refs adjusted (`from: A1`, `down: 3`, `right: 2`).
- **`values`** — Optional override of **evaluated** results (for reproducible Values view, e.g. freezing `RANDBETWEEN`).
- **`meta`** — Optional hints (e.g. `seed`, `cols`, `defaultColWidth`).
- **`version`** — Optional spec version (e.g. `"0.0.1"`).

At least one of `rows`, `cells`, or `fill` must be present and supply at least one cell. Processing order: **fill** → then **resolution** (cells override rows) → **used range**. Full rules: [YAML-SPEC.md](YAML-SPEC.md).

---

## How to use

### In a Quarto (HTML) book

1. **Include the renderer** in your Quarto project:
   - Copy (or link) `quarto-book/resources/` (e.g. `yrxlsim.js`, `yrxlsim.css`, and a header that loads dependencies).
   - In your `_quarto.yml`, add something like:
     ```yaml
     format:
       html:
         include-in-header: resources/header.html
         css: resources/yrxlsim.css
         scripts: resources/yrxlsim.js
     ```
   - Your header must load **js-yaml** and **HyperFormula** before `yrxlsim.js` (see `quarto-book/resources/header.html` for a CDN example).

2. **Embed sheets** in any `.qmd` with a code block using the `yrxlsim` class:
   ````markdown
   ```{.yrxlsim}
   version: "0.0.1"
   rows:
     - ["Col A", "Col B"]
     - ["=A2+1", "=B2*2"]
   ```
   ````
   On render, the script finds all `code.yrxlsim` blocks, parses the YAML, builds the grid (including fill), and renders Formulas and Values tables.

3. **Build the book**: e.g. `quarto render` or **Build → Render Book** in RStudio. Open the generated HTML in a browser to see the tables.

### Run the sample book

- From the repo root:
  ```bash
  cd quarto-book && quarto render
  ```
- Open `quarto-book/_book/index.html` in a browser. The sample book uses the same resources and shows many examples from the spec.

### (Planned) Command-line ASCII renderer

The [PRD](PRD.md) and [plan](plan.md) describe a **Python CLI** (`xlsim`) that would read the same YAML and output **ASCII-art** grids (column letters, row numbers, `+`/`-`/`|` borders) with separate **FORMULAS** and **VALUES** views for use in terminals and Quarto bash chunks. That CLI is not yet implemented in this repo; the current implementation is the **JavaScript HTML renderer** used in the Quarto book.

---

## Project structure

```
yrXlsim/
├── README.md              # This file
├── YAML-SPEC.md           # Normative spec of the sheet format
├── USER-GUIDE.md          # Author-facing guide to the format
├── FORMAT-DESIGN.md       # Design rationale and schema
├── PRD.md                 # Product requirements (CLI, etc.)
├── plan.md                # Design plan for the ASCII CLI
├── Examples/              # Example YAML files (01–25)
├── quarto-book/           # Sample Quarto book
│   ├── _quarto.yml
│   ├── index.qmd
│   ├── yrxlsim.qmd        # Spec-based examples
│   └── resources/
│       ├── header.html    # Loads js-yaml, HyperFormula, yrxlsim.js
│       ├── yrxlsim.css
│       └── yrxlsim.js     # Parser, fill, resolution, HTML renderer
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [YAML-SPEC.md](YAML-SPEC.md) | Full normative specification (structure, rows, cells, fill, values, meta, resolution, used range). |
| [USER-GUIDE.md](USER-GUIDE.md) | How to author sheets: rows vs cells, cell values, fill types, values overrides, meta, YAML tips. |
| [FORMAT-DESIGN.md](FORMAT-DESIGN.md) | Design goals, schema overview, sparsity and used range. |
| [PRD.md](PRD.md) | Product requirements for the tool (output style, formula engine, CLI commands, Quarto integration). |
| [plan.md](plan.md) | Tech stack and design plan for the ASCII CLI. |

---

## Examples

The `Examples/` folder contains YAML files that match the spec and the sample book:

- **01–04**: Document structure, cell types, blanks, sparse cells.
- **05–11**: Fill: block (range, from/to), row fill down, row fill toRow/toCol, column fill right, cell fill down/right, cell fill to.
- **12–16**: Resolution, used range, values (A1 and array), meta, quoted/multiline keys.
- **17–25**: Rows-only, cells-only, hybrid, values override, combined fill patterns.

Use them as reference or as input to a future processor.

---

## Dependencies (HTML renderer)

- **Quarto** — to render the book (or any Quarto HTML project that embeds yrXlsim).
- **In the built HTML** (loaded via your header):
  - [js-yaml](https://github.com/nodeca/js-yaml) — parse YAML in the browser.
  - [HyperFormula](https://hyperformula.handsontable.com/) — evaluate Excel-style formulas for the Values view.

No R or Python packages are required for the current JavaScript-based rendering.

---

## Spec version

The format version in the spec is **0.0.1**. Documents can set `version: "0.0.1"` (or omit it; processors assume the latest they support). See [YAML-SPEC.md](YAML-SPEC.md) for version semantics.

---

## License

See the repository for license information, if present.
