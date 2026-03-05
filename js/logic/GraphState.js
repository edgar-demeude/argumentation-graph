/**
 * @fileoverview Manages the internal state of the argumentation graph.
 */

import { calculateSemantics, aggregateScores } from './Semantics.js';

export class GraphState {
  /**
   * @param {Object} data - The initial data (nodes, colors, cats, etc.).
   */
  constructor(data) {
    this.colors = data.colors || {};
    this.cats = data.cats || {};
    this.globalScoresConfig = data.globalScores || [];
    
    // Prepare nodes with some defaults
    this.nodes = (data.nodes || []).map(n => ({
      ...n,
      attacks: [...(n.attacks || [])],
      supports: [...(n.supports || [])],
      influences: [...(n.influences || [])],
      inactive: n.cat === 'state' ? false : (n.cat === 'action' ? !!n.inactive : !!n.inactive),
      score: n.score || 0,
      value: n.value !== undefined ? n.value : 0.5,
    }));

    this.links = [];
    this.rebuildLinks();

    // Callbacks for UI updates
    this.onUpdate = () => {}; // For aggregate scores (sidebar)
    this.onStructureChange = () => {}; // For graph layout (nodes/links added/removed)
    this.onVisualChange = () => {}; // For node scores/colors (no layout change)
    
    this.onNodeClick = () => {};
    this.onSelectionChange = () => {};
    
    this.selectedNodeId = null;
    this.editingId = null;
  }

  /**
   * Builds the links array from nodes' relationships.
   */
  rebuildLinks() {
    this.links = [];
    this.nodes.forEach(n => {
      (n.attacks || []).forEach(targetId => {
        if (typeof targetId === 'string') {
          this.links.push({ source: n.id, target: targetId, type: 'attack' });
        }
      });
      (n.supports || []).forEach(targetId => {
        if (typeof targetId === 'string') {
          this.links.push({ source: n.id, target: targetId, type: 'support' });
        }
      });
      (n.influences || []).forEach(attr => {
        this.links.push({ source: n.id, target: attr.id, type: 'influence', conditionId: attr.conditionId });
      });
    });
  }

  /**
   * Recalculates scores and triggers update.
   */
  recalculate() {
    const nodeScores = calculateSemantics(this.nodes);
    this.nodes.forEach(n => {
      n.score = nodeScores[n.id] || 0;
    });

    const categoryScores = aggregateScores(this.nodes);
    this.onUpdate(categoryScores);
    this.onVisualChange();
  }

  /**
   * Adds a new node to the graph.
   * @param {Object} nodeObj 
   */
  addNode(nodeObj) {
    this.nodes.push({
      ...nodeObj,
      attacks: [...(nodeObj.attacks || [])],
      supports: [...(nodeObj.supports || [])],
      influences: [...(nodeObj.influences || [])],
      score: 0,
    });
    this.rebuildLinks();
    this.recalculate();
    this.onStructureChange();
  }

  /**
   * Updates an existing node's data.
   * @param {string} id - The current ID of the node.
   * @param {Object} newData 
   */
  updateNode(id, newData) {
    const node = this.nodes.find(n => n.id === id);
    if (!node) return;

    const idChanged = newData.id && newData.id !== id;

    // Update references in other nodes if ID changed
    if (idChanged) {
      this.nodes.forEach(n => {
        if (n.id === id) return;
        if (n.attacks) n.attacks = n.attacks.map(x => x === id ? newData.id : x);
        if (n.supports) n.supports = n.supports.map(x => x === id ? newData.id : x);
        if (n.influences) {
          n.influences = n.influences.map(x => {
            const copy = { ...x };
            if (copy.id === id) copy.id = newData.id;
            if (copy.conditionId === id) copy.conditionId = newData.id;
            if (copy.conditionId === `!${id}`) copy.conditionId = `!${newData.id}`;
            return copy;
          });
        }
      });
    }

    Object.assign(node, newData);
    this.rebuildLinks();
    this.recalculate();
    this.onStructureChange();
  }

  /**
   * Removes a node and its references.
   * @param {string} id 
   */
  removeNode(id) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.forEach(n => {
      if (n.attacks) n.attacks = n.attacks.filter(x => x !== id);
      if (n.supports) n.supports = n.supports.filter(x => x !== id);
      if (n.influences) {
        n.influences = n.influences.filter(x => x.id !== id && x.conditionId !== id && x.conditionId !== `!${id}`);
      }
    });
    if (this.selectedNodeId === id) this.selectedNodeId = null;
    this.rebuildLinks();
    this.recalculate();
    this.onStructureChange();
  }

  /**
   * Toggles a node's active/inactive state.
   * @param {string} id 
   */
  toggleNodeActive(id) {
    const node = this.nodes.find(n => n.id === id);
    if (node && node.cat !== 'state') {
      node.inactive = !node.inactive;
      this.recalculate();
    }
  }

  /**
   * Finds a node by ID.
   * @param {string} id 
   * @returns {Object|null}
   */
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
        influences: [...(n.influences || [])],
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
