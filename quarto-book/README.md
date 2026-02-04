# yrXlsim Quarto book (sample)

Minimal Quarto book that renders **yrXlsim** YAML code blocks as Excel-like HTML tables.

## Open in RStudio

1. In RStudio: **File → Open Project** and choose this folder (the one containing `_quarto.yml` and `yrxlsim-quarto-book.Rproj`).
2. **Build → Render Book** (or the "Build" pane → "Render Book") to generate the HTML in `_book/`.

## Embedding yrXlsim in a `.qmd` file

Use a fenced code block with the **yrxlsim** class:

````
```{.yrxlsim}
version: "0.0.1"
rows:
  - ["Col A", "Col B"]
  - ["=A2+1", "Hello"]
```
````

The YAML is parsed in the browser by JavaScript and turned into a table with row/column headers (1, 2, 3… and A, B, C…). Formulas are shown in blue; literals in black.

## Files

- `_quarto.yml` — Book config (chapters, HTML format, header/CSS/JS).
- `resources/header.html` — Loads js-yaml from CDN.
- `resources/yrxlsim.css` — Excel-like table styles.
- `resources/yrxlsim.js` — Parses YAML, applies fill/resolution, renders table.
- `index.qmd`, `yrxlsim.qmd` — Sample chapters with embedded YAML.

## Dependencies

- **Quarto** (for rendering the book).
- **RStudio** optional (you can run `quarto render` from the terminal).
- In the built HTML: **js-yaml** is loaded from jsDelivr CDN; no R packages required for the yrxlsim rendering.
