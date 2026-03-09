from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import json
import os

from .graph.graph_state import GraphState
from .simulation.simulation import Simulation
from .models import Node, SimulationConfig

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
graph_state = None
simulation = None

@app.on_event("startup")
async def startup_event():
    global graph_state
    # Load initial data
    data_path = os.path.join(os.path.dirname(__file__), "..", "data.json")
    with open(data_path, "r") as f:
        data = json.load(f)
    graph_state = GraphState(data)
    graph_state.recalculate()

@app.get("/graph")
async def get_graph():
    return graph_state.get_data()

@app.post("/node")
async def add_node(node: Dict[str, Any]):
    graph_state.add_node(node)
    return graph_state.get_data()

@app.put("/node/{node_id}")
async def update_node(node_id: str, data: Dict[str, Any]):
    graph_state.update_node(node_id, data)
    return graph_state.get_data()

@app.delete("/node/{node_id}")
async def remove_node(node_id: str):
    graph_state.remove_node(node_id)
    return graph_state.get_data()

@app.post("/simulation/init")
async def init_simulation(config: SimulationConfig):
    global simulation
    simulation = Simulation(config.numAgents, config.maxSteps, config.gridSize, graph_state)
    return simulation.get_current_state()

@app.post("/simulation/step")
async def step_simulation():
    if not simulation:
        raise HTTPException(status_code=400, detail="Simulation not initialized")
    simulation.step()
    return simulation.get_current_state()

@app.post("/simulation/previous")
async def previous_simulation():
    if not simulation:
        raise HTTPException(status_code=400, detail="Simulation not initialized")
    simulation.previous()
    return simulation.get_current_state()

@app.get("/simulation/state")
async def get_simulation_state():
    if not simulation:
        return {"step": 0, "agents": [], "scores": {}}
    return simulation.get_current_state()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
