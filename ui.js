/* ============================================================
   ui.js — Right detail panel & node selection
   ============================================================
   Call: initDetailPanel(graphState)
   ============================================================ */

function initDetailPanel(gs) {
  const { data } = gs;

  const categoryWeights = {};
  Object.keys(data.cats).forEach(cat => { categoryWeights[cat] = 1.0; });

  function recalculate() {
    // 1. Weighted h-categorizer scores
    const nodeScores = calculateSemantics(gs.nodes, 'h-categorizer', categoryWeights);

    // 2. Push scores onto node objects
    gs.nodes.forEach(n => { n.score = nodeScores[n.id] || 0; });

    // 3. Refresh graph visuals
    gs.updateNodeScores();
    if (gs.updateNodeVisuals) gs.updateNodeVisuals();

    // 4. Aggregate scores
    const result = aggregateScores(gs.nodes, categoryWeights);

    // 5. UI
    renderGlobalScores(result);
  }

  gs.recalculate = recalculate;

  // Inactive toggle triggers recalculate
  if (gs.setOnInactiveToggle) {
    gs.setOnInactiveToggle(() => recalculate());
  }

  /* ── Global scores footer ────────── */
  function renderGlobalScores(categoryScores) {
    const el = document.getElementById('global-scores');
    if (!el) return;
    el.innerHTML = Object.entries(data.cats)
      .filter(([cat]) => cat !== 'action' && cat !== 'state')
      .map(([cat, label]) => {
        const val = categoryScores[cat] || 0;
        return `
          <div class="gscore">
            <div class="gscore-label">${label}</div>
            <div class="gscore-val" style="color:${data.colors[cat]}">${val.toFixed(2)}</div>
          </div>
        `;
      }).join('');
  }

  /* ── Formula rendering (KaTeX) ────────────────────────── */
  function renderFormula() {
    const el = document.getElementById('formula-display');
    if (!el || typeof katex === 'undefined') return;

    el.innerHTML = '';

    function addBlock(title, lines) {
      const block = document.createElement('div');
      block.className = 'formula-block';
      if (title) {
        const t = document.createElement('div');
        t.className = 'formula-title';
        t.textContent = title;
        block.appendChild(t);
      }
      lines.forEach(({ tex, note, isSmall }) => {
        if (note) {
          const row = document.createElement('div');
          row.className = 'formula-note' + (isSmall ? ' formula-note--small' : '');
          row.textContent = note;
          block.appendChild(row);
        } else {
          const math = document.createElement('div');
          math.className = 'formula-math';
          try { katex.render(tex, math, { displayMode: true, throwOnError: false }); }
          catch(e) { math.textContent = tex; }
          block.appendChild(math);
        }
      });
      el.appendChild(block);
    }

    addBlock('Node score — extended h-categorizer', [
      { tex: String.raw`\sigma(a) = \frac{1 + \displaystyle\sum_{b\in Sup(a)}\sigma(b)}{1 + \displaystyle\sum_{b\in Att(a)}\sigma(b) + \displaystyle\sum_{b\in Sup(a)}\sigma(b)}` },
      { note: 'States modulate outgoing impact: if s supports a, impact of a is scaled by σ(s).' },
    ]);
  }

  gs.deselect = deselect;
  gs.setOnNodeClick(d => d ? selectNode(d) : deselect());

  function selectNode(d) {
    const nodeSel = gs.getNodeSel();
    const linkSel = gs.getLinkSel();
    if (gs.fillCreatorForm) gs.fillCreatorForm(d);

    const related = new Set([d.id]);
    (d.attacks || []).forEach(id => related.add(id));
    (d.supports || []).forEach(id => related.add(id));
    gs.nodes.forEach(n => {
      if ((n.attacks || []).includes(d.id) || (n.supports || []).includes(d.id)) {
        related.add(n.id);
      }
    });

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

  recalculate();
  if (typeof katex !== 'undefined') renderFormula();
  else window.addEventListener('load', renderFormula);
}