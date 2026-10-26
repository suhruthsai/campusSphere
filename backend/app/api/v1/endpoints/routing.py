import math
from fastapi import APIRouter, HTTPException
from backend.app.core.state import global_state

router = APIRouter()

# Walking graph for the MVSR campus layout (metres, x = east, z = south, axis-aligned to
# the campus grid). Mirrors NODES / EDGE_LIST in
# src/components/three/SuhruthDigitalTwin.jsx - keep the two in sync.
NODES = {
    # Back gate lane (x = 20)
    "V_GATE": {"x": 20, "z": -70}, "V_N": {"x": 20, "z": -30}, "V_S": {"x": 20, "z": -20},
    # Boulevard, north lane (z = -30)
    "N_LIB": {"x": -63, "z": -30}, "N_PLC": {"x": -33, "z": -30}, "N_AUD": {"x": -139, "z": -30}, "N_BOYS": {"x": -176, "z": -30}, "N_W": {"x": -189, "z": -30},
    "N_SEC": {"x": -215, "z": -30},
    # Boulevard, south lane (z = -20)
    "L_ECE": {"x": -7, "z": -20}, "P3_N": {"x": -28.75, "z": -20}, "L_CSE": {"x": -50, "z": -20}, "L_MID": {"x": -63, "z": -20},
    "P2_N": {"x": -73.5, "z": -20}, "L_MECH": {"x": -102, "z": -20}, "P1_N": {"x": -129.5, "z": -20},
    "L_CIV": {"x": -158, "z": -20}, "W_N": {"x": -189, "z": -20},
    # West road (x = -189)
    "W_S": {"x": -189, "z": 47}, "W_GIRLS": {"x": -189, "z": 77.5},
    # South road (z = 47)
    "S_SH": {"x": -162.5, "z": 47}, "P1_S": {"x": -129.5, "z": 47}, "S_CAD": {"x": -106, "z": 47},
    "P2_S": {"x": -73.5, "z": 47}, "S_CANT": {"x": -40, "z": 47}, "P3_S": {"x": -28.75, "z": 47},
    "S_RND": {"x": -14, "z": 47}, "E_S": {"x": 20, "z": 47},
    # S&H-Exam road
    "I_EXAM": {"x": -129.5, "z": 96.5},
    # Car park access road and the car park's north aisle (all 60 spots)
    "D_LANE": {"x": 20, "z": -40}, "D_TURN": {"x": 57, "z": -40}, "PK_N": {"x": 57, "z": -7},
}

EDGE_LIST = [
    ["V_GATE", "D_LANE"], ["D_LANE", "V_N"], ["D_LANE", "D_TURN"], ["D_TURN", "PK_N"], ["V_N", "V_S"],
    ["V_N", "N_PLC"], ["N_PLC", "N_LIB"], ["N_LIB", "N_AUD"], ["N_AUD", "N_BOYS"], ["N_BOYS", "N_W"], ["N_W", "N_SEC"],
    ["V_S", "L_ECE"], ["L_ECE", "P3_N"], ["P3_N", "L_CSE"], ["L_CSE", "L_MID"], ["L_MID", "P2_N"], ["P2_N", "L_MECH"],
    ["L_MECH", "P1_N"], ["P1_N", "L_CIV"], ["L_CIV", "W_N"],
    ["N_W", "W_N"], ["N_LIB", "L_MID"],
    ["W_N", "W_S"], ["W_S", "W_GIRLS"],
    ["W_S", "S_SH"], ["S_SH", "P1_S"], ["P1_S", "S_CAD"], ["S_CAD", "P2_S"], ["P2_S", "S_CANT"],
     ["S_CANT", "P3_S"], ["P3_S", "S_RND"], ["S_RND", "E_S"],
    ["P1_N", "P1_S"], ["P2_N", "P2_S"], ["P3_N", "P3_S"], ["P1_S", "I_EXAM"],
    ["V_S", "E_S"],
]

# Building entrances (the `gate` of each BUILDINGS entry in the frontend) and the road
# node each one connects to.
GATES = {
    "rnd": {"x": -14, "z": 55}, "cant": {"x": -40, "z": 65}, "cad": {"x": -106, "z": 70.5},
    "exam": {"x": -105, "z": 96.5}, "sh": {"x": -162.5, "z": 63}, "ece": {"x": -7, "z": -9.5},
    "cse": {"x": -50, "z": -6}, "mecheee": {"x": -102, "z": -9}, "civilit": {"x": -158, "z": -6},
    "lib": {"x": -63, "z": -41}, "aud": {"x": -139, "z": -45}, "frontgate": {"x": -225, "z": -20},
    "backgate": {"x": 20, "z": -76}, "security": {"x": -215, "z": -36.5},
    "boyshostel": {"x": -176, "z": -58}, "girlshostel": {"x": -191, "z": 77.5},
    "placement": {"x": -33, "z": -39},
}

LINKS = {
    "rnd": "S_RND", "cant": "S_CANT", "cad": "S_CAD", "exam": "I_EXAM", "sh": "S_SH",
    "ece": "L_ECE", "cse": "L_CSE", "mecheee": "L_MECH", "civilit": "L_CIV", "lib": "N_LIB",
    "aud": "N_AUD", "frontgate": "W_N", "backgate": "V_GATE", "security": "N_SEC",
    "boyshostel": "N_BOYS", "girlshostel": "W_GIRLS", "placement": "N_PLC",
}

for b_id, gate in GATES.items():
    NODES[b_id] = gate
    EDGE_LIST.append([b_id, LINKS[b_id]])

def dist(a, b):
    return math.hypot(a['x'] - b['x'], a['z'] - b['z'])

ADJACENCY = {k: [] for k in NODES.keys()}
for a, c in EDGE_LIST:
    if a in NODES and c in NODES:
        w = dist(NODES[a], NODES[c])
        ADJACENCY[a].append({"to": c, "w": w})
        ADJACENCY[c].append({"to": a, "w": w})

def dijkstra(start_id, end_id):
    if start_id not in NODES or end_id not in NODES:
        return None

    dist_map = {k: float('inf') for k in NODES.keys()}
    dist_map[start_id] = 0
    prev = {}
    queue = set(NODES.keys())

    while queue:
        u = min(queue, key=lambda k: dist_map[k])
        if dist_map[u] == float('inf'):
            break
        queue.remove(u)
        if u == end_id:
            break

        for edge in ADJACENCY[u]:
            alt = dist_map[u] + edge["w"]
            if alt < dist_map[edge["to"]]:
                dist_map[edge["to"]] = alt
                prev[edge["to"]] = u

    if dist_map[end_id] == float('inf'):
        return None

    path = [end_id]
    cur = end_id
    while cur in prev:
        cur = prev[cur]
        path.insert(0, cur)
        
    return {"path": path, "distance": dist_map[end_id]}


def get_available_parking_spots():
    spots = global_state.parking_spots
    # All spots are in the car park on the ground, reached at node 'PK_N'
    return [{"id": spot["id"], "node": "PK_N"} for spot in spots if not spot.get("occupied", True)]

@router.get("/route")
def calculate_route(from_id: str, to_id: str, mode: str = "walk"):
    if mode == "walk":
        result = dijkstra(from_id, to_id)
        if not result:
            raise HTTPException(status_code=404, detail="Route not found")
        
        return {
            "mode": "walk",
            "path_ids": result["path"],
            "path_coords": [NODES[nid] for nid in result["path"]],
            "distance": result["distance"]
        }
        
    elif mode == "drive":
        # Find nearest available parking to the destination
        available = get_available_parking_spots()
        if not available:
            # Fallback to walk if no parking available
            return calculate_route(from_id, to_id, mode="walk")
            
        # Find which parking node is closest to destination
        best_parking_node = None
        best_walk_dist = float('inf')
        
        # Test paths from all available parking nodes to the destination
        for pk in available:
            walk_route = dijkstra(pk["node"], to_id)
            if walk_route and walk_route["distance"] < best_walk_dist:
                best_walk_dist = walk_route["distance"]
                best_parking_node = pk["node"]
                
        if not best_parking_node:
            raise HTTPException(status_code=404, detail="Could not route to parking")
            
        drive_route = dijkstra(from_id, best_parking_node)
        walk_route = dijkstra(best_parking_node, to_id)
        
        if not drive_route or not walk_route:
            raise HTTPException(status_code=404, detail="Could not route to parking")
            
        # Combine the routes
        # We don't duplicate the parking node in the combined path
        combined_path_ids = drive_route["path"] + walk_route["path"][1:]
        
        return {
            "mode": "drive",
            "path_ids": combined_path_ids,
            "path_coords": [NODES[nid] for nid in combined_path_ids],
            "distance": drive_route["distance"] + walk_route["distance"],
            "parking_node": best_parking_node
        }
