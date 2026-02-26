/* ============================================================
   semantics.js — Gradual semantics calculation
   ============================================================ */

const SEMANTICS_METHODS = {
  HCATEGORIZER: 'h-categorizer',
};

/**
 * Calculates gradual scores for all nodes in the graph.
 * @param {Array}  nodes           - Array of node objects.
 * @param {string} method          - The calculation method to use.
 * @param {Object} categoryWeights - Map of cat -> weight, used to scale attacker contributions.
 * @returns {Object} A map of nodeId -> score.
 */
function calculateSemantics(nodes, method = SEMANTICS_METHODS.HCATEGORIZER, categoryWeights = {}) {
  if (method === SEMANTICS_METHODS.HCATEGORIZER) {
    return calculateHCategorizer(nodes, categoryWeights);
  }
  return calculateHCategorizer(nodes, categoryWeights);
}

/**
 * Weighted Besnard & Hunter (2008) h-categorizer.
 *
 *   Sc(a) = 1 / (1 + Σ_{b ∈ Att(a)}  w(cat(b)) · Sc(b))
 *
 * w(cat(b)) is the importance weight of the attacker's category.
 * A low-importance attacker has less impact on the score of its target.
 *
 * Slider mapping (v ∈ [0,1], 0 = full Economic, 1 = full Environmental):
 *   w_eco    = 2·(1−v)   →  v=0: 2.0,  v=0.5: 1.0,  v=1: 0.0
 *   w_env    = 2·v        →  v=0: 0.0,  v=0.5: 1.0,  v=1: 2.0
 *   w_others = 1.0        →  care, just, prag always neutral
 */
function calculateHCategorizer(nodes, categoryWeights = {}) {
  const maxIterations = 100;
  const epsilon = 1e-6;

  // Build a map: nodeId -> its category (for fast weight lookup of attackers)
  const catOf = {};
  nodes.forEach(n => { catOf[n.id] = n.cat; });

  // Map for quick access to attackers
  const attackersMap = {};
  nodes.forEach(n => { attackersMap[n.id] = n.attackedBy || []; });

  // Initialize scores to 1
  let currentScores = {};
  nodes.forEach(n => { currentScores[n.id] = 1.0; });

  for (let iter = 0; iter < maxIterations; iter++) {
    const nextScores = {};
    let maxDiff = 0;

    nodes.forEach(n => {
      let weightedAttackerSum = 0;

      attackersMap[n.id].forEach(attackerId => {
        if (currentScores[attackerId] === undefined) return;
        // Weight of the attacker's own category (default 1.0 if not set)
        const w = categoryWeights[catOf[attackerId]] !== undefined
          ? categoryWeights[catOf[attackerId]]
          : 1.0;
        weightedAttackerSum += w * currentScores[attackerId];
      });

      nextScores[n.id] = 1 / (1 + weightedAttackerSum);

      const diff = Math.abs(nextScores[n.id] - currentScores[n.id]);
      if (diff > maxDiff) maxDiff = diff;
    });

    currentScores = nextScores;
    if (maxDiff < epsilon) break;
  }

  return currentScores;
}

/**
 * Aggregates scores by category and calculates a weighted final score.
 * @param {Array}  nodes           - Array of node objects with calculated scores.
 * @param {Object} categoryWeights - Map of cat -> weight for the final average.
 * @returns {Object} { categoryScores, finalScore }
 */
function aggregateScores(nodes, categoryWeights = {}) {
  const categoryData = {};

  nodes.forEach(n => {
    if (!categoryData[n.cat]) categoryData[n.cat] = { sum: 0, count: 0 };
    categoryData[n.cat].sum   += n.score;
    categoryData[n.cat].count += 1;
  });

  const categoryScores = {};
  let weightedSum = 0;
  let totalWeight  = 0;

  for (const cat in categoryData) {
    const avg = categoryData[cat].sum / categoryData[cat].count;
    categoryScores[cat] = avg;

    const w = categoryWeights[cat] !== undefined ? categoryWeights[cat] : 1.0;
    weightedSum += avg * w;
    totalWeight += w;
  }

  return categoryScores;
}