import math
import random
import time
from typing import Callable, Optional
from threading import Thread, Event
from .protocol import NeuralSignalChunk, get_current_timestamp

class MockSignalEngine:
    """
    A mock acquisition engine that simulates an LSL (Lab Streaming Layer) stream
    from a multi-channel EEG / BCI interface.
    """
    def __init__(self, channels: int = 8, sampling_rate: int = 250):
        self.channels = channels
        self.sampling_rate = sampling_rate
        self.is_running = False
        self._callback: Optional[Callable[[NeuralSignalChunk], None]] = None
        self._thread: Optional[Thread] = None
        self._stop_event = Event()

    def set_callback(self, callback: Callable[[NeuralSignalChunk], None]):
        self._callback = callback

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._stop_event.clear()
        self._thread = Thread(target=self._stream_loop)
        self._thread.daemon = True
        self._thread.start()
        print(f"[{time.time()}] SignalEngine started with {self.channels} channels.")

    def stop(self):
        if not self.is_running:
            return
        self.is_running = False
        self._stop_event.set()
        if self._thread:
            self._thread.join()
        print(f"[{time.time()}] SignalEngine stopped.")

    def _stream_loop(self):
        chunk_size = 50 # Send 50 samples at a time
        dt = chunk_size / self.sampling_rate
        
        while not self._stop_event.is_set():
            t_start = get_current_timestamp()
            
            data = []
            for c in range(self.channels):
                # Generate mock wave (alpha/beta mix with noise)
                channel_data = [
                    math.sin(2 * math.pi * 10 * (t_start + i/self.sampling_rate)) + 
                    0.5 * math.sin(2 * math.pi * 22 * (t_start + i/self.sampling_rate)) + 
                    random.uniform(-0.1, 0.1)
                    for i in range(chunk_size)
                ]
                data.append(channel_data)

            chunk = NeuralSignalChunk(
                timestamp=t_start,
                channels=self.channels,
                data=data,
                sampling_rate=self.sampling_rate,
                meta={"source": "MockSignalEngine_dev"}
            )

            if self._callback:
                self._callback(chunk)

            # Wait to simulate real-time acquisition
            elapsed = get_current_timestamp() - t_start
            sleep_time = max(0, dt - elapsed)
            time.sleep(sleep_time)

if __name__ == '__main__':
    def test_cb(chunk):
        print(f"Received chunk at {chunk.timestamp:.2f} with shape ({chunk.channels}, {len(chunk.data[0])})")

    engine = MockSignalEngine()
    engine.set_callback(test_cb)
    engine.start()
    time.sleep(2)
    engine.stop()
