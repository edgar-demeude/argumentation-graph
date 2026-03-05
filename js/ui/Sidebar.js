/**
 * @fileoverview Manages the right sidebar (world states, global scores, and formula).
 */

export class Sidebar {
  /**
   * @param {GraphState} graphState 
   */
  constructor(graphState) {
    this.state = graphState;
    this.statesContainer = document.getElementById('world-states-container');
    this.scoresContainer = document.getElementById('global-scores');
    
    this.init();
  }

  init() {
    // Hook into state updates
    this.state.onUpdate = (categoryScores) => {
      this.renderGlobalScores(categoryScores);
      this.renderWorldStates();
    };
  }

  /**
   * Renders sliders for world state nodes.
   */
  renderWorldStates() {
    if (!this.statesContainer) return;

    const stateNodes = this.state.nodes.filter(n => n.cat === 'state');
    
    // Simplistic diffing: recreate if count changes, otherwise just update values
    // For a real app, use a proper UI framework or fine-grained DOM manipulation.
    if (this.statesContainer.children.length !== stateNodes.length) {
      this.statesContainer.innerHTML = stateNodes.map(node => `
                <div class="weight-item" data-node-id="${node.id}">
                  <div class="weight-label">
                    <span>${node.id}: ${node.label.replace('\n', ' ')}</span>
                    <span class="weight-val">${(node.value || 0).toFixed(2)}</span>
                  </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="${node.value || 0}"
            class="weight-range"
            style="accent-color: var(--state)"
          >
        </div>
      `).join('');

      this.statesContainer.querySelectorAll('.weight-item').forEach(item => {
        const id = item.dataset.nodeId;
        const node = this.state.getNode(id);
        const range = item.querySelector('input');
        const valLabel = item.querySelector('.weight-val');

        range.addEventListener('input', () => {
          node.value = parseFloat(range.value);
          valLabel.textContent = node.value.toFixed(2);
          this.state.recalculate();
        });
      });
    } else {
      // Just update existing values
      stateNodes.forEach(node => {
        const item = this.statesContainer.querySelector(`[data-node-id="${node.id}"]`);
        if (item) {
          item.querySelector('input').value = node.value;
          item.querySelector('.weight-val').textContent = (node.value || 0).toFixed(2);
        }
      });
    }
  }

  /**
   * Renders the aggregated scores for value belief categories.
   * @param {Object} categoryScores 
   */
  renderGlobalScores(categoryScores) {
    if (!this.scoresContainer) return;

    this.scoresContainer.innerHTML = Object.entries(this.state.cats)
      .filter(([cat]) => cat !== 'action' && cat !== 'state')
      .map(([cat, label]) => {
        const val = categoryScores[cat] || 0;
        const color = this.state.colors[cat] || '#ffffff';
        return `
          <div class="gscore">
            <div class="gscore-label">${label}</div>
            <div class="gscore-val" style="color:${color}">${val.toFixed(2)}</div>
          </div>
        `;
      }).join('');
  }
}
