/* ============================================================
   ui.js — Right detail panel & node selection
   ============================================================
   Call: initDetailPanel(graphState)
   ============================================================ */

function initDetailPanel(gs) {
  const { data } = gs;

  // Slider value v ∈ [0,1]:  0 = full eco,  0.5 = balanced,  1 = full env
  let sliderV = 0.5;

  const categoryWeights = {};
  Object.keys(data.cats).forEach(cat => { categoryWeights[cat] = 1.0; });

  function updateCategoryWeights(v) {
    Object.keys(data.cats).forEach(cat => {
      if      (cat === 'eco') categoryWeights[cat] = 2 * (1 - v);
      else if (cat === 'env') categoryWeights[cat] = 2 * v;
      else                    categoryWeights[cat] = 1.0;
    });
  }

  function recalculate() {
    // 1. Weighted h-categorizer scores (inactive nodes excluded)
    const nodeScores = calculateSemantics(gs.nodes, 'h-categorizer', categoryWeights);

    // 2. Push scores onto node objects
    gs.nodes.forEach(n => { n.score = nodeScores[n.id] || 0; });

    // 3. Refresh graph visuals
    gs.updateNodeScores();
    if (gs.updateNodeVisuals) gs.updateNodeVisuals();

    // 4. Aggregate — only value belief categories (not 'action')
    const result = aggregateScores(gs.nodes, categoryWeights);

    // 5. UI
    renderGlobalScores(result);
  }

  gs.recalculate = recalculate;

  // Wire up inactive toggle to trigger recalculate
  if (gs.setOnInactiveToggle) {
    gs.setOnInactiveToggle(() => recalculate());
  }

  /* ── Global scores footer — value beliefs only ────────── */
  function renderGlobalScores(categoryScores) {
    const el = document.getElementById('global-scores');
    // Show only non-action and non-state categories
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

  /* ── State value slider ────────────────────────────────── */
  function updateStateSlider(d) {
    let container = document.getElementById('state-slider-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'state-slider-container';
      container.className = 'weight-section';
      const sidebarRight = document.querySelector('.sidebar-right');
      const detailPanel = document.querySelector('.detail-panel');
      sidebarRight.insertBefore(container, detailPanel);
    }

    if (!d || d.cat !== 'state') {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <h2>State value: ${d.label.replace('\n', ' ')}</h2>
      <div class="weights-container">
        <div class="weight-item">
          <div class="weight-label">
            <span>Current value</span>
            <span class="weight-val" id="state-val-label">${(d.value || 0).toFixed(2)}</span>
          </div>
          <input
            id="state-val-range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="${d.value || 0}"
            class="weight-range"
          >
        </div>
      </div>
    `;

    const range = document.getElementById('state-val-range');
    const label = document.getElementById('state-val-label');
    range.addEventListener('input', () => {
      d.value = parseFloat(range.value);
      label.textContent = d.value.toFixed(2);
      recalculate();
    });
  }

  /* ── Importance slider ────────────────────────────────── */
  function initImportanceSlider() {
    const range = document.getElementById('importance-range');
    const label = document.getElementById('importance-label');
    if (!range || !label) return;

    const update = () => {
      sliderV = parseFloat(range.value);

      const envPct = Math.round(sliderV * 100);
      const ecoPct = 100 - envPct;
      if (Math.abs(sliderV - 0.5) < 0.005) {
        label.textContent = 'Balanced';
      } else if (sliderV > 0.5) {
        label.textContent = `Env ${envPct}%`;
      } else {
        label.textContent = `Eco ${ecoPct}%`;
      }

      updateCategoryWeights(sliderV);
      recalculate();
      renderFormula();
    };

    range.addEventListener('input', update);
    update();
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

    // ── Block 1: h-categorizer with support ─────────────
    addBlock('Node score — extended h-categorizer', [
      { tex: String.raw`\sigma(a) = \frac{1 + \displaystyle\sum_{b\in Sup(a)}\omega_{c(b)}\sigma(b)}{1 + \displaystyle\sum_{b\in Att(a)}\omega_{c(b)}\sigma(b) + \displaystyle\sum_{b\in Sup(a)}\omega_{c(b)}\sigma(b)}` },
      { note: 'Supporters raise σ(a) toward 1; attackers lower it toward 0. Solved iteratively to convergence.' },
    ]);

    // ── Block 2: Notation ────────────────────────────────
    addBlock('Notation', [
      { tex: String.raw`Att(a),\; Sup(a)` },
      { note: 'sets of attackers / supporters of a' },
      { tex: String.raw`\omega_c \in [0,2]` },
      { note: 'importance weight of dimension c' },
      { tex: String.raw`\sigma(a) \in (0, 1)` },
      { note: 'gradual acceptability score of a' },
    ]);
  }

  /* ── Expose deselect ──────────────────────────────────── */
  gs.deselect = deselect;

  /* ── Node click handler ───────────────────────────────── */
  gs.setOnNodeClick(d => d ? selectNode(d) : deselect());

  function selectNode(d) {
    const nodeSel = gs.getNodeSel();
    const linkSel = gs.getLinkSel();

    if (gs.fillCreatorForm) gs.fillCreatorForm(d);
    if (updateStateSlider) updateStateSlider(d);

    // Find nodes that attack or support 'd', and nodes that 'd' attacks or supports
    const related = new Set([d.id]);
    
    // Nodes 'd' attacks/supports
    (d.attacks || []).forEach(id => related.add(id));
    (d.supports || []).forEach(id => related.add(id));

    // Nodes that attack/support 'd'
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
    if (updateStateSlider) updateStateSlider(null);
  }

  /* ── Init ─────────────────────────────────────────────── */
  initImportanceSlider();
  recalculate();

  if (typeof katex !== 'undefined') {
    renderFormula();
  } else {
    window.addEventListener('load', renderFormula);
  }
}