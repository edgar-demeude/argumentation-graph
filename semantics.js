/* ============================================================
   semantics.js — Gradual semantics calculation
   ============================================================ */

const SEMANTICS_METHODS = {
  HCATEGORIZER: 'h-categorizer',
};

/**
 * Calculates gradual scores for all nodes in the graph.
 * Inactive nodes (node.inactive === true) are excluded from all calculations.
 *
 * @param {Array}  nodes           - Array of node objects.
 * @param {string} method          - The calculation method to use.
 * @param {Object} categoryWeights - Map of cat -> weight.
 * @returns {Object} A map of nodeId -> score.
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
 *   σ(a) = (1 + Σ_{b ∈ Sup(a)}  ω_{c(b)} · σ(b))
 *          ─────────────────────────────────────────────────────────
 *          (1 + Σ_{b ∈ Att(a)}  ω_{c(b)} · σ(b)
 *             + Σ_{b ∈ Sup(a)}  ω_{c(b)} · σ(b))
 *
 * MODIFICATION FOR STATE NODES:
 * 1. State nodes have a fixed score equal to their `value`.
 * 2. If a state node links to an action node, it modulates the action's outgoing impact.
 */
function calculateHCategorizer(nodes, categoryWeights = {}) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  // Only active nodes participate (except state nodes, which are always active but use their 'value')
  const activeNodes = nodes.filter(n => n.cat === 'state' || !n.inactive);
  const activeIds   = new Set(activeNodes.map(n => n.id));

  const catOf = {};
  const valueOf = {};
  activeNodes.forEach(n => {
    catOf[n.id]   = n.cat;
    valueOf[n.id] = (n.value !== undefined) ? n.value : 1.0;
  });

  // Pre-calculate reverse maps for attacks and supports
  const attackedBy = {};
  const supportedBy = {};
  activeNodes.forEach(n => {
    attackedBy[n.id] = [];
    supportedBy[n.id] = [];
  });

  activeNodes.forEach(n => {
    (n.attacks || []).forEach(targetId => {
      if (activeIds.has(targetId)) {
        if (!attackedBy[targetId]) attackedBy[targetId] = [];
        attackedBy[targetId].push(n.id);
      }
    });
    (n.supports || []).forEach(targetId => {
      if (activeIds.has(targetId)) {
        if (!supportedBy[targetId]) supportedBy[targetId] = [];
        supportedBy[targetId].push(n.id);
      }
    });
  });

  // Modulation map: how state nodes affect other nodes (actions)
  // modulationFactor[targetId] = product of (connected state values)
  const modulationFactors = {};
  activeNodes.forEach(n => {
    if (n.cat === 'state') {
      (n.supports || []).forEach(targetId => {
        if (activeIds.has(targetId)) {
          modulationFactors[targetId] = (modulationFactors[targetId] || 1.0) * n.value;
        }
      });
      // You can even have 'attacks' from state to actions to mean inverse modulation
      (n.attacks || []).forEach(targetId => {
        if (activeIds.has(targetId)) {
          modulationFactors[targetId] = (modulationFactors[targetId] || 1.0) * (1 - n.value);
        }
      });
    }
  });

  // Initialize scores
  let currentScores = {};
  activeNodes.forEach(n => {
    if (n.cat === 'state') {
      currentScores[n.id] = n.value;
    } else {
      currentScores[n.id] = 1.0;
    }
  });

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextScores = {};
    let maxDiff = 0;

    activeNodes.forEach(n => {
      // State nodes have fixed scores
      if (n.cat === 'state') {
        nextScores[n.id] = n.value;
        return;
      }

      const attackers  = attackedBy[n.id] || [];
      const supporters = supportedBy[n.id] || [];

      let attackSum  = 0;
      let supportSum = 0;

      attackers.forEach(id => {
        // If the attacker is modulated by states
        const mod = modulationFactors[id] !== undefined ? modulationFactors[id] : 1.0;
        const w = categoryWeights[catOf[id]] !== undefined ? categoryWeights[catOf[id]] : 1.0;
        attackSum += w * (currentScores[id] || 0) * mod;
      });

      supporters.forEach(id => {
        const mod = modulationFactors[id] !== undefined ? modulationFactors[id] : 1.0;
        const w = categoryWeights[catOf[id]] !== undefined ? categoryWeights[catOf[id]] : 1.0;
        supportSum += w * (currentScores[id] || 0) * mod;
      });

      nextScores[n.id] = (1 + supportSum) / (1 + attackSum + supportSum);

      const diff = Math.abs(nextScores[n.id] - (currentScores[n.id] || 0));
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  // Inactive nodes get score 0 (except states)
  nodes.forEach(n => {
    if (n.cat !== 'state' && n.inactive) currentScores[n.id] = 0;
  });

  return currentScores;
}

/**
 * Aggregates scores by category (excluding action and state categories and inactive nodes).
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