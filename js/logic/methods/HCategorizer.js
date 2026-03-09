/**
 * @fileoverview Standard (Fractional) H-Categorizer gradual semantics.
 */

/**
 * Standard weighted h-categorizer with support relations.
 * Formula: σ(a) = ((1 + Σ sup) / (1 + Σ att + Σ sup)) * stateMultiplier
 * 
 * Non-destructive: scores are balanced but attackers don't "destroy" targets.
 *
 * @param {Array<Object>} nodes 
 * @param {Object} categoryWeights 
 * @param {Object} stateMultipliers 
 * @param {Set<string>} activeIds 
 * @returns {Object} Node ID -> Score mapping.
 */
export function calculateHCategorizer(nodes, categoryWeights, activeIds) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  const nodeCats = {};
  nodes.filter(n => activeIds.has(n.id)).forEach(n => { nodeCats[n.id] = n.cat; });

  const attackedBy = {};
  const supportedBy = {};
  
  activeIds.forEach(id => {
    attackedBy[id] = [];
    supportedBy[id] = [];
  });

  nodes.forEach(n => {
    if (!activeIds.has(n.id)) return;
    (n.attacks || []).forEach(tid => { if (activeIds.has(tid)) attackedBy[tid].push(n.id); });
    (n.supports || []).forEach(tid => { if (activeIds.has(tid)) supportedBy[tid].push(n.id); });
  });

  let currentScores = {};
  nodes.forEach(n => {
    // Initial guess: 1.0 (fully supported by default if no states) or state initial value
    currentScores[n.id] = (n.cat === 'state') ? (n.value || 0) : 1.0;
  });

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextScores = {};
    let maxDiff = 0;

    nodes.forEach(n => {
      if (!activeIds.has(n.id)) { nextScores[n.id] = 0; return; }

      let attackSum = 0;
      let supportSum = 0;
      let stateSupportSum = 0;
      let stateSupportCount = 0;

      (attackedBy[n.id] || []).forEach(srcId => {
        const weight = categoryWeights[nodeCats[srcId]] || 1.0;
        attackSum += weight * (currentScores[srcId] || 0);
      });

      (supportedBy[n.id] || []).forEach(srcId => {
        const weight = categoryWeights[nodeCats[srcId]] || 1.0;
        const val = weight * (currentScores[srcId] || 0);
        if (nodeCats[srcId] === 'state') {
          stateSupportSum += val;
          stateSupportCount++;
        } else {
          supportSum += val;
        }
      });

      if (n.cat === 'state') {
        const baseValue = n.value || 0;
        nextScores[n.id] = (baseValue + supportSum) / (1 + attackSum + supportSum);
      } else {
        // Base score: Average of supporting states. 1.0 if independent.
        const baseValue = stateSupportCount > 0 ? (stateSupportSum / stateSupportCount) : 1.0;
        nextScores[n.id] = (baseValue + supportSum) / (1 + attackSum + supportSum);
      }

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  return currentScores;
}
