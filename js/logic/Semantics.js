/**
 * @fileoverview Main router for gradual semantics calculation.
 */

import { SEMANTICS_METHODS } from '../utils/Constants.js';
import { calculateHCategorizer } from './methods/HCategorizer.js';
import { calculateMaxBased } from './methods/MaxBased.js';

/**
 * Calculates gradual scores for all nodes using the selected method.
 */
export function calculateSemantics(nodes, method = SEMANTICS_METHODS.HCATEGORIZER, categoryWeights = {}) {
  
  // 1. Identify Active IDs (States are always active, others if not inactive)
  const activeIds = new Set(
    nodes.filter(n => n.cat === 'state' || !n.inactive).map(n => n.id)
  );

  // 2. Dispatch to specific method
  switch (method) {
    case SEMANTICS_METHODS.MAXBASED:
      return calculateMaxBased(nodes, categoryWeights, activeIds);
    case SEMANTICS_METHODS.HCATEGORIZER:
    default:
      return calculateHCategorizer(nodes, categoryWeights, activeIds);
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
