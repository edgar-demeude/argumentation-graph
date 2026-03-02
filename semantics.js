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
 * Properties:
 *   • No attackers, no supporters  → σ = 1
 *   • Only attackers               → σ < 0.5  (degrades)
 *   • Only supporters              → σ > 0.5  (boosted toward 1)
 *   • Balanced attack & support    → σ = 0.5
 *
 * Inactive nodes are treated as absent: they do not contribute as
 * attackers or supporters, and receive a fixed score of 0.
 *
 * Slider mapping (v ∈ [0,1], 0 = full Economic, 1 = full Environmental):
 *   w_eco    = 2·(1−v)
 *   w_env    = 2·v
 *   w_others = 1.0
 */
function calculateHCategorizer(nodes, categoryWeights = {}) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  // Only active nodes participate
  const activeNodes = nodes.filter(n => !n.inactive);
  const activeIds   = new Set(activeNodes.map(n => n.id));

  const catOf = {};
  activeNodes.forEach(n => { catOf[n.id] = n.cat; });

  // Initialize scores to 1 for active nodes
  let currentScores = {};
  activeNodes.forEach(n => { currentScores[n.id] = 1.0; });

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextScores = {};
    let maxDiff = 0;

    activeNodes.forEach(n => {
      // Active attackers of n
      const attackers  = (n.attackedBy  || []).filter(id => activeIds.has(id));
      // Active supporters of n
      const supporters = (n.supportedBy || []).filter(id => activeIds.has(id));

      let attackSum  = 0;
      let supportSum = 0;

      attackers.forEach(id => {
        const w = categoryWeights[catOf[id]] !== undefined ? categoryWeights[catOf[id]] : 1.0;
        attackSum += w * (currentScores[id] || 0);
      });

      supporters.forEach(id => {
        const w = categoryWeights[catOf[id]] !== undefined ? categoryWeights[catOf[id]] : 1.0;
        supportSum += w * (currentScores[id] || 0);
      });

      nextScores[n.id] = (1 + supportSum) / (1 + attackSum + supportSum);

      const diff = Math.abs(nextScores[n.id] - (currentScores[n.id] || 0));
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  // Inactive nodes get score 0
  nodes.forEach(n => {
    if (n.inactive) currentScores[n.id] = 0;
  });

  return currentScores;
}

/**
 * Aggregates scores by category (excluding action category and inactive nodes).
 * @param {Array}  nodes           - Array of node objects with calculated scores.
 * @param {Object} categoryWeights - Map of cat -> weight for the final average.
 * @returns {Object} categoryScores map: cat -> average score
 */
function aggregateScores(nodes, categoryWeights = {}) {
  const categoryData = {};

  nodes
    .filter(n => !n.inactive && n.cat !== 'action')
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