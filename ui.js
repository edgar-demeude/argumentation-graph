/* ============================================================
   ui.js — Right detail panel & node selection
   ============================================================
   Call: initDetailPanel(graphState)
   ============================================================ */

function initDetailPanel(gs) {
  const { data } = gs;

  // Slider value v ∈ [0,1]:  0 = full eco,  0.5 = balanced,  1 = full env
  let sliderV = 0.5;

  // Category weights used in TWO places:
  //   (A) semantics: scales attacker contribution  →  w_eco = 2(1−v),  w_env = 2v,  others = 1
  //   (B) aggregation: weights the final average   →  same mapping
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
    // 1. Weighted h-categorizer scores
    const nodeScores = calculateSemantics(gs.nodes, 'h-categorizer', categoryWeights);

    // 2. Push scores onto node objects
    gs.nodes.forEach(n => { n.score = nodeScores[n.id] || 0; });

    // 3. Refresh graph visuals
    gs.updateNodeScores();

    // 4. Weighted final average (same weights as semantics)
    const result = aggregateScores(gs.nodes, categoryWeights);

    // 5. UI
    renderGlobalScores(result);
  }

  gs.recalculate = recalculate;

  /* ── Global scores footer ─────────────────────────────── */
  function renderGlobalScores(categoryScores) {
    const el = document.getElementById('global-scores');
    el.innerHTML = Object.entries(data.cats).map(([cat, label]) => {
      const val = categoryScores[cat] || 0;
      if (cat === 'action') return '';
      return `
        <div class="gscore">
          <div class="gscore-label">${label}</div>
          <div class="gscore-val" style="color:${data.colors[cat]}">${val.toFixed(2)}</div>
        </div>
      `;
    }).join('');
  }

  /* ── Importance slider ────────────────────────────────── */
  function initImportanceSlider() {
    const range = document.getElementById('importance-range');
    const label = document.getElementById('importance-label');
    if (!range || !label) return;

    const update = () => {
      sliderV = parseFloat(range.value);

      // Percentage display
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

    // ── Helper ───────────────────────────────────────────
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
          // Plain-text annotation row
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


    // ── Block 1 : h-categorizer ──────────────────────────
    addBlock('Node score — weighted h-categorizer', [
      { tex: String.raw`\sigma(a) \;=\; \frac{1}{\,1 + \displaystyle\sum_{b\,\in\,Att(a)} \omega_{c(b)} \cdot \sigma(b)\,}` },
      { note: 'An attacker b with low dimension weight ω has less power to reduce σ(a). Solved iteratively until convergence.' },
    ]);

    // ── Block 2 : Final score ────────────────────────────
    const isBalanced = Math.abs(sliderV - 0.5) < 0.005;
    const finalTex = isBalanced
      ? String.raw`\overline{\sigma} \;=\; \frac{1}{|\mathcal{C}|} \sum_{c\,\in\,\mathcal{C}} \mu_c`
      : String.raw`\overline{\sigma} \;=\; \frac{\displaystyle\sum_{c\,\in\,\mathcal{C}} \omega_c \cdot \mu_c}{\displaystyle\sum_{c\,\in\,\mathcal{C}} \omega_c}`;

    addBlock('Final score', [
      { tex: finalTex },
      { note: isBalanced
          ? 'Equal-weight average of all dimension means (balanced).'
          : 'Weighted average: dimensions with higher ω contribute more to the final score.' },
    ]);

    // ── Block 3 : Notation ───────────────────────────────
    addBlock('Notation', [
      { tex: String.raw`a, b \in \mathcal{A}` },
      { note: 'arguments in the graph' },
      { tex: String.raw`Att(a)` },
      { note: 'set of arguments that attack a' },
      { tex: String.raw`c(a) \in \mathcal{C}` },
      { note: 'ethical dimension (category) of a' },
      { tex: String.raw`\sigma(a) \in [0, 1]` },
      { note: 'gradual acceptability score of a' },
      { tex: String.raw`\omega_c \in [0, 1]` },
      { note: 'importance weight of dimension c' },
      { tex: String.raw`\mu_c` },
      { note: 'mean score of arguments in dimension c' },
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

    const related = new Set([d.id, ...d.attacks, ...d.attackedBy]);
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

  /* ── Init ─────────────────────────────────────────────── */
  initImportanceSlider();
  recalculate();

  // Render formula (KaTeX may load async)
  if (typeof katex !== 'undefined') {
    renderFormula();
  } else {
    window.addEventListener('load', renderFormula);
  }
}