/**
 * @fileoverview Implementation of the H-Categorizer gradual semantics.
 */

import { aggregateScores } from '../Semantics.js';

/**
 * Weighted h-categorizer with support relations.
 * Formula: σ(a) = (1 + Σ σ(sup)) / (2 + Σ σ(att) + Σ σ(sup))
 *
 * @param {Array<Object>} nodes 
 * @param {Object} categoryWeights 
 * @param {Object} stateMultipliers 
 * @param {Set<string>} activeIds 
 * @returns {Object} Node ID -> Score mapping.
 */
export function calculateHCategorizer(nodes, categoryWeights, stateMultipliers, activeIds) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  const nodeCats = {};
  nodes.filter(n => activeIds.has(n.id)).forEach(n => { nodeCats[n.id] = n.cat; });

  // Build relationship maps
  const attackedBy = {};
  const supportedBy = {};
  
  activeIds.forEach(id => {
    attackedBy[id] = [];
    supportedBy[id] = [];
  });

  nodes.forEach(n => {
    if (!activeIds.has(n.id)) return;
    const multiplier = stateMultipliers[n.id];
    
    (n.attacks || []).forEach(tid => {
      if (activeIds.has(tid)) attackedBy[tid].push({ srcId: n.id, multiplier });
    });
    (n.supports || []).forEach(tid => {
      if (activeIds.has(tid)) supportedBy[tid].push({ srcId: n.id, multiplier });
    });
  });

  let currentScores = {};
  nodes.forEach(n => {
    currentScores[n.id] = (n.cat === 'state') ? (n.value || 0) : 0.5;
  });

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextScores = {};
    let maxDiff = 0;

    nodes.forEach(n => {
      if (!activeIds.has(n.id)) {
        nextScores[n.id] = 0;
        return;
      }
      if (n.cat === 'state') {
        nextScores[n.id] = n.value || 0;
        return;
      }

      let attackSum = 0;
      let supportSum = 0;

      (attackedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        attackSum += weight * (currentScores[srcId] || 0);
      });
      (supportedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        supportSum += weight * (currentScores[srcId] || 0);
      });

      const nodeMultiplier = stateMultipliers[n.id];
      nextScores[n.id] = ((1 + supportSum) / (2 + attackSum + supportSum)) * nodeMultiplier;

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  return currentScores;
}
