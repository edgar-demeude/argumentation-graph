from typing import Dict, Any
import random

class Agent:
    def __init__(self, id: int, grid_size: int):
        self.id = id
        self.grid_size = grid_size
        self.x = random.randint(0, grid_size - 1)
        self.y = random.randint(0, grid_size - 1)
        self.color = f"hsl({random.randint(0, 360)}, 70%, 60%)"

    def move(self):
        dx = random.randint(-1, 1)
        dy = random.randint(-1, 1)
        self.x = (self.x + dx) % self.grid_size
        self.y = (self.y + dy) % self.grid_size

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "color": self.color
        }
