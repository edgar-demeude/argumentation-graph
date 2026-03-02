/* ============================================================
   graph.js — D3 force-directed graph renderer
   ============================================================
   Exports: initGraph(data) → graphState
   graphState exposes:
     nodes, links            — live arrays (mutate freely)
     addNode(nodeObj)        — add node + its links, redraw
     updateGraph()           — redraw after any mutation
     svgEl, g, zoom
     onNodeClick (callback)  — set by ui.js
   ============================================================ */

const GRAPH_CONFIG = {
  nodeRadius:       40,
  labelFontSize:    11,
  idFontSize:       10,
  linkDistance:     145,
  linkStrength:     0.5,
  chargeStrength:  -430,
  collideRadius:    68,
  zoomMin:          0.3,
  zoomMax:          3.0,
  curvature:        0,
};

function initGraph(data) {

  /* ── Working data arrays ──────────────────────────────── */
  const nodes = data.nodes.map(n => ({
    ...n,
    attacks:     [...(n.attacks    || [])],
    attackedBy:  [...(n.attackedBy || [])],
    supports:    [...(n.supports    || [])],
    supportedBy: [...(n.supportedBy || [])],
    inactive: (n.cat !== 'action') ? !!n.inactive : true,  // only action nodes are inactive
  }));

  // Derive links from nodes[].attacks and nodes[].supports
  // Each link has a `type` field: 'attack' | 'support'
  const links = [];

  nodes.forEach(n => {
    n.attacks.forEach(tgtId => {
      links.push({ source: n.id, target: tgtId, type: 'attack' });
    });
    n.supports.forEach(tgtId => {
      links.push({ source: n.id, target: tgtId, type: 'support' });
    });
  });

  /* ── SVG bootstrap ────────────────────────────────────── */
  const svgEl     = d3.select('#svg');
  const container = document.getElementById('graph-container');
  let   width     = container.clientWidth;
  let   height    = container.clientHeight;

  const g = svgEl.append('g');

  /* ── Zoom ─────────────────────────────────────────────── */
  const zoom = d3.zoom()
    .scaleExtent([GRAPH_CONFIG.zoomMin, GRAPH_CONFIG.zoomMax])
    .on('zoom', e => {
      g.attr('transform', e.transform);
      rescaleText(e.transform.k);
    });

  svgEl.call(zoom);

  function rescaleText(k) {
    const labelSize = GRAPH_CONFIG.labelFontSize / k;
    const idSize    = GRAPH_CONFIG.idFontSize    / k;
    const lineGap   = 13 / k;

    g.selectAll('.node .node-label').attr('font-size', labelSize + 'px');
    g.selectAll('.node').each(function() {
      const lines = d3.select(this).selectAll('.node-label');
      const n     = lines.size();
      lines.attr('y', (_, i) => (i - (n - 1) / 2) * lineGap);
    });
    g.selectAll('.node .node-id')
      .attr('font-size', idSize + 'px')
      .attr('y', -(GRAPH_CONFIG.nodeRadius + 6) / k);
  }

  /* ── Arrowhead markers ────────────────────────────────── */
  const defs = svgEl.append('defs');

  // Attack arrows — red
  [
    { id: 'arrow-attack',    color: '#e05555' },
    { id: 'arrow-attack-hi', color: '#ff6b6b' },
  ].forEach(({ id, color }) => {
    defs.append('marker')
      .attr('id',           id)
      .attr('viewBox',      '0 -5 12 10')
      .attr('refX',         GRAPH_CONFIG.nodeRadius + 10)  // tip (x=10) lands at circle edge
      .attr('refY',         0)
      .attr('markerUnits',  'userSpaceOnUse')
      .attr('markerWidth',  12)
      .attr('markerHeight', 10)
      .attr('orient',       'auto')
      .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', color);
  });

  // Support arrows — green
  [
    { id: 'arrow-support',    color: '#4caf78' },
    { id: 'arrow-support-hi', color: '#6ee89a' },
  ].forEach(({ id, color }) => {
    defs.append('marker')
      .attr('id',           id)
      .attr('viewBox',      '0 -5 12 10')
      .attr('refX',         GRAPH_CONFIG.nodeRadius + 10)  // tip (x=10) lands at circle edge
      .attr('refY',         0)
      .attr('markerUnits',  'userSpaceOnUse')
      .attr('markerWidth',  12)
      .attr('markerHeight', 10)
      .attr('orient',       'auto')
      .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', color);
  });

  defs.append('marker')
    .attr('id',           'arrow-inactive')
    .attr('viewBox',      '0 -5 12 10')
    .attr('refX',         GRAPH_CONFIG.nodeRadius + 10)
    .attr('refY',         0)
    .attr('markerUnits',  'userSpaceOnUse')
    .attr('markerWidth',  12)
    .attr('markerHeight', 10)
    .attr('orient',       'auto')
    .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', '#555555');

  /* ── Groups (links drawn under nodes) ────────────────── */
  const linksGroup = g.append('g').attr('class', 'links-group');
  const nodesGroup = g.append('g').attr('class', 'nodes-group');

  /* ── Force simulation ─────────────────────────────────── */
  const sim = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(links).id(d => d.id)
                          .distance(GRAPH_CONFIG.linkDistance)
                          .strength(GRAPH_CONFIG.linkStrength))
    .force('charge',    d3.forceManyBody().strength(GRAPH_CONFIG.chargeStrength))
    .force('center',    d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(GRAPH_CONFIG.collideRadius));

  /* ── Drag behaviour ───────────────────────────────────── */
  const drag = d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });

  /* ── onNodeClick callback slot (set by ui.js) ─────────── */
  let onNodeClick = () => {};

  /* ── Helper: append all visuals to an entering node group */
  function appendNodeVisuals(enter) {
    // Background fill
    enter.append('circle')
      .attr('class',  'node-bg')
      .attr('r',      GRAPH_CONFIG.nodeRadius)
      .attr('fill',   d => data.colors[d.cat] + '22')
      .attr('stroke', d => data.colors[d.cat]);

    // Score progress ring
    enter.append('circle')
      .attr('class',            'score-ring')
      .attr('r',                GRAPH_CONFIG.nodeRadius)
      .attr('fill',             'none')
      .attr('stroke',           d => data.colors[d.cat])
      .attr('stroke-opacity',   0.4)
      .attr('stroke-width',     4)
      .attr('stroke-dasharray', d => {
        const circ = 2 * Math.PI * GRAPH_CONFIG.nodeRadius;
        return `${(d.score || 0) * circ} ${circ}`;
      })
      .attr('transform', 'rotate(-90)');

    // Score text below node
    enter.append('text')
      .attr('class', 'node-score')
      .attr('y', GRAPH_CONFIG.nodeRadius + 14)
      .attr('font-size', '10px')
      .attr('font-family', "'DM Mono', monospace")
      .attr('fill', d => data.colors[d.cat])
      .attr('text-anchor', 'middle')
      .text(d => (d.score || 0).toFixed(2));

    // Multi-line label
    enter.each(function(d) {
      const el    = d3.select(this);
      const lines = d.label.split('\n');
      lines.forEach((line, i) => {
        el.append('text')
          .attr('class',     'node-label')
          .attr('y',         (i - (lines.length - 1) / 2) * 13)
          .attr('font-size', GRAPH_CONFIG.labelFontSize + 'px')
          .text(line);
      });
    });

    // ID badge above
    enter.append('text')
      .attr('class',       'node-id')
      .attr('y',           -(GRAPH_CONFIG.nodeRadius + 6))
      .attr('font-family', "'DM Mono', monospace")
      .attr('font-size',   GRAPH_CONFIG.idFontSize + 'px')
      .attr('fill',        d => data.colors[d.cat])
      .attr('text-anchor', 'middle')
      .text(d => d.id);
  }

  /* ── Core render / update function ───────────────────── */
  let linkSel, nodeSel;

  function updateGraph() {
    // ── Links ──────────────────────────────────────────── //
    linkSel = linksGroup
      .selectAll('path.link')
      .data(links, l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return `${l.type}:${s}->${t}`;
      })
      .join(
        enter => enter.append('path')
          .attr('class', l => `link link-${l.type}`)
          .attr('marker-end', l => l.type === 'support' ? 'url(#arrow-support)' : 'url(#arrow-attack)'),
        update => update,
        exit   => exit.remove()
      );

    linkSel
      .classed('link-inactive', l => l.source.inactive)
      .attr('marker-end', l => {
        if (l.source.inactive) return 'url(#arrow-inactive)';
        return l.type === 'support' ? 'url(#arrow-support)' : 'url(#arrow-attack)';
      });

    // ── Nodes ──────────────────────────────────────────── //
    nodeSel = nodesGroup
      .selectAll('g.node')
      .data(nodes, d => d.id)
      .join(
        enter => {
          const grp = enter.append('g').attr('class', 'node');
          appendNodeVisuals(grp);
          grp.call(drag);

          // Single click — select
          grp.on('click', (e, d) => { e.stopPropagation(); onNodeClick(d); });

          // Right-click — toggle inactive (action nodes only)
          grp.on('contextmenu', (e, d) => {
            e.preventDefault();
            e.stopPropagation();
            if (d.cat !== 'action') return;
            d.inactive = !d.inactive;
            updateInactiveVisuals();
            if (onInactiveToggle) onInactiveToggle();
          });

          return grp;
        },
        update => update,
        exit   => exit.remove()
      );

    // ── Sync simulation ────────────────────────────────── //
    sim.nodes(nodes);
    sim.force('link').links(links);
    sim.alpha(0.3).restart();
  }

  /* ── updateNodeScores: update score rings and text ───── */
  function updateNodeScores() {
    if (!nodeSel) return;

    nodeSel.selectAll('.score-ring')
      .transition().duration(500)
      .attr('stroke-dasharray', d => {
        const circ = 2 * Math.PI * GRAPH_CONFIG.nodeRadius;
        return `${(d.score || 0) * circ} ${circ}`;
      });

    nodeSel.selectAll('.node-score')
      .text(d => (d.score || 0).toFixed(2));
  }

  /* ── updateNodeVisuals: refresh all visual attrs on existing nodes ── */
  function updateNodeVisuals() {
    if (!nodeSel) return;

    nodeSel.selectAll('.node-bg')
      .attr('fill',   d => data.colors[d.cat] + '22')
      .attr('stroke', d => data.colors[d.cat]);

    nodeSel.selectAll('.score-ring')
      .attr('stroke', d => data.colors[d.cat]);

    nodeSel.selectAll('.node-score')
      .attr('fill', d => data.colors[d.cat]);

    nodeSel.selectAll('.node-id')
      .attr('fill', d => data.colors[d.cat])
      .text(d => d.id);

    nodeSel.each(function(d) {
      const grp = d3.select(this);
      grp.selectAll('.node-label').remove();
      const lines = d.label.split('\n');
      lines.forEach((line, i) => {
        grp.append('text')
          .attr('class',     'node-label')
          .attr('font-size', GRAPH_CONFIG.labelFontSize + 'px')
          .attr('y',         (i - (lines.length - 1) / 2) * 13)
          .text(line);
      });
    });

    updateInactiveVisuals();
  }

  /* ── updateInactiveVisuals: apply/remove gray-out for inactive actions */
  function updateInactiveVisuals() {
    if (!nodeSel) return;
    nodeSel.classed('node-inactive', d => !!d.inactive);

    nodeSel.selectAll('.node-bg')
      .attr('fill',   d => d.inactive ? '#33333322' : data.colors[d.cat] + '22')
      .attr('stroke', d => d.inactive ? '#555555'   : data.colors[d.cat]);

    nodeSel.selectAll('.score-ring')
      .attr('stroke', d => d.inactive ? '#555555' : data.colors[d.cat]);

    nodeSel.selectAll('.node-score')
      .attr('fill', d => d.inactive ? '#555555' : data.colors[d.cat]);

    nodeSel.selectAll('.node-id')
      .attr('fill', d => d.inactive ? '#555555' : data.colors[d.cat]);

    if (linkSel) {
      linkSel
        .classed('link-inactive', l => l.source.inactive)
        .attr('marker-end', l => {
          if (l.source.inactive) return 'url(#arrow-inactive)';
          return l.type === 'support' ? 'url(#arrow-support)' : 'url(#arrow-attack)';
        });
    }
  }

  /* ── Callback slot for inactive toggle (set by ui.js) ── */
  let onInactiveToggle = null;

  /* ── Tick ─────────────────────────────────────────────── */
  sim.on('tick', () => {
    if (!linkSel || !nodeSel) return;
    linkSel.attr('d', d => {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy) * GRAPH_CONFIG.curvature;
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    });
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  /* ── Background click = deselect ─────────────────────── */
  svgEl.on('click', () => onNodeClick(null));

  /* ── Resize ───────────────────────────────────────────── */
  window.addEventListener('resize', () => {
    width  = container.clientWidth;
    height = container.clientHeight;
    sim.force('center', d3.forceCenter(width / 2, height / 2));
    sim.alpha(0.1).restart();
  });

  /* ── Helper: rebuild all links for a given node ──────── */
  function rebuildLinksForNode(nodeId) {
    // Remove all existing links for this node
    for (let i = links.length - 1; i >= 0; i--) {
      const s = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
      const t = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
      if (s === nodeId || t === nodeId) links.splice(i, 1);
    }
  }

  function linkExists(s, t, type) {
    return links.some(l => {
      const ls = typeof l.source === 'object' ? l.source.id : l.source;
      const lt = typeof l.target === 'object' ? l.target.id : l.target;
      return ls === s && lt === t && l.type === type;
    });
  }

  /* ── addNode: public API ──────────────────────────────── */
  function addNode(nodeObj) {
    nodeObj.attacks     = nodeObj.attacks     || [];
    nodeObj.attackedBy  = nodeObj.attackedBy  || [];
    nodeObj.supports    = nodeObj.supports    || [];
    nodeObj.supportedBy = nodeObj.supportedBy || [];
    nodeObj.inactive    = false;

    nodes.push(nodeObj);

    nodeObj.attacks.forEach(tgtId => {
      links.push({ source: nodeObj.id, target: tgtId, type: 'attack' });
      const tgt = nodes.find(n => n.id === tgtId);
      if (tgt && !tgt.attackedBy.includes(nodeObj.id)) tgt.attackedBy.push(nodeObj.id);
    });

    nodeObj.attackedBy.forEach(srcId => {
      if (!linkExists(srcId, nodeObj.id, 'attack'))
        links.push({ source: srcId, target: nodeObj.id, type: 'attack' });
      const src = nodes.find(n => n.id === srcId);
      if (src && !src.attacks.includes(nodeObj.id)) src.attacks.push(nodeObj.id);
    });

    nodeObj.supports.forEach(tgtId => {
      links.push({ source: nodeObj.id, target: tgtId, type: 'support' });
      const tgt = nodes.find(n => n.id === tgtId);
      if (tgt && !tgt.supportedBy.includes(nodeObj.id)) tgt.supportedBy.push(nodeObj.id);
    });

    nodeObj.supportedBy.forEach(srcId => {
      if (!linkExists(srcId, nodeObj.id, 'support'))
        links.push({ source: srcId, target: nodeObj.id, type: 'support' });
      const src = nodes.find(n => n.id === srcId);
      if (src && !src.supports.includes(nodeObj.id)) src.supports.push(nodeObj.id);
    });

    updateGraph();
  }

  /* ── updateNode: public API ──────────────────────────── */
  function updateNode(id, newData) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // 1. Remove all existing links for this node
    rebuildLinksForNode(id);

    // 2. Clean up stale references in other nodes
    nodes.forEach(n => {
      if (n.id === id) return;
      n.attacks     = n.attacks.filter(x => x !== id);
      n.attackedBy  = n.attackedBy.filter(x => x !== id);
      n.supports    = n.supports.filter(x => x !== id);
      n.supportedBy = n.supportedBy.filter(x => x !== id);
    });

    // 3. Apply new data
    Object.assign(node, {
      ...newData,
      supports:    newData.supports    || [],
      supportedBy: newData.supportedBy || [],
    });

    // 4. Re-add attack links
    node.attacks.forEach(tgtId => {
      links.push({ source: node.id, target: tgtId, type: 'attack' });
      const tgt = nodes.find(n => n.id === tgtId);
      if (tgt && !tgt.attackedBy.includes(node.id)) tgt.attackedBy.push(node.id);
    });

    node.attackedBy.forEach(srcId => {
      if (!linkExists(srcId, node.id, 'attack'))
        links.push({ source: srcId, target: node.id, type: 'attack' });
      const src = nodes.find(n => n.id === srcId);
      if (src && !src.attacks.includes(node.id)) src.attacks.push(node.id);
    });

    // 5. Re-add support links
    node.supports.forEach(tgtId => {
      links.push({ source: node.id, target: tgtId, type: 'support' });
      const tgt = nodes.find(n => n.id === tgtId);
      if (tgt && !tgt.supportedBy.includes(node.id)) tgt.supportedBy.push(node.id);
    });

    node.supportedBy.forEach(srcId => {
      if (!linkExists(srcId, node.id, 'support'))
        links.push({ source: srcId, target: node.id, type: 'support' });
      const src = nodes.find(n => n.id === srcId);
      if (src && !src.supports.includes(node.id)) src.supports.push(node.id);
    });

    updateGraph();
    updateNodeVisuals();
  }

  /* ── removeNode: public API ──────────────────────────── */
  function removeNode(id) {
    rebuildLinksForNode(id);

    nodes.forEach(n => {
      n.attacks     = n.attacks.filter(x => x !== id);
      n.attackedBy  = n.attackedBy.filter(x => x !== id);
      n.supports    = n.supports.filter(x => x !== id);
      n.supportedBy = n.supportedBy.filter(x => x !== id);
    });

    const idx = nodes.findIndex(n => n.id === id);
    if (idx !== -1) nodes.splice(idx, 1);

    updateGraph();
  }

  /* ── exportJSON: serialise current graph state ───────── */
  function exportJSON() {
    const attacksMap    = {};
    const attackedByMap = {};
    const supportsMap   = {};
    const supportedByMap = {};
    nodes.forEach(n => {
      attacksMap[n.id]    = [];
      attackedByMap[n.id] = [];
      supportsMap[n.id]   = [];
      supportedByMap[n.id] = [];
    });

    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (l.type === 'support') {
        if (!supportsMap[s].includes(t))    supportsMap[s].push(t);
        if (!supportedByMap[t].includes(s)) supportedByMap[t].push(s);
      } else {
        if (!attacksMap[s].includes(t))    attacksMap[s].push(t);
        if (!attackedByMap[t].includes(s)) attackedByMap[t].push(s);
      }
    });

    const exportData = {
      colors:       data.colors,
      cats:         data.cats,
      globalScores: data.globalScores,
      nodes: nodes.map(n => ({
        id:          n.id,
        label:       n.label,
        cat:         n.cat,
        score:       n.score,
        desc:        n.desc,
        attacks:     attacksMap[n.id]    || [],
        attackedBy:  attackedByMap[n.id] || [],
        supports:    supportsMap[n.id]   || [],
        supportedBy: supportedByMap[n.id] || [],
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'argumentation_graph.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Initial render ───────────────────────────────────── */
  updateGraph();

  /* ── Expose state ─────────────────────────────────────── */
  return {
    svgEl, g, zoom, sim,
    nodes, links,
    updateGraph,
    updateNodeScores,
    updateNodeVisuals,
    updateInactiveVisuals,
    addNode,
    updateNode,
    removeNode,
    exportJSON,
    data,
    getNodeSel:           () => nodeSel,
    getLinkSel:           () => linkSel,
    setOnNodeClick:       fn => { onNodeClick = fn; },
    setOnInactiveToggle:  fn => { onInactiveToggle = fn; },
  };
}