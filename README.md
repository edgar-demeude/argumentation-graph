# ⚖️ Argumentation graph — Values alignment

A modular, interactive web application for modeling and analyzing ethical argumentation graphs using gradual semantics. This tool allows users to visualize how different actions, beliefs, and world states interact to produce ethical scores based on the **weighted H-Categorizer** algorithm.

## 🚀 Features

- **Interactive D3 Graph**: Visualize arguments as nodes and their relationships (attacks, supports, influences) as edges.
- **Gradual Semantics**: Real-time calculation of node scores (0.0 to 1.0) using an iterative fixed-point algorithm.
- **Dynamic Influences**: Model conditional relationships that change based on the "World State" (e.g., how drought affects the value of watering).
- **Argument Editor**: Create, update, and delete nodes and relationships directly from the UI.
- **Export/Import**: Save your graph configuration as a JSON file for later use.
- **Mathematical Transparency**: View the underlying formulas (rendered via KaTeX) used for score calculations.

## 🛠️ Architecture

The project is built with a modern modular structure (ES Modules):

- **Logic Layer**: Centralized state management and semantic algorithms (`js/logic/`).
- **Rendering Layer**: Specialized D3.js components for graph visualization (`js/graph/`).
- **UI Layer**: Modular sidebar and form components (`js/ui/`).
- **Configuration**: Application-wide constants and styling variables (`js/utils/Constants.js`).

## 📖 How to Use

1.  **Select a Node**: Click on any node to see its details and highlight its relationships.
2.  **Toggle Active**: Right-click a node to deactivate it (it will be grayed out and excluded from score calculations).
3.  **Adjust World State**: Use the sliders in the right panel to change the intensity of different states.
4.  **Edit Graph**: Use the left panel to add new arguments or modify existing ones.
5.  **Export**: Click "Export JSON" to download your current graph state.

## 🖥️ Local Development

Since the application uses ES Modules and fetches data from a JSON file, it must be served via a web server (it won't work by simply opening `index.html` in a browser due to CORS policies).

**Option 1: Python**
```bash
python -m http.server 8000
```

**Option 2: Node.js (serve)**
```bash
npx serve .
```

Then visit `http://localhost:8000`.

## 📜 Credits

Developed as part of a research project on argumentation-based ethical reasoning in ecological contexts. Built with [D3.js](https://d3js.org/) and [KaTeX](https://katex.org/).
