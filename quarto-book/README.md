# yrXlsim Quarto book (sample)

Minimal Quarto book that renders **yrXlsim** YAML code blocks as Excel-like HTML tables.

## Open in RStudio

1. In RStudio: **File → Open Project** and choose this folder (the one containing `_quarto.yml` and `yrxlsim-quarto-book.Rproj`).
2. **Build → Render Book** (or the "Build" pane → "Render Book") to generate the HTML in `_book/`.

## Embedding yrXlsim in a `.qmd` file

Use a fenced code block with the **yrxlsim** class:

````
```{.yrxlsim}
version: "0.0.2"
rows:
  - ["Col A", "Col B"]
  - ["=A2+1", "Hello"]
```
````

The YAML is parsed in the browser by JavaScript and turned into a table with row/column headers (1, 2, 3… and A, B, C…). Formulas are shown in blue; literals in black.

## Files

- `_quarto.yml` — Book config (chapters, HTML format, header/CSS/JS).
- `resources/header.html` — Loads js-yaml and HyperFormula from CDN, then `yrxlsim.js`.
- `resources/yrxlsim.css` — Excel-like table styles.
- `resources/yrxlsim.js` — **Single source of truth** for the yrXlsim core: parses YAML, applies fill/resolution, renders Formulas and Values. Used by both this book (browser) and the CLI (`bin/yrxlsim.js`). Edit this file only; no sync step.
- `index.qmd`, `yrxlsim.qmd` — Sample chapters with embedded YAML.

## Same core, CLI too

The same JavaScript runs (1) here in the browser for Quarto and (2) in the repo’s **CLI** (`yrxlsim render file.yaml`) for ASCII or standalone HTML. See the main [README](../README.md) for CLI usage.

## Dependencies

- **Quarto** (for rendering the book).
- **RStudio** optional (you can run `quarto render` from the terminal).
- In the built HTML: **js-yaml** and **HyperFormula** are loaded from CDN; no R packages required for yrxlsim rendering.
