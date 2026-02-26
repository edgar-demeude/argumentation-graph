# 🍃 Argumentation graph - Ecological gardening

*A concise web-based argumentation visualization and analysis tool that models argument graphs, evaluates semantics, and provides an interactive UI for exploring argument structures.*

---

## Key Features

- Lightweight client-side app for building and visualizing argumentation graphs.
- Multiple semantics evaluation for argument acceptability.
- Interactive UI with graph manipulation and inspection.
- Simple JSON data-driven project structure.

---

## Quick Start

**Requirements:** modern web browser (Chrome, Firefox, Edge).

1. Open `index.html` in your browser.
2. Edit or add argument data in `data.json`, then reload the page to view updates.

---

## Usage

- Use the UI to add, remove, or edit arguments and relations.
- Visualizations update automatically based on data and selected semantics.
- Core logic is found in:
  - `graph.js` — graph model and rendering utilities.
  - `semantics.js` — argumentation semantics implementations.
  - `ui.js` — user interaction logic.

---

## Project Structure

| File            | Description                              |
|-----------------|------------------------------------------|
| `index.html`    | Main entry and UI layout.                |
| `main.js`       | App initialization and creation helpers. |
| `creator.js`    | Creation helpers.                        |
| `graph.js`      | Graph model and rendering utilities.     |
| `semantics.js`  | Argumentation semantics implementations.  |
| `ui.js`         | User interaction logic.                 |
| `styles.css`    | Visual styling.                          |
| `data.json`     | Primary data file for arguments.         |
| `data_old.json` | Previous data snapshot.                  |
