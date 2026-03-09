from typing import List, Dict, Optional, Literal
from pydantic import BaseModel

class Agent(BaseModel):
    id: int
    x: int
    y: int
    color: str

class Node(BaseModel):
    id: str
    label: str
    cat: str
    desc: Optional[str] = None
    value: Optional[float] = None
    score: Optional[float] = 0.0
    attacks: List[str] = []
    supports: List[str] = []
    inactive: bool = False

class Link(BaseModel):
    source: str
    target: str
    type: Literal['attack', 'support']

class GraphData(BaseModel):
    colors: Dict[str, str]
    cats: Dict[str, str]
    globalScores: List[dict]
    nodes: List[Node]
    links: Optional[List[Link]] = []

class SimulationConfig(BaseModel):
    numAgents: int
    maxSteps: int
    gridSize: int

class SimulationStep(BaseModel):
    step: int
    agents: List[Agent]
    scores: Dict[str, float]  # Node scores after semantics calculation

class GridState(BaseModel):
    gridSize: int
    agents: List[Agent]
    currentStep: int
    maxSteps: int
    history: List[SimulationStep] = []
