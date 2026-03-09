/**
 * @fileoverview Logic for the spatial simulation on the grid.
 */

export class Simulation {
  constructor(canvasId, dashboardId, state) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.dashboard = document.getElementById(dashboardId);
    this.state = state; 

    this.gridSize = 20;
    this.numAgents = 10;
    this.maxSteps = 50;
    this.currentStep = 0;
    this.isRunning = false;
    this.agents = [];
    this.history = []; // Stores { agents, scores } for each step

    this.timer = null;
  }

  /**
   * Initializes the simulation with given parameters.
   */
  init(numAgents, maxSteps, gridSize) {
    this.numAgents = numAgents;
    this.maxSteps = maxSteps;
    this.gridSize = gridSize;
    this.currentStep = 0;
    this.history = [];
    this.isRunning = false;

    // Initial agents
    this.agents = [];
    for (let i = 0; i < this.numAgents; i++) {
      this.agents.push({
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize),
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      });
    }

    // Save initial state (Step 0)
    this.saveToHistory();
    this.updateUI();
    this.render();
  }

  saveToHistory() {
    // Deep copy agents and current world scores
    const stepData = {
      agents: this.agents.map(a => ({ ...a })),
      scores: {}
    };
    this.state.nodes.filter(n => n.cat === 'state').forEach(n => {
      stepData.scores[n.id] = n.score;
    });
    this.history[this.currentStep] = stepData;
  }

  /**
   * Starts the simulation loop.
   */
  start() {
    this.isRunning = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.currentStep < this.maxSteps) {
        this.step();
      } else {
        this.stop();
      }
    }, 150);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Advances simulation by one step.
   */
  step() {
    if (this.currentStep >= this.maxSteps) return;
    
    this.currentStep++;
    
    // If we are at the end of known history, generate new step
    if (!this.history[this.currentStep]) {
      this.agents.forEach(agent => {
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        agent.x = (agent.x + dx + this.gridSize) % this.gridSize;
        agent.y = (agent.y + dy + this.gridSize) % this.gridSize;
      });
      this.saveToHistory();
    } else {
      // Load from history
      const data = this.history[this.currentStep];
      this.agents = data.agents.map(a => ({ ...a }));
    }

    this.updateUI();
    this.render();
  }

  previous() {
    if (this.currentStep > 0) {
      this.stop();
      this.currentStep--;
      const data = this.history[this.currentStep];
      this.agents = data.agents.map(a => ({ ...a }));
      this.updateUI();
      this.render();
    }
  }

  next() {
    this.stop();
    this.step();
  }

  updateUI() {
    this.updateDashboard();
    const stepEl = document.getElementById('current-step');
    const totalEl = document.getElementById('total-steps');
    if (stepEl) stepEl.textContent = this.currentStep;
    if (totalEl) totalEl.textContent = this.maxSteps;
  }

  /**
   * Updates the dashboard with scores from history or current state.
   */
  updateDashboard() {
    if (!this.dashboard) return;
    const currentData = this.history[this.currentStep];
    const stateNodes = this.state.nodes.filter(n => n.cat === 'state');
    
    this.dashboard.innerHTML = stateNodes.map(node => {
      const score = currentData ? (currentData.scores[node.id] || 0) : (node.score || 0);
      return `
        <div class="state-badge">
          <span class="state-badge-label">${node.label.replace(/\n/g, ' ')}</span>
          <span class="state-badge-val" style="color:${this.state.colors[node.cat]}">${(score * 100).toFixed(0)}%</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Renders the grid and agents, ensuring it fits the container perfectly.
   */
  render() {
    const container = document.getElementById('grid-canvas-container');
    if (!container) return;

    // Use actual available space
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvas.width = width;
    this.canvas.height = height;

    // Calculate cell size to fit the smaller dimension
    const padding = 20;
    const availableSize = Math.min(width, height) - padding * 2;
    const cellSize = availableSize / this.gridSize;

    const gridPixelSize = cellSize * this.gridSize;
    const offsetX = (width - gridPixelSize) / 2;
    const offsetY = (height - gridPixelSize) / 2;

    this.ctx.clearRect(0, 0, width, height);

    // Draw Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(offsetX, offsetY, gridPixelSize, gridPixelSize);

    // Draw Grid
    this.ctx.strokeStyle = '#363636';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.gridSize; i++) {
      const pos = i * cellSize;
      // Vertical
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX + pos, offsetY);
      this.ctx.lineTo(offsetX + pos, offsetY + gridPixelSize);
      this.ctx.stroke();
      // Horizontal
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX, offsetY + pos);
      this.ctx.lineTo(offsetX + gridPixelSize, offsetY + pos);
      this.ctx.stroke();
    }

    // Draw Agents
    this.agents.forEach(agent => {
      this.ctx.fillStyle = agent.color;
      this.ctx.beginPath();
      this.ctx.arc(
        offsetX + (agent.x + 0.5) * cellSize,
        offsetY + (agent.y + 0.5) * cellSize,
        cellSize * 0.35,
        0, Math.PI * 2
      );
      this.ctx.fill();
      // Glow effect
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = agent.color;
    });
    this.ctx.shadowBlur = 0;
  }
}
