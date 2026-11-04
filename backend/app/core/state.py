# Campus state held in memory for the life of the process.
#
# The car park: 60 bays in a fixed arrangement, because the college has no parking sensors. It is here so
# that driving directions can name a free bay; nothing claims it is a live reading, and nothing changes it
# while the server runs. Wire real sensors in by setting parking_spots from whatever reports them.

PARKING_BAYS = 60
FREE_EVERY = 3                      # one bay in three is free: the same arrangement on every start


def _bays() -> list:
    return [{"id": f"spot_{i}", "occupied": i % FREE_EVERY != 0} for i in range(PARKING_BAYS)]


class LiveState:
    def __init__(self):
        self.parking_spots = _bays()


global_state = LiveState()
