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
  chargeStrength:  -130,
  collideRadius:    80,
  zoomMin:          0.3,
  zoomMax:          3.0,
  curvature:        0.0,
};

function initGraph(data) {

  /* ── Working data arrays ──────────────────────────────── */
  // Deep-copy so mutations don't touch the source JSON object
  const nodes = data.nodes.map(n => ({ ...n,
    attacks:    [...n.attacks],
    attackedBy: [...n.attackedBy],
  }));

  // Derive links from nodes[].attacks
  const links = [];
  nodes.forEach(n => {
    n.attacks.forEach(tgtId => {
      links.push({ source: n.id, target: tgtId });
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
  [{ id: 'arrow', color: '#e05555' }, { id: 'arrow-hi', color: '#ff6b6b' }]
    .forEach(({ id, color }) => {
      defs.append('marker')
        .attr('id',           id)
        .attr('viewBox',      '0 -5 10 10')
        .attr('refX',         GRAPH_CONFIG.nodeRadius - 2)
        .attr('refY',         0)
        .attr('markerWidth',  6)
        .attr('markerHeight', 6)
        .attr('orient',       'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color);
    });

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
  // Called on initial render and after every mutation.
  let linkSel, nodeSel;

  function updateGraph() {
    // ── Links ──────────────────────────────────────────── //
    linkSel = linksGroup
      .selectAll('path.link')
      .data(links, l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return `${s}->${t}`;
      })
      .join(
        enter  => enter.append('path').attr('class', 'link').attr('marker-end', 'url(#arrow)'),
        update => update,
        exit   => exit.remove()
      );

    // ── Nodes ──────────────────────────────────────────── //
    nodeSel = nodesGroup
      .selectAll('g.node')
      .data(nodes, d => d.id)
      .join(
        enter => {
          const grp = enter.append('g').attr('class', 'node');
          appendNodeVisuals(grp);
          grp.call(drag);
          grp.on('click', (e, d) => { e.stopPropagation(); onNodeClick(d); });
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

  /* ── addNode: public API ──────────────────────────────── */
  function addNode(nodeObj) {
    // Ensure arrays exist
    nodeObj.attacks    = nodeObj.attacks    || [];
    nodeObj.attackedBy = nodeObj.attackedBy || [];

    // Add node to working array
    nodes.push(nodeObj);

    // Add outgoing attack links (this node → targets)
    nodeObj.attacks.forEach(tgtId => {
      links.push({ source: nodeObj.id, target: tgtId });
      // Update target's attackedBy
      const tgt = nodes.find(n => n.id === tgtId);
      if (tgt && !tgt.attackedBy.includes(nodeObj.id)) tgt.attackedBy.push(nodeObj.id);
    });

    // Add incoming attack links (sources → this node)
    nodeObj.attackedBy.forEach(srcId => {
      // Only add link if not already added via attacks
      const alreadyExists = links.some(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === srcId && t === nodeObj.id;
      });
      if (!alreadyExists) {
        links.push({ source: srcId, target: nodeObj.id });
      }
      // Update source's attacks
      const src = nodes.find(n => n.id === srcId);
      if (src && !src.attacks.includes(nodeObj.id)) src.attacks.push(nodeObj.id);
    });

    updateGraph();
  }

  /* ── updateNode: public API ──────────────────────────── */
  function updateNode(id, newData) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // 1. Remove all existing links that involve this node
    for (let i = links.length - 1; i >= 0; i--) {
      const s = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
      const t = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
      if (s === id || t === id) links.splice(i, 1);
    }

    // 2. Clean up stale references in other nodes
    nodes.forEach(n => {
      if (n.id === id) return;
      n.attacks    = n.attacks.filter(x => x !== id);
      n.attackedBy = n.attackedBy.filter(x => x !== id);
    });

    // 3. Apply new data to the node object
    Object.assign(node, newData);

    // 4. Re-add outgoing links (this node attacks →)
    node.attacks.forEach(tgtId => {
      links.push({ source: node.id, target: tgtId });
      const tgt = nodes.find(n => n.id === tgtId);
      if (tgt && !tgt.attackedBy.includes(node.id)) tgt.attackedBy.push(node.id);
    });

    // 5. Re-add incoming links (← attacked by)
    node.attackedBy.forEach(srcId => {
      const alreadyExists = links.some(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === srcId && t === node.id;
      });
      if (!alreadyExists) links.push({ source: srcId, target: node.id });
      const src = nodes.find(n => n.id === srcId);
      if (src && !src.attacks.includes(node.id)) src.attacks.push(node.id);
    });

    updateGraph();
  }

  /* ── removeNode: public API ──────────────────────────── */
  function removeNode(id) {
    // Remove all links that involve this node (splice in reverse to be safe)
    for (let i = links.length - 1; i >= 0; i--) {
      const s = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
      const t = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
      if (s === id || t === id) links.splice(i, 1);
    }

    // Clean up references in other nodes' attacks / attackedBy lists
    nodes.forEach(n => {
      n.attacks    = n.attacks.filter(x => x !== id);
      n.attackedBy = n.attackedBy.filter(x => x !== id);
    });

    // Remove the node itself
    const idx = nodes.findIndex(n => n.id === id);
    if (idx !== -1) nodes.splice(idx, 1);

    updateGraph();
  }

  /* ── exportJSON: serialise current graph state ───────── */
  function exportJSON() {
    // Re-derive clean attacks / attackedBy from the live links array
    // (link.source / link.target may be d3 node objects at this point)
    const attacksMap    = {};
    const attackedByMap = {};
    nodes.forEach(n => { attacksMap[n.id] = []; attackedByMap[n.id] = []; });
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (!attacksMap[s].includes(t))    attacksMap[s].push(t);
      if (!attackedByMap[t].includes(s)) attackedByMap[t].push(s);
    });

    const exportData = {
      colors:       data.colors,
      cats:         data.cats,
      globalScores: data.globalScores,
      nodes: nodes.map(n => ({
        id:         n.id,
        label:      n.label,
        cat:        n.cat,
        score:      n.score,
        desc:       n.desc,
        attacks:    attacksMap[n.id]    || [],
        attackedBy: attackedByMap[n.id] || [],
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
    addNode,
    updateNode,
    removeNode,
    exportJSON,
    data,
    getNodeSel: () => nodeSel,
    getLinkSel: () => linkSel,
    setOnNodeClick: fn => { onNodeClick = fn; },
  };
}