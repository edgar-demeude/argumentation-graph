# ⚖️ Argumentation graph — Values alignment

A modular, interactive web application for modeling and analyzing ethical argumentation graphs using gradual semantics. This tool allows users to visualize how different actions, beliefs, and world states interact to produce ethical scores based on the **weighted H-Categorizer** algorithm.

## Live Demo
-> [Visit the deployed app](https://edgar-demeude.github.io/argumentation-graph/) 

## Features

- **Agent-based Simulation**: Run simulations where autonomous agents move on a grid and make decisions based on the current argumentation graph.
- **Interactive D3 Graph**: Visualize arguments as nodes and their relationships (attacks, supports, influences) as edges.
- **Gradual Semantics**: Real-time calculation of node scores (0.0 to 1.0) using iterative fixed-point algorithms (FastAPI backend).
- **Dynamic Influences**: Model conditional relationships that change based on the "World State" (e.g., how drought affects the value of watering).
- **Argument Editor**: Create, update, and delete nodes and relationships directly from the UI.
- **Export/Import**: Save your graph configuration as a JSON file for later use.
- **Mathematical Transparency**: View the underlying formulas (rendered via KaTeX) used for score calculations.

## Architecture

The project is built with a modular structure:

- **Backend (Python/FastAPI)**: Handles the argumentation logic, gradual semantics calculations, and agent-based simulation (`backend/`).
- **Frontend (ES Modules)**: 
    - **Logic Layer**: Local state management and UI synchronization (`js/logic/`).
    - **Rendering Layer**: D3.js components for graph visualization and grid simulation (`js/graph/`).
    - **UI Layer**: Modular sidebar and form components (`js/ui/`).

## How to Use

1.  **Select a Node**: Click on any node to see its details and highlight its relationships.
2.  **Toggle Active**: Right-click a node to deactivate it (it will be grayed out and excluded from score calculations).
3.  **Adjust World State**: Use the sliders in the right panel to change the intensity of different states.
4.  **Edit Graph**: Use the left panel to add new arguments or modify existing ones.
5.  **Run Simulation**: Expand the "Grid" panel, configure the number of agents and steps, and click "Start Simulation".
6.  **Export**: Click "Export JSON" to download your current graph state.

## Local Development

The application now consists of a **FastAPI backend** (for logic and simulation) and a **Vanilla JS frontend**. 

### 1. Backend Setup
The backend requires Python 3.8+ and its dependencies.

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run the backend (from the root directory)
python -m backend.main
```
The backend will run on `http://localhost:8000`.

### 2. Frontend Setup
Since the application uses ES Modules, it must be served via a web server. The frontend is configured to communicate with the backend on port 8000.

**Option 1: Python**
```bash
# Run from the root directory on a different port (e.g., 8080)
python -m http.server 8080
```

**Option 2: Node.js (serve)**
```bash
npx serve .
```

Then visit `http://localhost:8080` in your browser.

## Credits

Developed as part of a research project on argumentation-based ethical reasoning in ecological contexts. Built with [D3.js](https://d3js.org/) and [KaTeX](https://katex.org/).
