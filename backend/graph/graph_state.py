from typing import List, Dict, Any, Optional
from .semantics import calculate_h_categorizer, calculate_max_based

class Node:
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id")
        self.label = data.get("label")
        self.cat = data.get("cat")
        self.desc = data.get("desc")
        self.value = data.get("value", 0.5)
        self.score = data.get("score", 0.0)
        self.attacks = data.get("attacks", [])
        self.supports = data.get("supports", [])
        self.inactive = data.get("inactive", False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "cat": self.cat,
            "desc": self.desc,
            "value": self.value,
            "score": self.score,
            "attacks": self.attacks,
            "supports": self.supports,
            "inactive": self.inactive
        }

class GraphState:
    def __init__(self, data: Dict[str, Any]):
        self.colors = data.get("colors", {})
        self.cats = data.get("cats", {})
        self.global_scores_config = data.get("globalScores", [])
        self.nodes = [Node(n) for n in data.get("nodes", [])]
        self.method = "h-categorizer"
        self.category_weights = {}

    def recalculate(self):
        if self.method == "max-based":
            scores = calculate_max_based(self.nodes, self.category_weights)
        else:
            scores = calculate_h_categorizer(self.nodes, self.category_weights)
            
        for node in self.nodes:
            node.score = scores.get(node.id, 0.0)

    def update_node(self, node_id: str, data: Dict[str, Any]):
        for node in self.nodes:
            if node.id == node_id:
                for k, v in data.items():
                    setattr(node, k, v)
                break
        self.recalculate()

    def add_node(self, data: Dict[str, Any]):
        self.nodes.append(Node(data))
        self.recalculate()

    def remove_node(self, node_id: str):
        self.nodes = [n for n in self.nodes if n.id != node_id]
        # Clean up references
        for node in self.nodes:
            node.attacks = [a for a in node.attacks if a != node_id]
            node.supports = [s for s in node.supports if s != node_id]
        self.recalculate()

    def get_data(self) -> Dict[str, Any]:
        return {
            "colors": self.colors,
            "cats": self.cats,
            "globalScores": self.global_scores_config,
            "nodes": [n.to_dict() for n in self.nodes]
        }
