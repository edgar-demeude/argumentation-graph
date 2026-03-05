/**
 * @fileoverview Logic for calculating gradual semantics in the argumentation graph.
 */

import { SEMANTICS_METHODS } from '../utils/Constants.js';

/**
 * Calculates gradual scores for all nodes.
 * 
 * @param {Array<Object>} nodes - List of graph nodes.
 * @param {string} method - The semantics method to use.
 * @param {Object} categoryWeights - Weights per category.
 * @returns {Object} A map of node IDs to their gradual scores.
 */
export function calculateSemantics(nodes, method = SEMANTICS_METHODS.HCATEGORIZER, categoryWeights = {}) {
  if (method === SEMANTICS_METHODS.HCATEGORIZER) {
    return calculateHCategorizer(nodes, categoryWeights);
  }
  return calculateHCategorizer(nodes, categoryWeights);
}

/**
 * Extended weighted h-categorizer with support relations and dynamic influences.
 *
 * @param {Array<Object>} nodes 
 * @param {Object} categoryWeights 
 * @returns {Object} Node ID -> Score mapping.
 */
function calculateHCategorizer(nodes, categoryWeights = {}) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  // 1. Pre-calculate state multipliers for all nodes.
  // A state can "attack" a node to reduce its strength (e.g. drought makes plants weak).
  const stateMultipliers = {};
  nodes.forEach(n => { stateMultipliers[n.id] = 1.0; });

  nodes.filter(n => n.cat === 'state').forEach(stateNode => {
    const val = stateNode.value || 0;
    (stateNode.attacks || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (stateMultipliers[tid] !== undefined) {
        stateMultipliers[tid] *= (1 - val);
      }
    });
  });

  // 2. Identify active nodes.
  // A node is active if not manually toggled off and its state multiplier is > 0.
  const activeNodes = nodes.filter(n => {
    if (n.cat === 'state') return true;
    return !n.inactive && stateMultipliers[n.id] > 0;
  });
  const activeIds = new Set(activeNodes.map(n => n.id));

  const nodeCats = {};
  activeNodes.forEach(n => { nodeCats[n.id] = n.cat; });

  // 3. Build reverse relationship maps for efficient calculation.
  const attackedBy = {};
  const supportedBy = {};
  const influencedBy = {};
  
  activeNodes.forEach(n => {
    attackedBy[n.id] = [];
    supportedBy[n.id] = [];
    influencedBy[n.id] = [];
  });

  activeNodes.forEach(n => {
    const multiplier = stateMultipliers[n.id];
    
    (n.attacks || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (activeIds.has(tid)) {
        attackedBy[tid].push({ srcId: n.id, multiplier });
      }
    });

    (n.supports || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (activeIds.has(tid)) {
        supportedBy[tid].push({ srcId: n.id, multiplier });
      }
    });

    (n.influences || []).forEach(attr => {
      if (activeIds.has(attr.id)) {
        influencedBy[attr.id].push({ 
          srcId: n.id, 
          conditionId: attr.conditionId, 
          multiplier 
        });
      }
    });
  });

  // 4. Initialize scores.
  let currentScores = {};
  activeNodes.forEach(n => {
    currentScores[n.id] = (n.cat === 'state') ? (n.value || 0) : 0.5;
  });

  // 5. Fixed-point iteration.
  for (let iter = 0; iter < maxIterations; iter++) {
    const nextScores = {};
    let maxDiff = 0;

    activeNodes.forEach(n => {
      if (n.cat === 'state') {
        nextScores[n.id] = n.value || 0;
        return;
      }

      let attackSum  = 0;
      let supportSum = 0;

      // Static Attackers
      (attackedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        attackSum += weight * (currentScores[srcId] || 0);
      });

      // Static Supporters
      (supportedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        supportSum += weight * (currentScores[srcId] || 0);
      });

      // Dynamic Influences (Conditional on world state)
      (influencedBy[n.id] || []).forEach(({ srcId, conditionId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        const srcScore = currentScores[srcId] || 0;
        
        let impact = 0;
        if (conditionId) {
          const isInverse = conditionId.startsWith('!');
          const stateId = isInverse ? conditionId.substring(1) : conditionId;
          const stateNode = nodes.find(sn => sn.id === stateId);
          
          if (stateNode) {
            const stateVal = stateNode.value || 0;
            const activationMultiplier = isInverse ? (1 - 2 * stateVal) : (2 * stateVal - 1);
            impact = activationMultiplier * srcScore;
          }
        }
        
        if (impact > 0) supportSum += weight * impact;
        else if (impact < 0) attackSum += weight * Math.abs(impact);
      });

      // Base h-categorizer formula:
      // σ(a) = (1 + Σ supporters) / (2 + Σ attackers + Σ supporters)
      const nodeMultiplier = stateMultipliers[n.id];
      const base = 1 + supportSum;
      const divisor = 2 + attackSum + supportSum;
      nextScores[n.id] = (base / divisor) * nodeMultiplier;

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  // Set scores for inactive nodes to zero.
  nodes.forEach(n => {
    if (n.cat !== 'state' && !activeIds.has(n.id)) {
      currentScores[n.id] = 0;
    }
  });

  return currentScores;
}

/**
 * Aggregates scores by category (mean score).
 * 
 * @param {Array<Object>} nodes 
 * @returns {Object} Category -> Mean Score mapping.
 */
export function aggregateScores(nodes) {
  const categoryData = {};
  
  nodes
    .filter(n => !n.inactive && n.cat !== 'action' && n.cat !== 'state')
    .forEach(n => {
      if (!categoryData[n.cat]) categoryData[n.cat] = { sum: 0, count: 0 };
      categoryData[n.cat].sum += n.score;
      categoryData[n.cat].count += 1;
    });

  const categoryScores = {};
  for (const cat in categoryData) {
    categoryScores[cat] = categoryData[cat].sum / categoryData[cat].count;
  }
  return categoryScores;
}
