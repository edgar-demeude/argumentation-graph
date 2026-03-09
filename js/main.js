/**
 * @fileoverview Main entry point for the modular Argumentation Graph application.
 */

import { GraphState } from './logic/GraphState.js';
import { GraphRenderer } from './graph/GraphRenderer.js';
import { Simulation } from './logic/Simulation.js';
import { Sidebar } from './ui/Sidebar.js';
import { Creator } from './ui/Creator.js';
import { Formula } from './ui/Formula.js';
import { DEFAULT_DATA_PATH } from './utils/Constants.js';

/**
 * Initializes the application.
 */
async function init() {
  try {
    const apiUrl = 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/graph`);
    const data = await response.json();
    
    // 1. Initialize logic state
    const state = new GraphState(data);

    // 2. Initialize renderer
    const renderer = new GraphRenderer('#svg', '#graph-view', state);
    const simulation = new Simulation('simulation-canvas', 'grid-dashboard', state);
    
    // 2b. Grid Toggle Logic
    const gridView = document.getElementById('grid-view');
    const btnToggle = document.getElementById('btn-toggle-grid');
    if (btnToggle && gridView) {
      btnToggle.onclick = () => {
        const isCollapsed = gridView.classList.toggle('grid-collapsed');
        btnToggle.textContent = isCollapsed ? '▲ Grid' : '▼ Grid';
        // Force simulation to adjust to new dimensions after transition
        setTimeout(() => {
          renderer.width = document.querySelector('#graph-view').clientWidth;
          renderer.height = document.querySelector('#graph-view').clientHeight;
          renderer.simulation.force('center', d3.forceCenter(renderer.width / 2, renderer.height / 2));
          renderer.update();
          simulation.render(); // Redraw grid
        }, 450); 
      };
    }

    // 2c. Start Simulation Logic
    const btnStartSim = document.getElementById('btn-start-sim');
    if (btnStartSim) {
      btnStartSim.onclick = () => {
        // Expand grid if collapsed
        if (gridView.classList.contains('grid-collapsed')) {
          btnToggle.click();
        }

        const numAgents = parseInt(document.getElementById('sim-agents').value);
        const maxSteps = parseInt(document.getElementById('sim-steps').value);
        const gridSize = parseInt(document.getElementById('sim-grid').value);

        simulation.init(numAgents, maxSteps, gridSize);
        simulation.start();
      };
    }

    const btnPrev = document.getElementById('btn-prev-step');
    const btnNext = document.getElementById('btn-next-step');
    if (btnPrev) btnPrev.onclick = () => simulation.previous();
    if (btnNext) btnNext.onclick = () => simulation.next();
    
    // 3. Initialize UI panels
    const sidebar = new Sidebar(state);
    const creator = new Creator(state);
    const formula = new Formula('#formula-display');
    sidebar.formula = formula;

    // 4. Connect renderer and state
    state.onStructureChange = () => renderer.update(true);
    state.onVisualChange = async () => {
      // Refresh sidebar category scores from current local nodes
      const categoryScores = state.calculateCategoryAverages();
      state.onUpdate(categoryScores);
      renderer.update(false);
    };
    state.onNodeClick = (node) => {};
    
    await state.recalculate(); // Initial calculation
    renderer.update(true); // Initial render

    // 5. Global export button
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.onclick = () => state.exportJSON();
    }

  } catch (error) {
    showError(error);
  }
}

/**
 * Fetches JSON data from the given path.
 * @param {string} path 
 * @returns {Promise<Object>}
 */
async function fetchData(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load data from ${path} (${response.status})`);
  }
  return response.json();
}

/**
 * Displays a full-page error message.
 * @param {Error} error 
 */
function showError(error) {
  console.error('Initialization error:', error);
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; 
                height:100vh; font-family:'DM Mono', monospace; color:#e07777; 
                background:#0e1a12; padding: 20px; text-align: center;">
      <h2 style="margin-bottom: 10px;">⚠ Initialization Error</h2>
      <p>${error.message}</p>
      <small style="color:#7a9e80; margin-top:16px;">
        Make sure you are serving via HTTP (e.g. 'python -m http.server').
      </small>
    </div>`;
}

// Start the application
init();
