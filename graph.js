/* ============================================================
   graph.js — D3 force-directed graph renderer
   ============================================================ */

const GRAPH_CONFIG = {
  nodeRadius:       40,
  labelFontSize:    17,
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
    supports:    [...(n.supports    || [])],
    influences:  [...(n.influences  || [])],
    inactive: (n.cat === 'state') ? false : ((n.cat !== 'action') ? !!n.inactive : true),
  }));

  const links = [];

  function parseLinks() {
    links.length = 0;
    nodes.forEach(n => {
      (n.attacks || []).forEach(targetId => {
        if (typeof targetId === 'string')
          links.push({ source: n.id, target: targetId, type: 'attack' });
      });
      (n.supports || []).forEach(targetId => {
        if (typeof targetId === 'string')
          links.push({ source: n.id, target: targetId, type: 'support' });
      });
      (n.influences || []).forEach(attr => {
        links.push({ source: n.id, target: attr.id, type: 'influence', conditionId: attr.conditionId });
      });
    });
  }
  parseLinks();

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
    const scoreSize = 10 / k;
    const lineGap   = 13 / k;

    g.selectAll('.node .node-label').attr('font-size', labelSize + 'px');
    g.selectAll('.node').each(function() {
      const lines = d3.select(this).selectAll('.node-label');
      const n     = lines.size();
      lines.attr('y', (_, i) => (i - (n - 1) / 2) * lineGap);
    });
    g.selectAll('.node .node-id').attr('font-size', idSize + 'px').attr('y', -(GRAPH_CONFIG.nodeRadius + 6) / k);
    g.selectAll('.node .node-score').attr('font-size', scoreSize + 'px').attr('y', (GRAPH_CONFIG.nodeRadius + 14) / k);
    g.selectAll('.link-label').attr('font-size', (11/k) + 'px');
  }

  /* ── Arrowhead markers ────────────────────────────────── */
  const defs = svgEl.append('defs');
  [
    { id: 'arrow-attack',    color: '#e05555' },
    { id: 'arrow-support',   color: '#4caf78' },
    { id: 'arrow-neutral',   color: '#ffffff' },
    { id: 'arrow-inactive',  color: '#555555' }
  ].forEach(({ id, color }) => {
    defs.append('marker')
      .attr('id', id).attr('viewBox', '0 -5 12 10').attr('refX', GRAPH_CONFIG.nodeRadius + 10).attr('refY', 0)
      .attr('markerUnits', 'userSpaceOnUse').attr('markerWidth', 12).attr('markerHeight', 10).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', color);
  });

  /* ── Groups ────────────────── */
  const linksGroup = g.append('g').attr('class', 'links-group');
  const nodesGroup = g.append('g').attr('class', 'nodes-group');

  /* ── Force simulation ─────────────────────────────────── */
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(GRAPH_CONFIG.linkDistance).strength(GRAPH_CONFIG.linkStrength))
    .force('charge', d3.forceManyBody().strength(GRAPH_CONFIG.chargeStrength))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(GRAPH_CONFIG.collideRadius));

  const drag = d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });

  let onNodeClick = () => {};

  function appendNodeVisuals(enter) {
    enter.append('circle').attr('class', 'node-bg').attr('r', GRAPH_CONFIG.nodeRadius).attr('fill', d => data.colors[d.cat] + '22').attr('stroke', d => data.colors[d.cat]);
    enter.append('circle').attr('class', 'score-ring').attr('r', GRAPH_CONFIG.nodeRadius).attr('fill', 'none').attr('stroke', d => data.colors[d.cat]).attr('stroke-opacity', 0.4).attr('stroke-width', 4)
      .attr('stroke-dasharray', d => { const circ = 2 * Math.PI * GRAPH_CONFIG.nodeRadius; return `${(d.score || 0) * circ} ${circ}`; }).attr('transform', 'rotate(-90)');
    enter.append('text').attr('class', 'node-score').attr('y', GRAPH_CONFIG.nodeRadius + 14).attr('font-size', '10px').attr('font-family', "'DM Mono', monospace").attr('fill', d => data.colors[d.cat]).attr('text-anchor', 'middle').text(d => (d.score || 0).toFixed(2));
    enter.each(function(d) {
      const el = d3.select(this); const lines = d.label.split('\n');
      lines.forEach((line, i) => { el.append('text').attr('class', 'node-label').attr('y', (i - (lines.length - 1) / 2) * 13).attr('font-size', GRAPH_CONFIG.labelFontSize + 'px').text(line); });
    });
    enter.append('text').attr('class', 'node-id').attr('y', -(GRAPH_CONFIG.nodeRadius + 6)).attr('font-family', "'DM Mono', monospace").attr('font-size', GRAPH_CONFIG.idFontSize + 'px').attr('fill', d => data.colors[d.cat]).attr('text-anchor', 'middle').text(d => d.id);
  }

  /* ── Color Interpolation ── */
  const colorInterp = d3.interpolateRgbBasis(['#e05555', '#ffffff', '#4caf78']);

  let linkSel, linkLabelSel, nodeSel;

  function updateGraph() {
    linkSel = linksGroup.selectAll('path.link').data(links, l => `${l.type}:${typeof l.source === 'object' ? l.source.id : l.source}->${typeof l.target === 'object' ? l.target.id : l.target}:${l.conditionId || ''}`)
      .join(
        enter => enter.append('path').attr('class', l => `link link-${l.type}`),
        update => update, exit => exit.remove()
      );

    linkLabelSel = linksGroup.selectAll('text.link-label').data(links.filter(l => l.type === 'influence'), l => `label:${l.source.id || l.source}->${l.target.id || l.target}:${l.conditionId}`)
      .join(
        enter => enter.append('text').attr('class', 'link-label').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px').attr('text-anchor', 'middle'),
        update => update, exit => exit.remove()
      );

    nodeSel = nodesGroup.selectAll('g.node').data(nodes, d => d.id).join(
        enter => {
          const grp = enter.append('g').attr('class', 'node'); appendNodeVisuals(grp); grp.call(drag);
          grp.on('click', (e, d) => { e.stopPropagation(); onNodeClick(d); });
          grp.on('contextmenu', (e, d) => { e.preventDefault(); e.stopPropagation(); if (d.cat === 'state') return; d.inactive = !d.inactive; updateInactiveVisuals(); if (onInactiveToggle) onInactiveToggle(); });
          return grp;
        },
        update => update, exit => exit.remove()
      );

    sim.nodes(nodes); sim.force('link').links(links); sim.alpha(0.3).restart();
    const currentK = d3.zoomTransform(svgEl.node()).k; rescaleText(currentK);
    updateLinkColors();
  }

  function updateLinkColors() {
    if (!linkSel) return;
    linkSel.each(function(l) {
      const el = d3.select(this);
      if (l.type === 'influence') {
        const isInv = l.conditionId.startsWith('!');
        const actualId = isInv ? l.conditionId.substring(1) : l.conditionId;
        const condNode = nodes.find(n => n.id === actualId);
        const stateVal = condNode ? (condNode.value || 0) : 0.5;
        
        const effectiveVal = isInv ? (1 - stateVal) : stateVal;
        const color = colorInterp(effectiveVal);
        
        el.style('stroke', color).attr('marker-end', effectiveVal > 0.6 ? 'url(#arrow-support)' : (effectiveVal < 0.4 ? 'url(#arrow-attack)' : 'url(#arrow-neutral)'));
      } else {
        el.attr('marker-end', l.type === 'support' ? 'url(#arrow-support)' : 'url(#arrow-attack)');
      }
    });

    if (linkLabelSel) {
      linkLabelSel.each(function(l) {
        const isInv = l.conditionId.startsWith('!');
        const actualId = isInv ? l.conditionId.substring(1) : l.conditionId;
        const condNode = nodes.find(n => n.id === actualId);
        const stateVal = condNode ? (condNode.value || 0) : 0.5;
        const effectiveVal = isInv ? (1 - stateVal) : stateVal;
        
        const labelText = isInv ? `NOT ${actualId}` : l.conditionId;
        d3.select(this).attr('fill', colorInterp(effectiveVal)).text(labelText);
      });
    }
  }

  function updateNodeScores() {
    if (!nodeSel) return;
    nodeSel.selectAll('.score-ring').transition().duration(500).attr('stroke-dasharray', d => { const circ = 2 * Math.PI * GRAPH_CONFIG.nodeRadius; return `${(d.score || 0) * circ} ${circ}`; });
    nodeSel.selectAll('.node-score').text(d => (d.score || 0).toFixed(2));
    updateLinkColors();
    const currentK = d3.zoomTransform(svgEl.node()).k; rescaleText(currentK);
  }

  function updateNodeVisuals() {
    if (!nodeSel) return;
    nodeSel.selectAll('.node-bg').attr('fill', d => data.colors[d.cat] + '22').attr('stroke', d => data.colors[d.cat]);
    nodeSel.selectAll('.score-ring').attr('stroke', d => data.colors[d.cat]);
    nodeSel.selectAll('.node-score').attr('fill', d => data.colors[d.cat]);
    nodeSel.selectAll('.node-id').attr('fill', d => data.colors[d.cat]).text(d => d.id);
    nodeSel.each(function(d) {
      const grp = d3.select(this); grp.selectAll('.node-label').remove();
      const lines = d.label.split('\n');
      lines.forEach((line, i) => { grp.append('text').attr('class', 'node-label').attr('font-size', GRAPH_CONFIG.labelFontSize + 'px').attr('y', (i - (lines.length - 1) / 2) * 13).text(line); });
    });
    updateInactiveVisuals();
    const currentK = d3.zoomTransform(svgEl.node()).k; rescaleText(currentK);
  }

  function updateInactiveVisuals() {
    if (!nodeSel) return;
    nodeSel.classed('node-inactive', d => !!d.inactive);
    nodeSel.selectAll('.node-bg').attr('fill', d => d.inactive ? '#33333322' : data.colors[d.cat] + '22').attr('stroke', d => d.inactive ? '#555555' : data.colors[d.cat]);
    nodeSel.selectAll('.score-ring').attr('stroke', d => d.inactive ? '#555555' : data.colors[d.cat]);
    nodeSel.selectAll('.node-score').attr('fill', d => d.inactive ? '#555555' : data.colors[d.cat]);
    nodeSel.selectAll('.node-id').attr('fill', d => d.inactive ? '#555555' : data.colors[d.cat]);
    if (linkSel) { linkSel.classed('link-inactive', l => l.source.inactive).attr('marker-end', l => l.source.inactive ? 'url(#arrow-inactive)' : (l.type === 'support' ? 'url(#arrow-support)' : 'url(#arrow-attack)')); }
    const currentK = d3.zoomTransform(svgEl.node()).k; rescaleText(currentK);
  }

  sim.on('tick', () => {
    if (!linkSel || !nodeSel) return;
    linkSel.attr('d', d => { const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, dr = Math.sqrt(dx * dx + dy * dy) * GRAPH_CONFIG.curvature; return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`; });
    if (linkLabelSel) { linkLabelSel.attr('x', d => (d.source.x + d.target.x) / 2).attr('y', d => (d.source.y + d.target.y) / 2 - 10); }
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  svgEl.on('click', () => onNodeClick(null));
  window.addEventListener('resize', () => { width = container.clientWidth; height = container.clientHeight; sim.force('center', d3.forceCenter(width / 2, height / 2)); sim.alpha(0.1).restart(); });

  function rebuildLinksForNode(nodeId, outgoingOnly = false) {
    for (let i = links.length - 1; i >= 0; i--) {
      const s = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
      const t = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
      if (s === nodeId || (!outgoingOnly && t === nodeId)) links.splice(i, 1);
    }
  }

  function addNode(nodeObj) {
    nodes.push(nodeObj);
    (nodeObj.attacks || []).forEach(t => links.push({ source: nodeObj.id, target: t, type: 'attack' }));
    (nodeObj.supports || []).forEach(t => links.push({ source: nodeObj.id, target: t, type: 'support' }));
    (nodeObj.influences || []).forEach(a => links.push({ source: nodeObj.id, target: a.id, type: 'influence', conditionId: a.conditionId }));
    updateGraph();
  }

  function updateNode(id, newData) {
    const node = nodes.find(n => n.id === id); if (!node) return;
    const idChanged = newData.id && newData.id !== id;
    rebuildLinksForNode(id, !idChanged);
    if (idChanged) {
      nodes.forEach(n => {
        if (n.id === id) return;
        ['attacks', 'supports'].forEach(k => { n[k] = (n[k] || []).map(x => x === id ? newData.id : x); });
        n.influences = (n.influences || []).map(x => { const copy = {...x}; if (copy.id === id) copy.id = newData.id; if (copy.conditionId === id) copy.conditionId = newData.id; return copy; });
      });
      links.forEach(l => {
        const tId = typeof l.target === 'object' ? l.target.id : l.target; if (tId === id) { if (typeof l.target === 'object') l.target.id = newData.id; else l.target = newData.id; }
        if (l.conditionId === id) l.conditionId = newData.id;
      });
    }
    Object.assign(node, newData);
    (node.attacks || []).forEach(t => links.push({ source: node.id, target: t, type: 'attack' }));
    (node.supports || []).forEach(t => links.push({ source: node.id, target: t, type: 'support' }));
    (node.influences || []).forEach(a => links.push({ source: node.id, target: a.id, type: 'influence', conditionId: a.conditionId }));
    updateGraph(); updateNodeVisuals();
  }

  function removeNode(id) {
    rebuildLinksForNode(id);
    nodes.forEach(n => {
      n.attacks = (n.attacks || []).filter(x => x !== id); n.supports = (n.supports || []).filter(x => x !== id);
      n.influences = (n.influences || []).filter(x => x.id !== id && x.conditionId !== id);
    });
    const idx = nodes.findIndex(n => n.id === id); if (idx !== -1) nodes.splice(idx, 1);
    updateGraph();
  }

  function exportJSON() {
    const attMap = {}, supMap = {}, infMap = {};
    nodes.forEach(n => { attMap[n.id] = []; supMap[n.id] = []; infMap[n.id] = []; });
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source; const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (l.type === 'attack') attMap[s].push(t); else if (l.type === 'support') supMap[s].push(t); else infMap[s].push({ id: t, conditionId: l.conditionId });
    });
    const blob = new Blob([JSON.stringify({ colors: data.colors, cats: data.cats, globalScores: data.globalScores, nodes: nodes.map(n => ({ id: n.id, label: n.label, cat: n.cat, score: n.score, desc: n.desc, attacks: attMap[n.id], supports: supMap[n.id], influences: infMap[n.id], value: n.value })) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'graph.json'; a.click(); URL.revokeObjectURL(url);
  }

  updateGraph();
  return { svgEl, g, zoom, sim, nodes, links, updateGraph, updateNodeScores, updateNodeVisuals, updateInactiveVisuals, addNode, updateNode, removeNode, exportJSON, data, getNodeSel: () => nodeSel, getLinkSel: () => linkSel, setOnNodeClick: fn => { onNodeClick = fn; }, setOnInactiveToggle: fn => { onInactiveToggle = fn; } };
}