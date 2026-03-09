from typing import List, Dict, Any
from .agent import Agent

class Simulation:
    def __init__(self, num_agents: int, max_steps: int, grid_size: int, graph_state):
        self.num_agents = num_agents
        self.max_steps = max_steps
        self.grid_size = grid_size
        self.agents: List[Agent] = [Agent(i, grid_size) for i in range(num_agents)]
        self.current_step = 0
        self.history: List[Dict[str, Any]] = []
        self.graph_state = graph_state

        # Initial history save
        self.save_history()

    def step(self):
        if self.current_step >= self.max_steps:
            return

        self.current_step += 1
        
        # 1. Move Agents
        for agent in self.agents:
            agent.move()
        
        # 2. Update Graph State based on Agent positions (simplified for now)
        # This is where agent-node interactions would happen.
        # For now, we'll just recalculate semantics as before.
        self.graph_state.recalculate()
        
        self.save_history()

    def previous(self):
        if self.current_step > 0:
            self.current_step -= 1
            # Restore state from history (agents + node scores)
            step_data = self.history[self.current_step]
            # Restore agents
            # (In a real scenario, we might want to store exact agent state objects)
            # For simplicity, we just rewind the pointer and serve data from history.

    def save_history(self):
        current_scores = {n.id: n.score for n in self.graph_state.nodes}
        self.history.append({
            "step": self.current_step,
            "agents": [a.to_dict() for a in self.agents],
            "scores": current_scores
        })

    def get_current_state(self):
        if self.current_step < len(self.history):
            return self.history[self.current_step]
        return self.history[-1]
