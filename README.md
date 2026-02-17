# yrXlsim

**yrXlsim** is a declarative, YAML-based spreadsheet format with **one shared JavaScript core** used in two ways:

1. **Quarto (HTML)** — In-browser rendering of `.yrxlsim` code blocks into **Formulas** and **Values** tables.
2. **Bash/CLI (Node)** — Command-line rendering to **(a)** ASCII-art grids for the terminal and **(b)** standalone HTML files with bundled CSS.

Define cells, formulas, and fill in a single YAML file; render in the browser (Quarto) or from the CLI. Same parsing, fill, resolution, and formula evaluation (HyperFormula) everywhere. Use it for books, tutorials, or docs: version-control-friendly YAML and full Excel-style functions (`IFS`, `XLOOKUP`, `RANDBETWEEN`, etc.).

---

## What’s in this repo

| Item | Description |
|------|-------------|
| **Shared core** | `quarto-book/resources/yrxlsim.js` — single source of truth for Quarto (browser) and CLI (Node): parse YAML, expand fill, resolve grid, HyperFormula evaluation, `renderToHtml` and `renderToAscii`. |
| **YAML format** | Formal spec: `rows`, `cells` (A1 map), `fill` (block/row/column/cell expand), `values` overrides, `meta`. |
| **Quarto** | Same core in `quarto-book/resources/yrxlsim.js`; parses `.yrxlsim` code blocks and renders Formulas + Values in the browser. |
| **CLI** | `bin/yrxlsim` / `bin/yrxlsim.js` — render YAML to ASCII (terminal) or standalone HTML with bundled CSS. |
| **Sample Quarto book** | `quarto-book/` — minimal book with embedded yrXlsim blocks. |
| **Examples** | `Examples/` — 29 example YAML files. |
| **Docs** | YAML-SPEC, USER-GUIDE, FORMAT-DESIGN, PRD, plan. |

---

## Quick example

Minimal sheet in YAML:

```yaml
version: "0.0.2"
rows:
  - ["Label", "Data"]
  - ["X", "=A2"]
```

- **Rows**: Row 1 has two literals; row 2 has literal `"X"` in A2 and formula `=A2` in B2.
- **Views**: **Formulas** shows the formula text; **Values** shows the evaluated result (B2 shows the same as A2).

In a Quarto document, use a fenced code block with the `yrxlsim` class so the JavaScript renderer turns it into a table:

````markdown
```{.yrxlsim}
version: "0.0.2"
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
- **`version`** — Optional spec version (e.g. `"0.0.2"`).
- **`sheets`** — Optional array of sheet objects for **multiple sheets** in one file; each element has the same keys as above. If present, each sheet is rendered in order.

At least one of `rows`, `cells`, or `fill` must be present per sheet (or use `sheets`) and supply at least one cell. Processing order: **fill** → then **resolution** (cells override rows) → **used range**. Full rules: [YAML-SPEC-v0.0.2.md](YAML-SPEC-v0.0.2.md).

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
   version: "0.0.2"
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

### Command-line renderer (ASCII and HTML)

From the repo root (after `npm install`):

```bash
# ASCII to stdout (both views)
yrxlsim render Examples/01-minimal-document.yaml

# ASCII, one view only
yrxlsim render sheet.yaml --view formulas

# Standalone HTML file with bundled CSS
yrxlsim render sheet.yaml --format html -o sheet.html

# Read YAML from stdin
  cat sheet.yaml | yrxlsim render -

  # Output all example sheets as one multi-sheet YAML (then render or save):
  yrxlsim -e | yrxlsim render -
  yrxlsim --examples > examples.yaml && yrxlsim render examples.yaml
```

The CLI requires the **same** `quarto-book/resources/yrxlsim.js` core as the Quarto book. Input may be a single sheet or multiple sheets (`sheets:` array). See [PRD](PRD.md) and [plan](plan.md) for design.

---

## Project structure

```
yrXlsim/
├── README.md
├── package.json           # npm deps; scripts: build (pkg), render:ascii, render:html
├── bin/
│   ├── yrxlsim            # Bash wrapper
│   └── yrxlsim.js         # Node CLI: render --format ascii|html [--view ...] [-o file]
├── YAML-SPEC-v0.0.2.md    # Current spec (see also YAML-SPEC-v0.0.1.md)
├── USER-GUIDE.md
├── FORMAT-DESIGN.md
├── PRD.md
├── plan.md
├── Examples/              # Example YAML files (01–29)
└── quarto-book/
    ├── _quarto.yml
    ├── index.qmd
    ├── yrxlsim.qmd
    └── resources/
        ├── header.html    # Loads js-yaml, HyperFormula, yrxlsim.js
        ├── yrxlsim.css
        └── yrxlsim.js     # Single source of truth (Quarto + CLI)
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [YAML-SPEC-v0.0.2.md](YAML-SPEC-v0.0.2.md) | Full normative specification (structure, rows, cells, fill, values, meta, resolution, used range). |
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
- **26–29**: Multi-sheet, fill up with clamping, column fill left, cells override fill.

Use them as reference or as input to a future processor.

---

## Dependencies

- **Quarto** — to render the book (or any Quarto HTML project that embeds yrXlsim).
- **In the built HTML** (loaded via your header): [js-yaml](https://github.com/nodeca/js-yaml) and [HyperFormula](https://hyperformula.handsontable.com/) (e.g. from CDN) before `yrxlsim.js`.
- **CLI** — Node.js and npm: run `npm install` in the repo root; the CLI uses `js-yaml` and `hyperformula` from npm.

**Self-contained binary:** Run `npm run build` (requires [pkg](https://github.com/vercel/pkg)) to produce executables in `dist/` for Linux, macOS, and Windows. For `--format html`, place `yrxlsim.css` next to the executable (or the binary will use minimal inline styles). Edit the core only in `quarto-book/resources/yrxlsim.js`; no sync step.

---

## Spec version

The format version in the spec is **0.0.2**. Documents can set `version: "0.0.2"` (or omit it; processors assume the latest they support). See [YAML-SPEC-v0.0.2.md](YAML-SPEC-v0.0.2.md) for version semantics.

---

## License

See the repository for license information, if present.
