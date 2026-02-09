---
name: Excel ASCII Sim CLI
overview: "yrXlsim uses one shared JavaScript core (quarto-book/resources/yrxlsim.js) for (1) Quarto in-browser rendering of .yrxlsim code blocks and (2) a Node/Bash CLI that renders YAML to ASCII (terminal) or standalone HTML. Same parsing, fill, resolution, and HyperFormula evaluation everywhere. A self-contained binary can be built with pkg."
todos: []
isProject: false
---

# Excel ASCII Sim CLI (yrXlsim) – Design Plan

## Goal

**One shared JavaScript codebase** for:

1. **Quarto (HTML)** — In-browser rendering of `.yrxlsim` code blocks into Formulas and Values tables (existing behavior).
2. **Bash/CLI (Node)** — Render the same YAML to **(a)** ASCII-art grids (column letters, row numbers, `+`/`-`/`|` borders; FORMULAS and VALUES views) and **(b)** standalone HTML files with bundled CSS for viewing outside Quarto.

You create or edit spreadsheets in human-editable YAML and can render them in the browser (Quarto) or from the command line (ASCII or HTML).

---

## 1. Tech stack (current)

**One JavaScript core** used in two environments:

| Criterion          | Implementation                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **Shared core**    | `quarto-book/resources/yrxlsim.js`: parse YAML, expand fill, resolve grid, HyperFormula for values, renderToHtml + renderToAscii. |
| **Quarto**         | Same file (as `quarto-book/resources/yrxlsim.js`) runs in the browser; replaces `.yrxlsim` code blocks with HTML. |
| **CLI**            | Node.js: `bin/yrxlsim.js` sets global `jsyaml` and `HyperFormula`, requires the core; outputs ASCII or writes standalone HTML. |
| **Bash-friendly**  | Invoke as `yrxlsim render sheet.yaml` or `node bin/yrxlsim.js render sheet.yaml`; ASCII to stdout by default. |
| **Cross-platform** | Node runs on Windows, macOS, Linux; Quarto unchanged.                                             |

**Delivery**: Single source of truth: `quarto-book/resources/yrxlsim.js`. CLI: `npm install` then `yrxlsim render <file> [--format ascii|html] [--view formulas|values|both] [-o path]`. Self-contained binary: `npm run build` (pkg) → executables in `dist/`.

---

## 2. Target output style (match your webpage)

The tool should produce ASCII that matches the style already used in your HTML, for example:

- **Row labels**: First column is row numbers (1, 2, 3 …).
- **Column labels**: One line with column letters (A, B, C …).
- **Grid**: Lines built from `+`, `-`, and `|`; cell content padded to fixed width so columns align.
- **Two views**: Same grid structure, but:
  - **FORMULAS VIEW**: Cell content is formula text (e.g. `=RANDBETWEEN(1,6)`, `=A2+B2`).
  - **VALUES VIEW**: Cell content is the evaluated value (e.g. `2`, `5`, `7`).

So the CLI must support "render formulas" and "render values" (and optionally "both" for two blocks in one run).

---

## 3. Functionality design

### 3.1 Defining a spreadsheet (input format)

Use a **declarative, file-based** format so that:

- Sheets are easy to **create** (template or by hand).
- Sheets are easy to **modify** (edit the file; re-run the tool).
- Content is **version-control friendly** (plain text).

**Recommended: YAML**

- One file per "workbook" or "sheet" (e.g. `dice.yaml`, `rand-between.yaml`).
- Structure: list of rows; each row is a list of cell contents. Optionally support a **cell map** (e.g. `A1: "first die"`, `B2: "=RANDBETWEEN(1,6)"`) for sparse sheets or clarity.
- Example (row-based, dense):

```yaml
# dice.yaml
rows:
  - ["first die", "second die", "Total on both dice"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A2+B2"]
  - ["=RANDBETWEEN(1,6)", "=RANDBETWEEN(1,6)", "=A3+B3"]
  # ...
```

- **Optional**: Allow a `values` block (or a separate file) to **freeze** VALUES view to specific numbers so the book output is reproducible without implementing a full formula engine.

**Alternative**: A simple **CSV-like** format (e.g. one line per row, commas/tabs, formula or value per cell). Easier to parse without dependencies but less flexible for multi-line or complex content.

### 3.2 Formula handling (VALUES view)

Use a **full Excel formula engine** so the tool can evaluate **any** classic and modern Excel functions—not just a small subset.

**Recommended engine: Python [formulas](https://formulas.readthedocs.io/) (vinci1it2000)**

- Actively maintained (1.3.3, Python 3.6–3.13).
- Supports a broad set of Excel functions, including:
  - **Modern:** IFS, SWITCH, XLOOKUP, XMATCH, FILTER, UNIQUE, SORT, and other dynamic-array / lookup functions.
  - **Classic:** RANDBETWEEN, RAND, SUM, COUNTIF, COUNTIFS, SUMIF, IF, VLOOKUP, INDEX/MATCH, date/time, text, financial, statistical, etc.
- Parses and compiles formulas; can execute workbook-style calculations with cell references and dependency order.
- Install: `pip install formulas` (optional `pip install formulas[excel]` for loading real .xlsx workbooks if you ever want that).

**VALUES view**: Compute by evaluating each cell formula via the engine, using the grid's current values and dependency order. No need to hand-maintain a separate "values" grid unless you want to freeze output.

**Reproducibility (e.g. for the book):** Volatile functions (RAND, RANDBETWEEN) change each run. Options: (1) Use an optional **seed** in the tool or engine if supported, so VALUES view is reproducible; (2) Or allow an optional **values** block in the YAML to override specific cells with fixed results for publication.



**Recommendation (obsolete)**: Start with **(1)** — two sources of truth (formulas + values) in the same file or side-by-side. Add **(2)** later if you want "one source of truth" and optional randomness with seed.

### 3.3 CLI commands

| Command | Purpose |
|--------|--------|
| `yrxlsim render <file>` | Read YAML from `<file>` (or stdin if `-`), output ASCII (both views) to stdout. |
| `yrxlsim render <file> --format ascii` | ASCII grid(s); use `--view formulas\|values\|both` to choose view(s). |
| `yrxlsim render <file> --format html` | Standalone HTML file with bundled CSS and pre-rendered Formulas/Values tables. |
| `yrxlsim render <file> -o <path>` | Write output to file. |
| (Optional) `yrxlsim init [name]` | Create a sample sheet file. |

### 3.4 Quarto integration

- **In-browser:** The same core (`yrxlsim.js` in book resources) runs on page load and replaces `.yrxlsim` code blocks with Formulas and Values HTML. No change to existing Quarto usage.
- **ASCII in the book:** Use a bash chunk to run the CLI and include ASCII output:
  ````markdown
  ```{bash}
  #| echo: false
  #| output: asis
  yrxlsim render dice.yaml
  ```
  ````
- Or redirect to a file and include it. The CLI prints to stdout by default.

---

## 4. High-level architecture

- **One core** (`quarto-book/resources/yrxlsim.js`): Parse YAML → expand fill → resolve grid → formulas grid (as-is) and values grid (HyperFormula + optional `values`). Exposes `renderToHtml` and `renderToAscii`.
- **Quarto:** Core runs in browser; finds `code.yrxlsim` blocks, parses YAML, renders Formulas and Values HTML.
- **CLI:** Node loads core (after setting `global.jsyaml` and `global.HyperFormula`), reads YAML from file or stdin, then either prints `renderToAscii(doc)` or builds a standalone HTML document with `renderToHtml` output and bundled CSS.
- **ASCII renderer** (in core): Column letters, row numbers, `+`/`-`/`|` grid; FORMULAS VIEW and VALUES VIEW (one or both).

---

## 5. File layout

```
yrXlsim/
├── README.md
├── package.json        # npm deps; scripts: build (pkg), render:ascii, render:html
├── bin/
│   ├── yrxlsim         # Bash wrapper
│   └── yrxlsim.js      # Node CLI
├── quarto-book/
│   └── resources/
│       ├── header.html
│       ├── yrxlsim.css
│       └── yrxlsim.js  # Single source of truth (Quarto + CLI)
└── Examples/
    └── *.yaml
```

---

## 6. Summary of recommendations


| Topic     | Recommendation |
|----------|-----------------|
| **Core** | One JavaScript codebase (`quarto-book/resources/yrxlsim.js`) for Quarto (browser) and CLI (Node). |
| **Input** | YAML per spec: `rows`, `cells`, `fill`, `values`, `meta`. |
| **Output** | ASCII (terminal) or standalone HTML with bundled CSS; in Quarto, in-browser HTML from code blocks. |
| **Formulas** | HyperFormula in both environments; optional `meta.seed` and `values` override. |
| **CLI** | `yrxlsim render <file> [--format ascii\|html] [--view formulas\|values\|both] [-o path]`. |
| **Quarto** | Same core in resources; for ASCII in the book, call `yrxlsim render ...` from a bash chunk with `#\| output: asis`. |

This gives you one codebase for browser and CLI, ASCII and HTML output, and the same formula evaluation everywhere.
