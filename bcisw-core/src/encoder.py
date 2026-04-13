import threading
import time
from .protocol import SpatialSnapshot, EnvironmentalEntity

class SemanticEncoder:
    """
    Translates environmental / spatial concepts into synthetic non-visual patterns.
    For this mock implementation, it prints to the console or returns haptic/audio API structures.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self.active_patterns = []

    def encode_environment(self, snapshot: SpatialSnapshot):
        """
        Takes a snapshot of the visual environment and encodes it.
        Blind users require high spatial accuracy translated into alternative formats.
        """
        with self._lock:
            patterns = []
            for entity in snapshot.entities:
                # Mock encoding: The closer the object, the higher the amplitude.
                # Left/Right azimuth translates to spatial stereo or haptic belt array focus.
                
                haptic_intensity = max(0.0, 1.0 - (entity.distance_meters / 10.0))
                spatial_audio_pan = max(-1.0, min(1.0, entity.azimuth_degrees / 90.0)) # -1 (Left), 1 (Right)
                
                pattern = {
                    "entity_id": entity.id,
                    "concept": entity.label,
                    "haptic_intensity": round(haptic_intensity, 2),
                    "audio_pan": round(spatial_audio_pan, 2),
                    "timestamp": snapshot.timestamp
                }
                patterns.append(pattern)
            
            self.active_patterns = patterns
            self._dispatch_encoding(patterns)

    def _dispatch_encoding(self, patterns: list):
        # Simulate dispatching to hardware SDKs (e.g. haptic gloves, bone-conduction headsets)
        print(f"[{time.time():.2f}] Dispatching Encoding payload to hardware...")
        for p in patterns:
            print(f" -> Conceptualizing: {p['concept']} | Haptic Power: {p['haptic_intensity']} | Pan: {p['audio_pan']}")

if __name__ == '__main__':
    encoder = SemanticEncoder()
    mock_env = SpatialSnapshot(
        timestamp=time.time(),
        entities=[
            EnvironmentalEntity("o1", "Door", distance_meters=2.5, azimuth_degrees=-10),
            EnvironmentalEntity("o2", "Fast Moving Object", distance_meters=5.0, azimuth_degrees=45)
        ]
    )
    encoder.encode_environment(mock_env)
