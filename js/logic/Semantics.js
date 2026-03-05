/**
 * @fileoverview Main router for gradual semantics calculation.
 */

import { SEMANTICS_METHODS } from '../utils/Constants.js';
import { calculateHCategorizer } from './methods/HCategorizer.js';
import { calculateMaxBased } from './methods/MaxBased.js';
import { calculateDrastic } from './methods/Drastic.js';
import { calculateDrasticLinear } from './methods/DrasticLinear.js';

/**
 * Calculates gradual scores for all nodes using the selected method.
 * 
 * @param {Array<Object>} nodes - List of graph nodes.
 * @param {string} method - The semantics method to use.
 * @param {Object} categoryWeights - Weights per category.
 * @returns {Object} A map of node IDs to their gradual scores.
 */
export function calculateSemantics(nodes, method = SEMANTICS_METHODS.HCATEGORIZER, categoryWeights = {}) {
  
  // 1. Common Pre-processing: State Multipliers
  const stateMultipliers = {};
  nodes.forEach(n => { stateMultipliers[n.id] = 1.0; });

  nodes.filter(n => n.cat === 'state').forEach(stateNode => {
    const val = stateNode.value || 0;
    
    // Attacks from state: multiplier = (1 - val)
    (stateNode.attacks || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (stateMultipliers[tid] !== undefined) stateMultipliers[tid] *= (1 - val);
    });

    // Supports from state: multiplier = val
    (stateNode.supports || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (stateMultipliers[tid] !== undefined) stateMultipliers[tid] *= val;
    });
  });

  // 2. Identify Active IDs
  const activeIds = new Set(
    nodes.filter(n => {
      if (n.cat === 'state') return true;
      return !n.inactive && stateMultipliers[n.id] > 0;
    }).map(n => n.id)
  );

  // 3. Dispatch to specific method
  switch (method) {
    case SEMANTICS_METHODS.MAXBASED:
      return calculateMaxBased(nodes, categoryWeights, stateMultipliers, activeIds);
    case SEMANTICS_METHODS.DRASTIC:
      return calculateDrastic(nodes, categoryWeights, stateMultipliers, activeIds);
    case SEMANTICS_METHODS.DRASTIC_LINEAR:
      return calculateDrasticLinear(nodes, categoryWeights, stateMultipliers, activeIds);
    case SEMANTICS_METHODS.HCATEGORIZER:
    default:
      return calculateHCategorizer(nodes, categoryWeights, stateMultipliers, activeIds);
  }
}

/**
 * Aggregates scores by category (mean score).
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
