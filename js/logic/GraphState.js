/**
 * @fileoverview Manages the internal state of the argumentation graph by communicating with the backend.
 */

export class GraphState {
  constructor(data) {
    this.apiUrl = 'http://localhost:8000';
    this.colors = data.colors || {};
    this.cats = data.cats || {};
    this.globalScoresConfig = data.globalScores || [];
    this.method = 'h-categorizer';
    this.nodes = data.nodes || [];
    this.links = [];
    this.rebuildLinks();

    this.onUpdate = () => {};
    this.onStructureChange = () => {};
    this.onVisualChange = () => {};
    this.onNodeClick = () => {};
    this.onSelectionChange = () => {};
    
    this.selectedNodeId = null;
  }

  async recalculate() {
    const res = await fetch(`${this.apiUrl}/graph`);
    const data = await res.json();
    this.updateLocalData(data, false);
    this.onVisualChange();
  }

  updateLocalData(data, structural = true) {
    // 1. Merge nodes to preserve D3 simulation state (x, y, vx, vy, etc.)
    const newNodeMap = new Map(data.nodes.map(n => [n.id, n]));
    
    // Update existing nodes and remove old ones
    this.nodes = this.nodes.filter(n => {
      if (newNodeMap.has(n.id)) {
        const newData = newNodeMap.get(n.id);
        Object.assign(n, newData); // Merges only properties from backend
        newNodeMap.delete(n.id);
        return true;
      }
      return false;
    });
    
    // Add new nodes
    newNodeMap.forEach(n => this.nodes.push(n));

    // 2. Rebuild links ONLY if structure changed
    if (structural) {
      this.rebuildLinks();
    }

    // Signal sidebar update with new category averages
    const categoryScores = this.calculateCategoryAverages();
    this.onUpdate(categoryScores);
  }

  calculateCategoryAverages() {
    const averages = {};
    const categories = Object.keys(this.cats).filter(c => c !== 'action' && c !== 'state');
    categories.forEach(cat => {
      const nodes = this.nodes.filter(n => n.cat === cat && !n.inactive);
      if (nodes.length > 0) {
        averages[cat] = nodes.reduce((sum, n) => sum + (n.score || 0), 0) / nodes.length;
      } else {
        averages[cat] = 0;
      }
    });
    return averages;
  }

  rebuildLinks() {
    this.links = [];
    this.nodes.forEach(n => {
      (n.attacks || []).forEach(targetId => {
        this.links.push({ source: n.id, target: targetId, type: 'attack' });
      });
      (n.supports || []).forEach(targetId => {
        this.links.push({ source: n.id, target: targetId, type: 'support' });
      });
    });
  }

  async addNode(nodeObj) {
    const res = await fetch(`${this.apiUrl}/node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeObj)
    });
    const data = await res.json();
    this.updateLocalData(data, true);
    this.onStructureChange();
  }

  async updateNode(id, newData) {
    const structural = newData.id !== undefined || newData.cat !== undefined || newData.attacks !== undefined || newData.supports !== undefined;

    const res = await fetch(`${this.apiUrl}/node/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    });
    const data = await res.json();
    this.updateLocalData(data, structural);
    
    if (structural) {
      this.onStructureChange();
    } else {
      this.onVisualChange();
    }
  }

  async removeNode(id) {
    const res = await fetch(`${this.apiUrl}/node/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    this.updateLocalData(data, true);
    this.onStructureChange();
  }

  async toggleNodeActive(id) {
    const node = this.getNode(id);
    if (node && node.cat !== 'state') {
      await this.updateNode(id, { inactive: !node.inactive });
    }
  }

getNode(id) {
  return this.nodes.find(n => n.id === id) || null;
}

/**
 * Exports the current state to JSON.
 */
exportJSON() {
    const data = {
      colors: this.colors,
      cats: this.cats,
      globalScores: this.globalScoresConfig,
      nodes: this.nodes.map(n => ({
        id: n.id,
        label: n.label,
        cat: n.cat,
        desc: n.desc,
        attacks: [...(n.attacks || [])],
        supports: [...(n.supports || [])],
        value: n.value,
        inactive: n.inactive
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'argumentation_graph.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
