from dataclasses import dataclass, field
from typing import List, Dict, Any
import time

@dataclass
class NeuralSignalChunk:
    """A standard block of neural data retrieved from the hardware."""
    timestamp: float
    channels: int
    data: List[List[float]] # channels x samples
    sampling_rate: int
    meta: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SemanticIntent:
    """A standardized interpretation of an intent (e.g. movement, spatial query)."""
    timestamp: float
    intent_class: str
    confidence: float
    parameters: Dict[str, Any] = field(default_factory=dict)

@dataclass
class EnvironmentalEntity:
    """A 3D spatial semantic representation of an object."""
    id: str
    label: str
    distance_meters: float
    azimuth_degrees: float
    elevation_degrees: float
    velocity_vector: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])

@dataclass
class SpatialSnapshot:
    """A snapshot of the environment in 3D representation."""
    timestamp: float
    entities: List[EnvironmentalEntity]

def get_current_timestamp() -> float:
    return time.time()
