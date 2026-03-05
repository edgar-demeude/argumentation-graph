/**
 * @fileoverview Main entry point for the modular Argumentation Graph application.
 */

import { GraphState } from './logic/GraphState.js';
import { GraphRenderer } from './graph/GraphRenderer.js';
import { Sidebar } from './ui/Sidebar.js';
import { Creator } from './ui/Creator.js';
import { Formula } from './ui/Formula.js';
import { DEFAULT_DATA_PATH } from './utils/Constants.js';

/**
 * Initializes the application.
 */
async function init() {
  try {
    const data = await fetchData(DEFAULT_DATA_PATH);
    
    // 1. Initialize logic state
    const state = new GraphState(data);

    // 2. Initialize renderer
    const renderer = new GraphRenderer('#svg', '#graph-container', state);
    
    // 3. Initialize UI panels
    const sidebar = new Sidebar(state);
    const creator = new Creator(state);
    const formula = new Formula('#formula-display');

    // 4. Connect renderer and state
    state.onStructureChange = () => renderer.update();
    state.onVisualChange = () => renderer.updateVisuals();
    state.recalculate(); // Initial calculation
    renderer.update(); // Initial render

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
