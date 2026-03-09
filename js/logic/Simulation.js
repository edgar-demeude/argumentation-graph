/**
 * @fileoverview Logic for the spatial simulation on the grid (via Backend).
 */

export class Simulation {
  constructor(canvasId, dashboardId, state) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.dashboard = document.getElementById(dashboardId);
    this.state = state; 
    this.apiUrl = 'http://localhost:8000';

    this.gridSize = 20;
    this.currentStep = 0;
    this.maxSteps = 50;
    this.isRunning = false;
    this.agents = [];
    this.scores = {}; 

    this.timer = null;
  }

  async init(numAgents, maxSteps, gridSize) {
    this.gridSize = gridSize;
    this.maxSteps = maxSteps;
    this.isRunning = false;

    const res = await fetch(`${this.apiUrl}/simulation/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numAgents, maxSteps, gridSize })
    });
    const data = await res.json();
    this.applyStepData(data);
  }

  start() {
    this.isRunning = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(async () => {
      if (this.currentStep < this.maxSteps) {
        await this.step();
      } else {
        this.stop();
      }
    }, 200);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
  }

  async step() {
    const res = await fetch(`${this.apiUrl}/simulation/step`, { method: 'POST' });
    const data = await res.json();
    this.applyStepData(data);
    // Also refresh graph scores from the server
    await this.state.recalculate();
  }

  async previous() {
    this.stop();
    const res = await fetch(`${this.apiUrl}/simulation/previous`, { method: 'POST' });
    const data = await res.json();
    this.applyStepData(data);
    await this.state.recalculate();
  }

  next() {
    this.stop();
    this.step();
  }

  applyStepData(data) {
    this.currentStep = data.step;
    this.agents = data.agents;
    this.scores = data.scores;
    this.updateUI();
    this.render();
  }

  updateUI() {
    this.updateDashboard();
    const stepEl = document.getElementById('current-step');
    const totalEl = document.getElementById('total-steps');
    if (stepEl) stepEl.textContent = this.currentStep;
    if (totalEl) totalEl.textContent = this.maxSteps;
  }

  updateDashboard() {
    if (!this.dashboard) return;
    const stateNodes = this.state.nodes.filter(n => n.cat === 'state');
    
    this.dashboard.innerHTML = stateNodes.map(node => {
      const score = this.scores[node.id] || 0;
      return `
        <div class="state-badge">
          <span class="state-badge-label">${node.label.replace(/\n/g, ' ')}</span>
          <span class="state-badge-val" style="color:${this.state.colors[node.cat]}">${(score * 100).toFixed(0)}%</span>
        </div>
      `;
    }).join('');
  }

  render() {
    const container = document.getElementById('grid-canvas-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvas.width = width;
    this.canvas.height = height;

    const padding = 20;
    const availableSize = Math.min(width, height) - padding * 2;
    const cellSize = availableSize / this.gridSize;
    const gridPixelSize = cellSize * this.gridSize;
    const offsetX = (width - gridPixelSize) / 2;
    const offsetY = (height - gridPixelSize) / 2;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(offsetX, offsetY, gridPixelSize, gridPixelSize);

    this.ctx.strokeStyle = '#363636';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.gridSize; i++) {
      const pos = i * cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX + pos, offsetY);
      this.ctx.lineTo(offsetX + pos, offsetY + gridPixelSize);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX, offsetY + pos);
      this.ctx.lineTo(offsetX + gridPixelSize, offsetY + pos);
      this.ctx.stroke();
    }

    this.agents.forEach(agent => {
      this.ctx.fillStyle = agent.color;
      this.ctx.beginPath();
      this.ctx.arc(offsetX + (agent.x + 0.5) * cellSize, offsetY + (agent.y + 0.5) * cellSize, cellSize * 0.35, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }
}
