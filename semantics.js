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
 * Extended weighted h-categorizer with support relations.
 *
 * MODIFICATION FOR STATE NODES:
 * 1. State nodes have a fixed score σ(s) = s.value.
 * 2. State nodes provide an "activation" factor to the nodes they link to.
 *    mod(a) = (product of supporting state values) * (product of 1 - attacking state values)
 * 3. Final score σ(a) = hCategorizer(a) * mod(a)
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
  activeNodes.forEach(n => {
    attackedBy[n.id] = [];
    supportedBy[n.id] = [];
  });

  activeNodes.forEach(n => {
    (n.attacks || []).forEach(targetId => {
      if (activeIds.has(targetId)) attackedBy[targetId].push(n.id);
    });
    (n.supports || []).forEach(targetId => {
      if (activeIds.has(targetId)) supportedBy[targetId].push(n.id);
    });
  });

  // 3. Modulation: states affecting other nodes
  const modulationFactors = {};
  activeNodes.forEach(n => {
    if (n.cat === 'state') {
      const val = (n.value !== undefined) ? n.value : 0.5;
      (n.supports || []).forEach(targetId => {
        if (activeIds.has(targetId)) {
          modulationFactors[targetId] = (modulationFactors[targetId] || 1.0) * val;
        }
      });
      (n.attacks || []).forEach(targetId => {
        if (activeIds.has(targetId)) {
          modulationFactors[targetId] = (modulationFactors[targetId] || 1.0) * (1 - val);
        }
      });
    }
  });

  // 4. Initial scores
  let currentScores = {};
  activeNodes.forEach(n => {
    currentScores[n.id] = (n.cat === 'state') ? (n.value || 0) : 0.5;
  });

  // 5. Iterative calculation
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

      (attackedBy[n.id] || []).forEach(srcId => {
        const w = categoryWeights[catOf[srcId]] || 1.0;
        attackSum += w * (currentScores[srcId] || 0);
      });

      (supportedBy[n.id] || []).forEach(srcId => {
        const w = categoryWeights[catOf[srcId]] || 1.0;
        supportSum += w * (currentScores[srcId] || 0);
      });

      // Base h-categorizer formula (base 0.5)
      const baseScore = (1 + supportSum) / (1 + attackSum + supportSum);
      
      // Apply modulation from states
      const mod = (modulationFactors[n.id] !== undefined) ? modulationFactors[n.id] : 1.0;
      nextScores[n.id] = baseScore * mod;

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