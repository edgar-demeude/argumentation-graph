/* ============================================================
   ui.js — Right detail panel & node selection
   ============================================================
   Call: initDetailPanel(graphState)
   ============================================================ */

function initDetailPanel(gs) {
  const { data } = gs;

  // Category weights for the semantics calculation (used to scale attacker contributions)
  const categoryWeights = {};
  Object.keys(data.cats).forEach(cat => { categoryWeights[cat] = 1.0; });

  function recalculate() {
    // 1. Calculate individual node scores, passing category weights
    const nodeScores = calculateSemantics(gs.nodes, 'h-categorizer', categoryWeights);

    // 2. Update node objects
    gs.nodes.forEach(n => {
      n.score = nodeScores[n.id] || 0;
    });

    // 3. Update graph visuals (rings, text, and edges)
    gs.updateNodeScores();
    if (gs.updateLinks) gs.updateLinks(); // Redraw edges when attack relations changed

    // 4. Aggregate by category and calculate final score (equal weights, importance is in scores)
    const result = aggregateScores(gs.nodes);

    // 5. Update UI displays
    renderGlobalScores(result.categoryScores);
    renderFinalScore(result.finalScore);

    // 6. Update detail panel if a node is selected
    const activeId = document.getElementById('d-id') ? document.getElementById('d-id').textContent : null;
    if (activeId) {
      const activeNode = gs.nodes.find(n => n.id === activeId);
      if (activeNode) updateDetailScore(activeNode);
    }
  }

  /* ── Global scores footer ─────────────────────────────── */
  function renderGlobalScores(categoryScores) {
    const el = document.getElementById('global-scores');
    el.innerHTML = Object.entries(data.cats).map(([cat, label]) => {
      const val = categoryScores[cat] || 0;
      return `
        <div class="gscore">
          <div class="gscore-label">${label}</div>
          <div class="gscore-val" style="color:${data.colors[cat]}">${val.toFixed(2)}</div>
        </div>
      `;
    }).join('');
  }

  function renderFinalScore(score) {
    const el = document.getElementById('final-score-val');
    el.textContent = score.toFixed(2);
  }

  function updateDetailScore(d) {
    const scoreText = document.getElementById('d-score-text');
    if (scoreText) scoreText.textContent = (d.score || 0).toFixed(2);

    const bar = document.getElementById('d-score-bar');
    if (bar) bar.style.width = ((d.score || 0) * 100) + '%';
  }

  // Expose recalculate via gs
  gs.recalculate = recalculate;

  /* ── Single importance slider UI ──────────────────────── */
  function initImportanceSlider() {
    const range = document.getElementById('importance-range');
    const label = document.getElementById('importance-label');

    if (!range || !label) return;

    const updateWeights = () => {
      const v = parseFloat(range.value); // 0 = full Economic, 1 = full Environmental

      // Display label
      if (v === 0.5) label.textContent = 'Balanced';
      else if (v < 0.5) label.textContent = `Eco ×${(2 * (1 - v)).toFixed(1)}`;
      else              label.textContent = `Env ×${(2 * v).toFixed(1)}`;

      // w_eco = 2·(1−v),  w_env = 2·v,  others = 1.0
      if ('eco' in categoryWeights) categoryWeights.eco = 2 * (1 - v);
      if ('env' in categoryWeights) categoryWeights.env = 2 * v;

      recalculate();
    };

    range.addEventListener('input', updateWeights);
    updateWeights();
  }

  initImportanceSlider();
  recalculate();

  // Expose deselect so other modules (e.g. creator) can trigger it
  gs.deselect = deselect;

  /* ── Node click handler ───────────────────────────────── */
  gs.setOnNodeClick(d => d ? selectNode(d) : deselect());

  function selectNode(d) {
    const nodeSel = gs.getNodeSel();
    const linkSel = gs.getLinkSel();

    // Fill the left creator form for editing
    if (gs.fillCreatorForm) {
      gs.fillCreatorForm(d);
    }

    // Highlight neighbours
    const attacked  = new Set(d.attacks);
    const defenders = new Set(d.attackedBy);
    const related   = new Set([d.id, ...attacked, ...defenders]);

    nodeSel.classed('dimmed',      n => !related.has(n.id));
    linkSel.classed('dimmed',      l => !(l.source.id === d.id || l.target.id === d.id));
    linkSel.classed('highlighted', l =>   l.source.id === d.id || l.target.id === d.id);
  }

  function deselect() {
    const nodeSel = gs.getNodeSel();
    const linkSel = gs.getLinkSel();
    if (!nodeSel || !linkSel) return;
    nodeSel.classed('dimmed',      false);
    nodeSel.classed('selected',    false);
    linkSel.classed('dimmed',      false);
    linkSel.classed('highlighted', false);
    if (gs.resetCreatorForm) gs.resetCreatorForm();
  }
}