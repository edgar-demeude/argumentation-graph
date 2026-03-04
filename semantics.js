/* ============================================================
   semantics.js — Gradual semantics calculation
   ============================================================ */

const SEMANTICS_METHODS = {
  HCATEGORIZER: 'h-categorizer',
};

/**
 * Calculates gradual scores for all nodes in the graph.
 */
function calculateSemantics(nodes, method = SEMANTICS_METHODS.HCATEGORIZER, categoryWeights = {}) {
  if (method === SEMANTICS_METHODS.HCATEGORIZER) {
    return calculateHCategorizer(nodes, categoryWeights);
  }
  return calculateHCategorizer(nodes, categoryWeights);
}

/**
 * Extended weighted h-categorizer with support relations and dynamic influences.
 *
 * MODIFICATION FOR DYNAMIC INFLUENCES:
 * 1. Links can be static (attacks/supports) or dynamic (influences).
 * 2. influence(B, A) conditioned by S:
 *    impact = (2 * σ(S) - 1) * σ(B)
 *    if impact > 0 -> contributes to supportSum
 *    if impact < 0 -> contributes to attackSum
 */
function calculateHCategorizer(nodes, categoryWeights = {}) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  // 1. Identify active nodes
  const activeNodes = nodes.filter(n => n.cat === 'state' || !n.inactive);
  const activeIds   = new Set(activeNodes.map(n => n.id));

  const catOf = {};
  activeNodes.forEach(n => { catOf[n.id] = n.cat; });

  // 2. Build reverse maps
  const attackedBy = {};
  const supportedBy = {};
  const influencedBy = {};
  
  activeNodes.forEach(n => {
    attackedBy[n.id] = [];
    supportedBy[n.id] = [];
    influencedBy[n.id] = [];
  });

  activeNodes.forEach(n => {
    // Static attacks
    (n.attacks || []).forEach(targetId => {
      if (typeof targetId === 'string' && activeIds.has(targetId)) {
        attackedBy[targetId].push({ srcId: n.id });
      }
    });
    // Static supports
    (n.supports || []).forEach(targetId => {
      if (typeof targetId === 'string' && activeIds.has(targetId)) {
        supportedBy[targetId].push({ srcId: n.id });
      }
    });
    // Dynamic influences
    (n.influences || []).forEach(attr => {
      const targetId = attr.id;
      const conditionId = attr.conditionId;
      if (activeIds.has(targetId)) {
        influencedBy[targetId].push({ srcId: n.id, conditionId });
      }
    });
  });

  // 3. Initial scores (base 0.5)
  let currentScores = {};
  activeNodes.forEach(n => {
    currentScores[n.id] = (n.cat === 'state') ? (n.value || 0) : 0.5;
  });

  // 4. Iterative calculation
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
      (attackedBy[n.id] || []).forEach(({ srcId }) => {
        const w = categoryWeights[catOf[srcId]] || 1.0;
        attackSum += w * (currentScores[srcId] || 0);
      });

      // Static Supporters
      (supportedBy[n.id] || []).forEach(({ srcId }) => {
        const w = categoryWeights[catOf[srcId]] || 1.0;
        supportSum += w * (currentScores[srcId] || 0);
      });

      // Dynamic Influences
      (influencedBy[n.id] || []).forEach(({ srcId, conditionId }) => {
        const w = categoryWeights[catOf[srcId]] || 1.0;
        const srcScore = currentScores[srcId] || 0;
        
        let impact = 0;
        if (conditionId) {
          const isInverse = conditionId.startsWith('!');
          const actualStateId = isInverse ? conditionId.substring(1) : conditionId;
          
          if (activeIds.has(actualStateId)) {
            const stateVal = currentScores[actualStateId];
            // If normal: val=0 -> -1 (attack), val=1 -> +1 (support)
            // If inverse: val=0 -> +1 (support), val=1 -> -1 (attack)
            const multiplier = isInverse ? (1 - 2 * stateVal) : (2 * stateVal - 1);
            impact = multiplier * srcScore;
          }
        }
        
        if (impact > 0) supportSum += w * impact;
        else if (impact < 0) attackSum += w * Math.abs(impact);
      });

      // Base h-categorizer formula
      nextScores[n.id] = (1 + supportSum) / (2 + attackSum + supportSum);

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  // Set score 0 for inactive nodes
  nodes.forEach(n => {
    if (n.cat !== 'state' && n.inactive) currentScores[n.id] = 0;
  });

  return currentScores;
}

/**
 * Aggregates scores by category (excluding action and state).
 */
function aggregateScores(nodes, categoryWeights = {}) {
  const categoryData = {};
  nodes
    .filter(n => !n.inactive && n.cat !== 'action' && n.cat !== 'state')
    .forEach(n => {
      if (!categoryData[n.cat]) categoryData[n.cat] = { sum: 0, count: 0 };
      categoryData[n.cat].sum   += n.score;
      categoryData[n.cat].count += 1;
    });

  const categoryScores = {};
  for (const cat in categoryData) {
    categoryScores[cat] = categoryData[cat].sum / categoryData[cat].count;
  }
  return categoryScores;
}