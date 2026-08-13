# Global in-memory state for telemetry
# In a production app, this would be Redis or a Database.

class LiveState:
    def __init__(self):
        self.parking_spots = []

global_state = LiveState()
