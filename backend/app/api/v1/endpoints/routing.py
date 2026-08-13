import math
from fastapi import APIRouter, HTTPException, Query
from backend.app.core.state import global_state
from backend.app.api.v1.endpoints.buildings import DEMO_BUILDINGS

router = APIRouter()

# We define nodes along the visual paths on the map.
# Visual Paths:
# Horizontal (z): -44 (Exam-SH), -35 (North), 0 (Center), 35 (South)
# Vertical (x): -76 (Far West), -25.5 (CSE-Mech), 18 (East), 68 (Far East), 87 (Main Road)

NODES = {
  # Path (North) z=-35 Intersections
  "FW_N": {"x": -76, "z": -35},
  "EC_N": {"x": -52.5, "z": -35},
  "CM_N": {"x": -25.5, "z": -35},
  "E_N": {"x": 6.5, "z": -35},
  "FE_N": {"x": 68, "z": -35},

  # Path (Center) z=0 Intersections
  "FW_C": {"x": -76, "z": 0},
  "EC_C": {"x": -52.5, "z": 0},
  "CM_C": {"x": -25.5, "z": 0},
  "E_C": {"x": 6.5, "z": 0},
  "FE_C": {"x": 68, "z": 0},
  "RD_C": {"x": 87, "z": 0},

  # Path (South) z=35 Intersections
  "FW_S": {"x": -76, "z": 35},
  "E_S": {"x": 18, "z": 35},
  "FE_S": {"x": 68, "z": 35},

  # Path (Exam-SH) z=-44 (horizontal, between x=-2 and 45)
  "E_EX": {"x": 6.5, "z": -44},
  
  # Custom nodes to reach parking lots
  "PK_N": {"x": -95, "z": 48},
  "PK_S": {"x": -60, "z": 55},
  
  # Connection points near  # Parking / Misc
}

EDGE_LIST = [
  # Horizontal Path (North) z=-35
  ["FW_N", "EC_N"], ["EC_N", "CM_N"], ["CM_N", "E_N"], ["E_N", "FE_N"],
  
  # Horizontal Path (Center) z=0
  ["FW_C", "EC_C"], ["EC_C", "CM_C"], ["CM_C", "E_C"], ["E_C", "FE_C"], ["FE_C", "RD_C"],
  
  # Horizontal Path (South) z=35
  ["FW_S", "E_S"], ["E_S", "FE_S"],
  
  # Vertical Path (Far West) x=-76
  ["FW_N", "FW_C"], ["FW_C", "FW_S"],

  # Vertical Path (ECE-CSE) x=-52.5
  ["EC_N", "EC_C"],
  
  # Vertical Path (CSE-Mech) x=-25.5
  ["CM_N", "CM_C"],
  
  # Vertical Path (East) x=18
  ["E_EX", "E_N"], ["E_N", "E_C"], ["E_C", "E_S"],
  
  # Vertical Path (Far East) x=68
  ["FE_N", "FE_C"], ["FE_C", "FE_S"],
  
]

# Add buildings as nodes
# Using the same hardcoded gates from the JS version for consistency:
GATES = {
  'rnd': {'x': -78, 'z': -44}, 'cant': {'x': -55, 'z': -44}, 'cad': {'x': -28, 'z': -44}, 
  'exam': {'x': -2, 'z': -44}, 'sh': {'x': 45, 'z': -44}, 'ece': {'x': -65, 'z': -9}, 
  'cse': {'x': -40, 'z': -9}, 'mecheee': {'x': -10, 'z': -9}, 'civilit': {'x': 23, 'z': -9},
  'lib': {'x': -30, 'z': 48}, 'aud': {'x': 12, 'z': 43}, 'frontgate': {'x': 87, 'z': 0}, 
  'backgate': {'x': -77, 'z': 48}, 'security': {'x': 74, 'z': -5},
  'boyshostel': {'x': 74, 'z': -35}, 'girlshostel': {'x': 74, 'z': 45}
}

for b_id, gate in GATES.items():
    NODES[b_id] = gate
    
    # Connect each building to the closest path node
    closest_node = None
    min_dist = float('inf')
    for n_id, n_pos in NODES.items():
        if n_id == b_id or n_id in GATES or n_id in ["PK_N", "PK_S"]: 
            continue # Don't connect buildings to buildings or parking lots
        d = math.hypot(gate['x'] - n_pos['x'], gate['z'] - n_pos['z'])
        if d < min_dist:
            min_dist = d
            closest_node = n_id
            
    if closest_node:
        EDGE_LIST.append([b_id, closest_node])

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
    # Mapping spot IDs to the nearest graph node
    # Spot 0-13 -> North Parking -> Node 'wD'
    # Spot 14-29 -> South Parking -> Node 'fA'
    available = []
    for spot in spots:
        if not spot.get("occupied", True):
            try:
                num = int(spot["id"].split("_")[1])
                node = "PK_N" if num <= 13 else "PK_S"
                available.append({"id": spot["id"], "node": node})
            except:
                pass
    return available

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
