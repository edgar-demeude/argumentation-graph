/**
 * @fileoverview Handles D3.js force-directed graph rendering.
 */

import { GRAPH_CONFIG, COLORS, NODE_SHAPES } from '../utils/Constants.js';

const getShapePath = (type, r) => {
  if (type === NODE_SHAPES.STATE) {
    // Start at top: (0, -r)
    return `M0,-${r} L${r},0 L0,${r} L-${r},0 Z`;
  }
  if (type === NODE_SHAPES.BELIEF) {
    // Start at top: 270 degrees (or -90)
    let path = "";
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 90) * Math.PI / 180;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      path += (i === 0 ? "M" : "L") + x + "," + y;
    }
    return path + "Z";
  }
  // Default to circle (action) - Starting at (0, -r)
  return `M0,-${r} A${r},${r} 0 1,1 0,${r} A${r},${r} 0 1,1 0,-${r} Z`;
};

const getShapePerimeter = (type, r) => {
  if (type === NODE_SHAPES.STATE) return 4 * r * Math.sqrt(2);
  if (type === NODE_SHAPES.BELIEF) return 6 * r;
  return 2 * Math.PI * r;
};

const getNodeType = (cat) => {
  if (cat === 'action') return NODE_SHAPES.ACTION;
  if (cat === 'state') return NODE_SHAPES.STATE;
  return NODE_SHAPES.BELIEF;
};

export class GraphRenderer {
  /**
   * @param {string} svgSelector - Selector for the SVG element.
   * @param {string} containerSelector - Selector for the graph container.
   * @param {GraphState} graphState - The graph state to render.
   */
  constructor(svgSelector, containerSelector, graphState) {
    this.svg = d3.select(svgSelector);
    this.container = document.querySelector(containerSelector);
    this.state = graphState;

    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    this.g = this.svg.append('g');
    this.linksGroup = this.g.append('g').attr('class', 'links-group');
    this.nodesGroup = this.g.append('g').attr('class', 'nodes-group');

    this.initZoom();
    this.initMarkers();
    this.initSimulation();
    this.initEvents();
  }

  /**
   * Initializes D3 zoom behavior.
   */
  initZoom() {
    this.zoom = d3.zoom()
      .scaleExtent([GRAPH_CONFIG.zoomMin, GRAPH_CONFIG.zoomMax])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
        this.rescaleText(event.transform.k);
      });

    this.svg.call(this.zoom);
  }

  /**
   * Rescales labels and IDs based on zoom level to maintain readability.
   */
  rescaleText(k) {
    const labelSize = GRAPH_CONFIG.labelFontSize / k;
    const idSize = GRAPH_CONFIG.idFontSize / k;
    const scoreSize = 10 / k;
    const lineGap = 13 / k;

    this.g.selectAll('.node-label').attr('font-size', labelSize + 'px');
    this.g.selectAll('.node').each(function() {
      const lines = d3.select(this).selectAll('.node-label');
      const n = lines.size();
      lines.attr('y', (_, i) => (i - (n - 1) / 2) * lineGap);
    });
    this.g.selectAll('.node-id').attr('font-size', idSize + 'px')
      .attr('y', -(GRAPH_CONFIG.nodeRadius + 6 / k));
    this.g.selectAll('.node-score').attr('font-size', scoreSize + 'px')
      .attr('y', (GRAPH_CONFIG.nodeRadius + 14 / k));
  }

  /**
   * Initializes arrowhead markers.
   */
  initMarkers() {
    const defs = this.svg.append('defs');
    
    // Standard arrows
    const arrows = [
      { id: 'arrow-attack', color: COLORS.attack },
      { id: 'arrow-support', color: COLORS.support },
      { id: 'arrow-neutral', color: COLORS.neutral },
      { id: 'arrow-inactive', color: COLORS.inactive }
    ];

    arrows.forEach(({ id, color }) => {
      defs.append('marker')
        .attr('id', id).attr('viewBox', '0 -5 12 10')
        .attr('refX', GRAPH_CONFIG.nodeRadius + 10).attr('refY', 0)
        .attr('markerUnits', 'userSpaceOnUse').attr('markerWidth', 12).attr('markerHeight', 10)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', color);
    });
  }

  /**
   * Initializes D3 force simulation.
   */
  initSimulation() {
    this.simulation = d3.forceSimulation(this.state.nodes)
      .force('link', d3.forceLink(this.state.links)
        .id(d => d.id)
        .distance(GRAPH_CONFIG.linkDistance)
        .strength(GRAPH_CONFIG.linkStrength))
      .force('charge', d3.forceManyBody().strength(GRAPH_CONFIG.chargeStrength))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide(GRAPH_CONFIG.collideRadius));

    this.simulation.on('tick', () => {
      if (!this.linkSel || !this.nodeSel) return;
      
      this.linkSel.attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * GRAPH_CONFIG.curvature;
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      this.nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  /**
   * Initializes global events.
   */
  initEvents() {
    window.addEventListener('resize', () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
      this.simulation.alpha(0.1).restart();
    });

    this.svg.on('click', () => {
      this.state.selectedNodeId = null;
      this.state.onSelectionChange(null);
      this.updateVisuals();
    });
  }

  /**
   * Main update loop for the graph.
   */
  update() {
    this.updateDataBindings();
    this.updateVisuals();
    this.simulation.nodes(this.state.nodes);
    this.simulation.force('link').links(this.state.links);
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Updates D3 data bindings for links and nodes.
   */
  updateDataBindings() {
    // LINKS
    this.linkSel = this.linksGroup.selectAll('path.link')
      .data(this.state.links, l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return `${l.type}:${s}->${t}`;
      })
      .join(
        enter => enter.append('path').attr('class', l => `link link-${l.type}`),
        update => update,
        exit => exit.remove()
      );

    // NODES
    this.nodeSel = this.nodesGroup.selectAll('g.node')
      .data(this.state.nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g').attr('class', 'node');
          this.createNodeVisuals(g);
          this.applyDrag(g);
          
          g.on('click', (event, d) => {
            event.stopPropagation();
            this.state.selectedNodeId = d.id;
            this.state.onNodeClick(d);
            this.state.onSelectionChange(d);
            this.updateVisuals();
          });

          g.on('contextmenu', (event, d) => {
            event.preventDefault();
            event.stopPropagation();
            this.state.toggleNodeActive(d.id);
            this.updateVisuals();
          });

          return g;
        },
        update => update,
        exit => exit.remove()
      );
  }

  /**
   * Appends initial SVG elements for a node.
   */
  createNodeVisuals(g) {
    const r = GRAPH_CONFIG.nodeRadius;
    g.each(function(d) {
      const el = d3.select(this);
      const type = getNodeType(d.cat);
      const path = getShapePath(type, r);

      el.append('path')
        .attr('class', 'node-bg')
        .attr('d', path);
      
      el.append('path')
        .attr('class', 'score-ring')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 4);

      el.append('text').attr('class', 'node-score').attr('text-anchor', 'middle');
      el.append('text').attr('class', 'node-id').attr('text-anchor', 'middle');
    });
    
    // Labels (split by newline)
    this.updateNodeLabels(g);
  }

  updateNodeLabels(g) {
    g.each(function(d) {
      const el = d3.select(this);
      el.selectAll('.node-label').remove();
      const lines = d.label.split('\n');
      lines.forEach((line, i) => {
        el.append('text').attr('class', 'node-label').text(line);
      });
    });
  }

  /**
   * Updates visual properties (colors, text, highlight) without rebuilding bindings.
   */
  updateVisuals() {
    if (!this.nodeSel) return;

    const { selectedNodeId, colors: catColors } = this.state;
    const currentK = d3.zoomTransform(this.svg.node()).k;
    const r = GRAPH_CONFIG.nodeRadius;

    // Node updates
    this.nodeSel.each(function(d) {
      const g = d3.select(this);
      const isInactive = !!d.inactive;
      const isSelected = selectedNodeId === d.id;
      const catColor = catColors[d.cat];

      g.classed('node-inactive', isInactive);
      g.classed('selected', isSelected);

      const color = isInactive ? COLORS.inactive : catColor;
      const type = getNodeType(d.cat);
      const path = getShapePath(type, r);
      
      g.select('.node-bg')
        .attr('d', path)
        .attr('fill', color + '22')
        .attr('stroke', color);

      const peri = getShapePerimeter(type, r);
      const dash = `${(d.score || 0) * peri} ${peri}`;
      
      g.select('.score-ring')
        .attr('d', path)
        .attr('stroke', color)
        .attr('stroke-dasharray', dash);

      g.select('.node-score')
        .attr('fill', color)
        .text(d.cat === 'state' ? `${(d.score * 100).toFixed(0)}%` : (d.score || 0).toFixed(2));

      g.select('.node-id')
        .attr('fill', color)
        .text(d.id);
    });

    // Label refresh
    this.updateNodeLabels(this.nodeSel);

    // Links update
    this.updateLinkVisuals();
    
    // Dimming logic
    if (selectedNodeId) {
      const relatedIds = this.getRelatedNodeIds(selectedNodeId);
      this.nodeSel.classed('dimmed', n => !relatedIds.has(n.id));
      this.linkSel.classed('dimmed', l => l.source.id !== selectedNodeId && l.target.id !== selectedNodeId);
      this.linkSel.classed('highlighted', l => l.source.id === selectedNodeId || l.target.id === selectedNodeId);
    } else {
      this.nodeSel.classed('dimmed', false);
      this.linkSel.classed('dimmed', false);
      this.linkSel.classed('highlighted', false);
    }

    this.rescaleText(currentK);
  }

  updateLinkVisuals() {
    if (!this.linkSel) return;

    this.linkSel.each((l, i, nodes) => {
      const el = d3.select(nodes[i]);
      const source = l.source;
      const target = l.target;
      const isSourceInactive = source.inactive;
      const isTargetInactive = target.inactive;

      if (isSourceInactive || isTargetInactive) {
        el.style('stroke', null).attr('marker-end', 'url(#arrow-inactive)');
        el.classed('link-inactive', true);
        return;
      }
      
      el.classed('link-inactive', false);
      el.style('stroke', null).attr('marker-end', l.type === 'support' ? 'url(#arrow-support)' : 'url(#arrow-attack)');
    });
  }

  getRelatedNodeIds(nodeId) {
    const related = new Set([nodeId]);
    this.state.links.forEach(l => {
      if (l.source.id === nodeId) related.add(l.target.id);
      if (l.target.id === nodeId) related.add(l.source.id);
    });
    return related;
  }

  applyDrag(g) {
    const drag = d3.drag()
      .on('start', (e, d) => {
        if (!e.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (e, d) => {
        d.fx = e.x;
        d.fy = e.y;
      })
      .on('end', (e, d) => {
        if (!e.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    g.call(drag);
  }
}
