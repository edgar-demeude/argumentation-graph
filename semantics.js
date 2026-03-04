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

  // 1. Pre-calculate state multipliers for all nodes
  const stateMultipliers = {};
  nodes.forEach(n => { stateMultipliers[n.id] = 1.0; });

  nodes.filter(n => n.cat === 'state').forEach(stateNode => {
    const val = stateNode.value || 0;
    // If a state attacks a node, that node's strength is (1 - stateValue)
    (stateNode.attacks || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (stateMultipliers[tid] !== undefined) {
        stateMultipliers[tid] *= (1 - val);
      }
    });
  });

  // 2. Identify active nodes
  // A node is active if it's not manually inactive AND its state multiplier is > 0
  const activeNodes = nodes.filter(n => {
    if (n.cat === 'state') return true;
    return !n.inactive && stateMultipliers[n.id] > 0;
  });
  const activeIds = new Set(activeNodes.map(n => n.id));

  const catOf = {};
  activeNodes.forEach(n => { catOf[n.id] = n.cat; });

  // 3. Build reverse maps
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
    
    // Static attacks
    (n.attacks || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (activeIds.has(tid)) {
        attackedBy[tid].push({ srcId: n.id, multiplier });
      }
    });
    // Static supports
    (n.supports || []).forEach(targetId => {
      const tid = typeof targetId === 'string' ? targetId : targetId.id;
      if (activeIds.has(tid)) {
        supportedBy[tid].push({ srcId: n.id, multiplier });
      }
    });
    // Dynamic influences
    (n.influences || []).forEach(attr => {
      const targetId = attr.id;
      const conditionId = attr.conditionId;
      if (activeIds.has(targetId)) {
        influencedBy[targetId].push({ srcId: n.id, conditionId, multiplier });
      }
    });
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

      // Static Attackers
      (attackedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const w = (categoryWeights[catOf[srcId]] || 1.0) * multiplier;
        attackSum += w * (currentScores[srcId] || 0);
      });

      // Static Supporters
      (supportedBy[n.id] || []).forEach(({ srcId, multiplier }) => {
        const w = (categoryWeights[catOf[srcId]] || 1.0) * multiplier;
        supportSum += w * (currentScores[srcId] || 0);
      });

      // Dynamic Influences
      (influencedBy[n.id] || []).forEach(({ srcId, conditionId, multiplier }) => {
        const w = (categoryWeights[catOf[srcId]] || 1.0) * multiplier;
        const srcScore = currentScores[srcId] || 0;
        
        let impact = 0;
        if (conditionId) {
          const isInverse = conditionId.startsWith('!');
          const actualStateId = isInverse ? conditionId.substring(1) : conditionId;
          
          const stateNode = nodes.find(sn => sn.id === actualStateId);
          if (stateNode) {
            const stateVal = stateNode.value || 0;
            const multiplierCond = isInverse ? (1 - 2 * stateVal) : (2 * stateVal - 1);
            impact = multiplierCond * srcScore;
          }
        }
        
        if (impact > 0) supportSum += w * impact;
        else if (impact < 0) attackSum += w * Math.abs(impact);
      });

      // Base h-categorizer formula
      // The node's own intrinsic weight is also scaled by its state multiplier
      const nodeMultiplier = stateMultipliers[n.id];
      const base = (1 + supportSum);
      const div  = (2 + attackSum + supportSum);
      nextScores[n.id] = (base / div) * nodeMultiplier;

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  // Set score 0 for inactive nodes
  nodes.forEach(n => {
    if (n.cat !== 'state' && (!activeIds.has(n.id))) currentScores[n.id] = 0;
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