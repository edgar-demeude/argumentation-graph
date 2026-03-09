/**
 * @fileoverview Standard Max-based gradual semantics (Fractional).
 */

/**
 * Standard Max-based semantics with support relations.
 * Formula: σ(a) = ((1 + max sup) / (1 + max att + max sup)) * stateMultiplier
 *
 * @param {Array<Object>} nodes 
 * @param {Object} categoryWeights 
 * @param {Object} stateMultipliers 
 * @param {Set<string>} activeIds 
 * @returns {Object} Node ID -> Score mapping.
 */
export function calculateMaxBased(nodes, categoryWeights, stateMultipliers, activeIds) {
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
      if (!activeIds.has(n.id)) { nextScores[n.id] = 0; return; }

      let maxAttack = 0;
      let maxSupport = 0;

      (attackedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        const val = weight * (currentScores[srcId] || 0);
        if (val > maxAttack) maxAttack = val;
      });
      (supportedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const weight = (categoryWeights[nodeCats[srcId]] || 1.0) * multiplier;
        const val = weight * (currentScores[srcId] || 0);
        if (val > maxSupport) maxSupport = val;
      });

      if (n.cat === 'state') {
        const baseValue = n.value || 0;
        nextScores[n.id] = (baseValue + maxSupport) / (1 + maxAttack + maxSupport);
      } else {
        const nodeMultiplier = stateMultipliers[n.id];
        nextScores[n.id] = ((1 + maxSupport) / (1 + maxAttack + maxSupport)) * nodeMultiplier;
      }

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  return currentScores;
}
