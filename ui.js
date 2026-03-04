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

  /* ── World States Sliders ─────────────────────────────── */
  function renderWorldStates() {
    const container = document.getElementById('world-states-container');
    if (!container) return;

    const stateNodes = gs.nodes.filter(n => n.cat === 'state');
    
    // Simple diffing/rendering
    container.innerHTML = stateNodes.map(node => `
      <div class="weight-item" data-node-id="${node.id}">
        <div class="weight-label">
          <span>${node.id}: ${node.label.replace('\n', ' ')}</span>
          <span class="weight-val">${(node.value || 0).toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value="${node.value || 0}"
          class="weight-range"
          style="accent-color: var(--state)"
        >
      </div>
    `).join('');

    container.querySelectorAll('.weight-item').forEach(item => {
      const id = item.dataset.nodeId;
      const node = gs.nodes.find(n => n.id === id);
      const range = item.querySelector('input');
      const valLabel = item.querySelector('.weight-val');

      range.addEventListener('input', () => {
        node.value = parseFloat(range.value);
        valLabel.textContent = node.value.toFixed(2);
        recalculate();
        
        // Sync with left panel if it's the currently edited node
        if (gs.fillCreatorForm && gs.editingId === id) {
           gs.fillCreatorForm(node);
        }
      });
    });
  }

  // Hook into graph updates to refresh the list of sliders
  const originalUpdateGraph = gs.updateGraph;
  gs.updateGraph = function() {
    originalUpdateGraph.apply(this, arguments);
    renderWorldStates();
  };

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
      { tex: String.raw`\sigma(a) = \frac{1 + \displaystyle\sum_{b\in Sup(a)}\phi(b,a)\sigma(b)}{2 + \displaystyle\sum_{b\in Att(a)}\phi(b,a)\sigma(b) + \displaystyle\sum_{b\in Sup(a)}\phi(b,a)\sigma(b)}` },
      { note: 'Base score: 0.5. Supporters raise σ(a) toward 1; attackers lower it toward 0.' },
    ]);

    addBlock('Notation', [
      { tex: String.raw`Att(a),\; Sup(a)` },
      { note: 'sets of attackers / supporters of a' },
      { tex: String.raw`\sigma(a) \in (0, 1)` },
      { note: 'gradual acceptability score of a' },
      { tex: String.raw`\phi(b,a) \in [0, 1]` },
      { note: 'link activation: σ(condition) if conditional, else 1' },
    ]);
  }

  gs.deselect = deselect;
  gs.setOnNodeClick(d => d ? selectNode(d) : deselect());

  function selectNode(d) {
    const nodeSel = gs.getNodeSel();
    const linkSel = gs.getLinkSel();
    if (gs.fillCreatorForm) gs.fillCreatorForm(d);
    gs.editingId = d.id; // Store current ID for sync

    const related = new Set([d.id]);
    (d.attacks || []).forEach(attr => {
        const targetId = typeof attr === 'string' ? attr : attr.id;
        related.add(targetId);
    });
    (d.supports || []).forEach(attr => {
        const targetId = typeof attr === 'string' ? attr : attr.id;
        related.add(targetId);
    });
    gs.nodes.forEach(n => {
      const allAttacks = (n.attacks || []).map(a => typeof a === 'string' ? a : a.id);
      const allSupports = (n.supports || []).map(s => typeof s === 'string' ? s : s.id);
      if (allAttacks.includes(d.id) || allSupports.includes(d.id)) {
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
    gs.editingId = null;
  }

  recalculate();
  renderWorldStates();
  if (typeof katex !== 'undefined') renderFormula();
  else window.addEventListener('load', renderFormula);
}