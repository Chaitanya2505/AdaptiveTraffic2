import os
import sys
import json
import random
import asyncio
import time
from typing import Set, Dict, Any, List, Optional
from fastapi import WebSocket

from app.services.simulation_analytics import simulation_analytics
from app.simulation.network_generator import generate_corridor_network

# Setup SUMO paths
if "SUMO_HOME" in os.environ:
    tools = os.path.join(os.environ["SUMO_HOME"], "tools")
    if tools not in sys.path:
        sys.path.append(tools)
else:
    for default_dir in [
        r"C:\Program Files (x86)\Eclipse\Sumo\tools",
        r"C:\Program Files\Eclipse\Sumo\tools",
        "/usr/share/sumo/tools",
        "/opt/homebrew/opt/sumo/share/sumo/tools"
    ]:
        if os.path.exists(default_dir) and default_dir not in sys.path:
            sys.path.append(default_dir)
            os.environ["SUMO_HOME"] = os.path.dirname(default_dir)
            break

try:
    import traci
    import sumolib
    SUMO_AVAILABLE = True
except ImportError:
    SUMO_AVAILABLE = False

# 4 Corridor Traffic Light IDs
CORRIDOR_TLS = ["J_SVNIT", "J_GHODDOD", "J_MAJURA", "J_SAHARA"]

# Dedicated Arterial BRTS Corridor Edges (Only these have Lane 0 as dedicated BRTS)
BRTS_CORRIDOR_EDGES = {
    "W_TO_SVNIT", "SVNIT_TO_GHODDOD", "GHODDOD_TO_MAJURA", "MAJURA_TO_SAHARA", "SAHARA_TO_E",
    "E_TO_SAHARA", "SAHARA_TO_MAJURA", "MAJURA_TO_GHODDOD", "GHODDOD_TO_SVNIT", "SVNIT_TO_W"
}

# Gateway-balanced route mapping ensuring equalized 4-approach distribution across all 4 junctions:
# Prevents single-gateway overloading (e.g. dumping 35%+ of all corridor traffic into SVNIT West).
GATEWAY_ROUTES = {
    "west_arterial": ["r_MAIN_W_TO_E", "r_W_TO_GHODDOD_N", "r_W_TO_MAJURA_S", "r_SVNIT_W_TO_N", "r_SVNIT_W_TO_S"],
    "east_arterial": ["r_MAIN_E_TO_W", "r_E_TO_MAJURA_N", "r_E_TO_GHODDOD_S", "r_SAHARA_E_TO_N", "r_SAHARA_E_TO_S"],
    "svnit_north":   ["r_SVNIT_N_TO_S", "r_SVNIT_N_TO_E", "r_SVNIT_N_TO_W"],
    "svnit_south":   ["r_SVNIT_S_TO_N", "r_SVNIT_S_TO_E", "r_SVNIT_S_TO_W"],
    "ghoddod_north": ["r_GHODDOD_N_TO_S", "r_GHODDOD_N_TO_E", "r_GHODDOD_N_TO_W"],
    "ghoddod_south": ["r_GHODDOD_S_TO_N", "r_GHODDOD_S_TO_E", "r_GHODDOD_S_TO_W"],
    "majura_north":  ["r_MAJURA_N_TO_S", "r_MAJURA_N_TO_E", "r_MAJURA_N_TO_W"],
    "majura_south":  ["r_MAJURA_S_TO_N", "r_MAJURA_S_TO_E", "r_MAJURA_S_TO_W"],
    "sahara_north":  ["r_SAHARA_N_TO_S", "r_SAHARA_N_TO_W", "r_SAHARA_N_TO_E"],
    "sahara_south":  ["r_SAHARA_S_TO_N", "r_SAHARA_S_TO_W", "r_SAHARA_S_TO_E"],
    "brts_west":     ["r_BRTS_W_TO_E"],
    "brts_east":     ["r_BRTS_E_TO_W"]
}

# Balanced weights: 24% West Arterial, 24% East Arterial, 52% Cross-feeders evenly shared across all 8 legs (6.5% each)
GATEWAY_WEIGHTS = {
    "west_arterial": 0.20,
    "east_arterial": 0.20,
    "svnit_north":   0.065,
    "svnit_south":   0.065,
    "ghoddod_north": 0.065,
    "ghoddod_south": 0.065,
    "majura_north":  0.065,
    "majura_south":  0.065,
    "sahara_north":  0.065,
    "sahara_south":  0.065,
    "brts_west":     0.04,
    "brts_east":     0.04
}

ROUTE_CATEGORIES = GATEWAY_ROUTES

# Incoming lane mapping for the 4 corridor junctions
JUNCTION_APPROACH_LANES = {
    "J_SVNIT": {
        "NORTH": ["N_TO_SVNIT_0", "N_TO_SVNIT_1"],
        "SOUTH": ["S_TO_SVNIT_0", "S_TO_SVNIT_1"],
        "WEST": ["W_TO_SVNIT_0", "W_TO_SVNIT_1", "W_TO_SVNIT_2"],
        "EAST": ["GHODDOD_TO_SVNIT_0", "GHODDOD_TO_SVNIT_1", "GHODDOD_TO_SVNIT_2"]
    },
    "J_GHODDOD": {
        "NORTH": ["N_TO_GHODDOD_0", "N_TO_GHODDOD_1"],
        "SOUTH": ["S_TO_GHODDOD_0", "S_TO_GHODDOD_1"],
        "WEST": ["SVNIT_TO_GHODDOD_0", "SVNIT_TO_GHODDOD_1", "SVNIT_TO_GHODDOD_2"],
        "EAST": ["MAJURA_TO_GHODDOD_0", "MAJURA_TO_GHODDOD_1", "MAJURA_TO_GHODDOD_2"]
    },
    "J_MAJURA": {
        "NORTH": ["N_TO_MAJURA_0", "N_TO_MAJURA_1"],
        "SOUTH": ["S_TO_MAJURA_0", "S_TO_MAJURA_1"],
        "WEST": ["GHODDOD_TO_MAJURA_0", "GHODDOD_TO_MAJURA_1", "GHODDOD_TO_MAJURA_2"],
        "EAST": ["SAHARA_TO_MAJURA_0", "SAHARA_TO_MAJURA_1", "SAHARA_TO_MAJURA_2"]
    },
    "J_SAHARA": {
        "NORTH": ["N_TO_SAHARA_0", "N_TO_SAHARA_1"],
        "SOUTH": ["S_TO_SAHARA_0", "S_TO_SAHARA_1"],
        "WEST": ["MAJURA_TO_SAHARA_0", "MAJURA_TO_SAHARA_1", "MAJURA_TO_SAHARA_2"],
        "EAST": ["E_TO_SAHARA_0", "E_TO_SAHARA_1", "E_TO_SAHARA_2"]
    }
}

# 4-Phase Directional State Machine Constants (Single Approach Open at a Time)
# Link indices across all 4 corridor junctions (30 links total):
# - Indices 0..6 (7 links)   = North Approach (N_TO_*)
# - Indices 7..14 (8 links)  = East Approach (MAJURA_TO_GHODDOD, etc.)
# - Indices 15..21 (7 links) = South Approach (S_TO_*)
# - Indices 22..29 (8 links) = West Approach (SVNIT_TO_GHODDOD, etc.)

PHASE_NORTH_GREEN  = 0
PHASE_NORTH_YELLOW = 1
PHASE_EAST_GREEN   = 2
PHASE_EAST_YELLOW  = 3
PHASE_SOUTH_GREEN  = 4
PHASE_SOUTH_YELLOW = 5
PHASE_WEST_GREEN   = 6
PHASE_WEST_YELLOW  = 7

APPROACH_PHASE_STATES = {
    PHASE_NORTH_GREEN:  "GGGGgggrrrrrrrrrrrrrrrrrrrrrrr",
    PHASE_NORTH_YELLOW: "yyyyyyyrrrrrrrrrrrrrrrrrrrrrrr",
    PHASE_EAST_GREEN:   "rrrrrrrGGGGGGggrrrrrrrrrrrrrrr",
    PHASE_EAST_YELLOW:  "rrrrrrryyyyyyyyrrrrrrrrrrrrrrr",
    PHASE_SOUTH_GREEN:  "rrrrrrrrrrrrrrrGGGGgggrrrrrrrr",
    PHASE_SOUTH_YELLOW: "rrrrrrrrrrrrrrryyyyyyyrrrrrrrr",
    PHASE_WEST_GREEN:   "rrrrrrrrrrrrrrrrrrrrrrGGGGGGgg",
    PHASE_WEST_YELLOW:  "rrrrrrrrrrrrrrrrrrrrrryyyyyyyy"
}

PHASE_APPROACH_NAME = {
    PHASE_NORTH_GREEN:  "NORTH",
    PHASE_NORTH_YELLOW: "NORTH",
    PHASE_EAST_GREEN:   "EAST",
    PHASE_EAST_YELLOW:  "EAST",
    PHASE_SOUTH_GREEN:  "SOUTH",
    PHASE_SOUTH_YELLOW: "SOUTH",
    PHASE_WEST_GREEN:   "WEST",
    PHASE_WEST_YELLOW:  "WEST"
}

PHASE_NAMES = {
    PHASE_NORTH_GREEN:  "NORTH GREEN",
    PHASE_NORTH_YELLOW: "NORTH YELLOW",
    PHASE_EAST_GREEN:   "EAST GREEN",
    PHASE_EAST_YELLOW:  "EAST YELLOW",
    PHASE_SOUTH_GREEN:  "SOUTH GREEN",
    PHASE_SOUTH_YELLOW: "SOUTH YELLOW",
    PHASE_WEST_GREEN:   "WEST GREEN",
    PHASE_WEST_YELLOW:  "WEST YELLOW"
}

YELLOW_TO_NEXT_GREEN = {
    PHASE_NORTH_YELLOW: PHASE_EAST_GREEN,
    PHASE_EAST_YELLOW:  PHASE_SOUTH_GREEN,
    PHASE_SOUTH_YELLOW: PHASE_WEST_GREEN,
    PHASE_WEST_YELLOW:  PHASE_NORTH_GREEN
}

GREEN_TO_YELLOW = {
    PHASE_NORTH_GREEN: PHASE_NORTH_YELLOW,
    PHASE_EAST_GREEN:  PHASE_EAST_YELLOW,
    PHASE_SOUTH_GREEN: PHASE_SOUTH_YELLOW,
    PHASE_WEST_GREEN:  PHASE_WEST_YELLOW
}

class SumoService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(SumoService, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized") and self._initialized:
            return

        self._initialized = True
        self.is_initialized = False
        self.traci_started = False

        # State variables
        self.is_paused = True
        self.should_step = False
        self.spawn_rate = 60.0  # vehicles per minute
        self.speed_multiplier = 1.0
        self.scenario_mode = "adaptive"  # adaptive, fixed
        self.demand_preset = "peak"  # low, normal, heavy, peak, custom
        self.is_manual_tl = False
        self.brts_priority_enabled = True

        # 5-minute automated run tracking
        self.is_5min_running = False
        self.demo_start_time = 0.0
        self.demo_target_duration = 300.0  # 300 simulation seconds = 5 min

        self.veh_counter = 0
        self.clients: Set[WebSocket] = set()
        self.loop_task = None
        self.geometry_cache = None
        self.vehicle_static_cache: Dict[str, Dict[str, Any]] = {}

        # 4-Phase Directional State Machine (Single Direction Open at a Time)
        # Sequence: NORTH (0) -> NORTH_YELLOW (1) -> EAST (2) -> EAST_YELLOW (3) -> SOUTH (4) -> SOUTH_YELLOW (5) -> WEST (6) -> WEST_YELLOW (7)
        self.signal_machines: Dict[str, Dict[str, Any]] = {}
        for jid in CORRIDOR_TLS:
            self.signal_machines[jid] = {
                "phase": PHASE_NORTH_GREEN,
                "phase_start_time": 0.0,
                "target_duration": 15.0,
                "min_green": 10.0,
                "max_green_feeder": 35.0,
                "max_green_arterial": 45.0,
                "yellow_duration": 3.5,
                "ew_pressure": 0.0,
                "ns_pressure": 0.0,
                "decision_reason": "Cycle initialization: North approach green",
                "approach_metrics": {
                    "NORTH": {"vehicles": 0, "queue": 0, "speed": 0.0, "wait": 0.0, "pressure": 0.0},
                    "SOUTH": {"vehicles": 0, "queue": 0, "speed": 0.0, "wait": 0.0, "pressure": 0.0},
                    "EAST": {"vehicles": 0, "queue": 0, "speed": 0.0, "wait": 0.0, "pressure": 0.0},
                    "WEST": {"vehicles": 0, "queue": 0, "speed": 0.0, "wait": 0.0, "pressure": 0.0}
                }
            }

        # Alerts & Intelligence Feed
        self.live_alerts: List[Dict[str, Any]] = []
        self.brts_priority_events: List[Dict[str, Any]] = []

        # Setup directories
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.simulation_dir = os.path.join(self.base_dir, "simulation")
        self.sumocfg_path = os.path.join(self.simulation_dir, "simulation.sumocfg")
        self.net_path = os.path.join(self.simulation_dir, "net.net.xml")

    def ensure_network(self):
        """Compiles or validates the 4-junction SUMO corridor network."""
        if not os.path.exists(self.net_path) or os.path.getsize(self.net_path) < 1000:
            print("Generating 4-junction Surat arterial corridor network...")
            generate_corridor_network(self.simulation_dir)

    def get_network_geometry(self) -> Dict[str, Any]:
        """Parses the compiled network geometry and returns node, lane, and traffic light specs."""
        if self.geometry_cache:
            return self.geometry_cache

        if not SUMO_AVAILABLE or not os.path.exists(self.net_path):
            return {"lanes": [], "nodes": [], "trafficLights": {}}

        try:
            print("Reading network geometry with sumolib...")
            net = sumolib.net.readNet(self.net_path)

            lanes_data = []
            for edge in net.getEdges():
                edge_id = edge.getID()
                for lane in edge.getLanes():
                    shape = [[float(coord[0]), float(coord[1])] for coord in lane.getShape()]
                    is_brts = (edge_id in BRTS_CORRIDOR_EDGES) and lane.getID().endswith("_0") and not lane.getID().startswith(":")
                    lanes_data.append({
                        "id": lane.getID(),
                        "edgeId": edge_id,
                        "shape": shape,
                        "width": float(lane.getWidth()),
                        "speed": float(lane.getSpeed()),
                        "isBrts": is_brts,
                        "fromNode": edge.getFromNode().getID(),
                        "toNode": edge.getToNode().getID()
                    })

            nodes_data = []
            for node in net.getNodes():
                coord = node.getCoord()
                nodes_data.append({
                    "id": node.getID(),
                    "x": float(coord[0]),
                    "y": float(coord[1]),
                    "type": node.getType()
                })

            tls_ids = traci.trafficlight.getIDList() if self.traci_started else CORRIDOR_TLS
            tls_configs = {}
            for tls_id in tls_ids:
                try:
                    links = traci.trafficlight.getControlledLinks(tls_id) if self.traci_started else []
                    controlled_links = []
                    for index_links in links:
                        idx_links_data = []
                        for link in index_links:
                            idx_links_data.append({
                                "incoming": link[0],
                                "outgoing": link[1]
                            })
                        controlled_links.append(idx_links_data)

                    tls_configs[tls_id] = {
                        "id": tls_id,
                        "controlledLinks": controlled_links
                    }
                except Exception:
                    pass

            self.geometry_cache = {
                "lanes": lanes_data,
                "nodes": nodes_data,
                "trafficLights": tls_configs,
                "corridorJunctions": [
                    {"id": "J_SVNIT", "name": "SVNIT / Ichchhanath", "x": 250.0, "y": 200.0},
                    {"id": "J_GHODDOD", "name": "Ghod Dod Road", "x": 600.0, "y": 200.0},
                    {"id": "J_MAJURA", "name": "Majura Gate BRTS Hub", "x": 950.0, "y": 200.0},
                    {"id": "J_SAHARA", "name": "Sahara Darwaja Flyover", "x": 1300.0, "y": 200.0}
                ]
            }
            return self.geometry_cache
        except Exception as e:
            print(f"Error parsing geometry: {e}")
            return {"lanes": [], "nodes": [], "trafficLights": {}}

    def spawn_balanced_traffic(self, current_sim_time: float):
        """
        Spawns realistic 4-way traffic using balanced gateway-level distribution:
        - 24% West Arterial Corridor (West Entry + BRTS)
        - 24% East Arterial Corridor (East Entry + BRTS)
        - 52% Cross-Street Feeders evenly balanced across North and South approaches of all 4 junctions (6.5% each)
        Eliminates bottleneck overloading at single entry gateways (e.g. SVNIT West).
        """
        prob = (self.spawn_rate / 60.0) * 0.1  # probability per 0.1s step
        if random.random() >= prob:
            return

        self.veh_counter += 1
        veh_id = f"veh_{self.veh_counter}"

        # Balanced gateway selection
        gateways = list(GATEWAY_WEIGHTS.keys())
        weights = list(GATEWAY_WEIGHTS.values())
        gw = random.choices(gateways, weights=weights, k=1)[0]

        route_id = random.choice(GATEWAY_ROUTES[gw])

        # Vehicle Type selection
        if "brts" in gw:
            type_id = "brts_bus"
        else:
            type_id = random.choices(
                ["car", "motorcycle", "truck", "bus"],
                weights=[0.62, 0.22, 0.10, 0.06],
                k=1
            )[0]

        try:
            traci.vehicle.add(vehID=veh_id, routeID=route_id, typeID=type_id)
        except traci.TraCIException:
            pass

    def compute_approach_pressures(self, tls_id: str) -> Dict[str, Any]:
        """
        Calculates real-time approach traffic pressure for North, South, East, West approaches.
        Uses normalized vehicle counts, halting queues, occupancy, and waiting time.
        """
        approaches = JUNCTION_APPROACH_LANES.get(tls_id, {})
        metrics = {}

        for app_name, lane_ids in approaches.items():
            total_queue = 0
            total_wait = 0.0
            total_occ = 0.0
            total_veh = 0
            speeds = []

            for lid in lane_ids:
                try:
                    q = traci.lane.getLastStepHaltingNumber(lid)
                    w = traci.lane.getWaitingTime(lid)
                    occ = traci.lane.getLastStepOccupancy(lid)
                    v_cnt = traci.lane.getLastStepVehicleNumber(lid)
                    spd = traci.lane.getLastStepMeanSpeed(lid)

                    total_queue += q
                    total_wait += w
                    total_occ += occ
                    total_veh += v_cnt
                    if spd > 0:
                        speeds.append(spd * 3.6)
                except Exception:
                    pass

            avg_spd = sum(speeds) / max(len(speeds), 1) if speeds else 35.0
            avg_wait_sec = (total_wait / max(total_veh, 1)) if total_veh > 0 else 0.0
            pressure = (3.0 * total_queue) + (0.6 * avg_wait_sec) + (35.0 * total_occ) + (0.5 * total_veh)

            metrics[app_name] = {
                "vehicles": total_veh,
                "queue": total_queue,
                "speed": round(avg_spd, 1),
                "wait": round(avg_wait_sec, 1),
                "pressure": round(pressure, 1)
            }

        ew_pressure = round(metrics.get("EAST", {}).get("pressure", 0.0) + metrics.get("WEST", {}).get("pressure", 0.0), 1)
        ns_pressure = round(metrics.get("NORTH", {}).get("pressure", 0.0) + metrics.get("SOUTH", {}).get("pressure", 0.0), 1)

        return {
            "approaches": metrics,
            "ew_pressure": ew_pressure,
            "ns_pressure": ns_pressure
        }

    def check_brts_priority(self, tls_id: str, current_time: float) -> Optional[Dict[str, Any]]:
        """
        Detects approaching BRTS buses within 85m and triggers priority signal extension/switch.
        """
        if not self.brts_priority_enabled or self.scenario_mode == "fixed":
            return None

        # Check West and East incoming BRTS lanes (lane 0)
        brts_lanes = [
            JUNCTION_APPROACH_LANES[tls_id]["WEST"][0],
            JUNCTION_APPROACH_LANES[tls_id]["EAST"][0]
        ]

        for lane_id in brts_lanes:
            try:
                veh_ids = traci.lane.getLastStepVehicleIDs(lane_id)
                for vid in veh_ids:
                    if traci.vehicle.getTypeID(vid) in ["brts_bus", "bus"]:
                        lane_pos = traci.vehicle.getLanePosition(vid)
                        lane_len = traci.lane.getLength(lane_id)
                        dist_to_tls = max(0.0, lane_len - lane_pos)
                        spd = max(1.0, traci.vehicle.getSpeed(vid))
                        eta = dist_to_tls / spd

                        if dist_to_tls < 85.0:
                            return {
                                "busId": vid,
                                "laneId": lane_id,
                                "distance": round(dist_to_tls, 1),
                                "eta": f"{eta:.1f}s",
                                "speedKmh": round(spd * 3.6, 1)
                            }
            except Exception:
                pass
        return None

    def update_signal_controllers(self, current_time: float):
        """
        Executes dynamic 4-phase signal state machine for all 4 junctions:
        Every approach (North -> East -> South -> West) is guaranteed a turn with:
        1. Single Approach Open at a time (Zero conflicting turning movements)
        2. Dynamic Green Duration proportional to real-time approach queue:
           duration = clamp(min_green + queue * 2.2 + vehicles * 0.5, min_green, max_green)
        3. Gap-out early release: If active queue drops to 0 after min_green, advances to next phase.
        4. BRTS Transit Signal Priority: Approaching Sitilink buses extend active green or advance clearance.
        """
        for jid in CORRIDOR_TLS:
            machine = self.signal_machines[jid]
            current_phase = machine["phase"]
            elapsed_in_phase = current_time - machine["phase_start_time"]

            # Calculate live pressure and metrics for all 4 approaches
            p_data = self.compute_approach_pressures(jid)
            machine["approach_metrics"] = p_data["approaches"]
            machine["ew_pressure"] = p_data["ew_pressure"]
            machine["ns_pressure"] = p_data["ns_pressure"]

            app_name = PHASE_APPROACH_NAME[current_phase]
            curr_app_metrics = machine["approach_metrics"].get(app_name, {})
            curr_q = curr_app_metrics.get("queue", 0)
            curr_v = curr_app_metrics.get("vehicles", 0)

            # 1. FIXED-TIME CONTROL (Sequential 4-Phase: 15s North, 25s East, 15s South, 25s West, 3.5s Yellows)
            if self.scenario_mode == "fixed":
                fixed_green_times = {
                    PHASE_NORTH_GREEN: 15.0,
                    PHASE_EAST_GREEN: 25.0,
                    PHASE_SOUTH_GREEN: 15.0,
                    PHASE_WEST_GREEN: 25.0
                }
                if current_phase in GREEN_TO_YELLOW:
                    limit = fixed_green_times[current_phase]
                    if elapsed_in_phase >= limit:
                        yellow_phase = GREEN_TO_YELLOW[current_phase]
                        self._switch_tls_phase(jid, yellow_phase, current_time, f"Fixed-Time: {app_name} green complete ({limit}s) -> Yellow")
                elif current_phase in YELLOW_TO_NEXT_GREEN:
                    if elapsed_in_phase >= machine["yellow_duration"]:
                        next_green = YELLOW_TO_NEXT_GREEN[current_phase]
                        next_app = PHASE_APPROACH_NAME[next_green]
                        machine["target_duration"] = fixed_green_times[next_green]
                        self._switch_tls_phase(jid, next_green, current_time, f"Fixed-Time: Clearance complete -> {next_app} Green")
                continue

            # 2. ADAPTIVE TRAFFIC CONTROL (Single Direction Open + Queue-Based Dynamic Green + Gap-Out)

            # Handling Yellow Transitions -> Switch to next guaranteed approach in round-robin sequence
            if current_phase in YELLOW_TO_NEXT_GREEN:
                if elapsed_in_phase >= machine["yellow_duration"]:
                    next_green = YELLOW_TO_NEXT_GREEN[current_phase]
                    next_app = PHASE_APPROACH_NAME[next_green]
                    next_metrics = machine["approach_metrics"].get(next_app, {})
                    next_q = next_metrics.get("queue", 0)
                    next_v = next_metrics.get("vehicles", 0)

                    # Determine max green ceiling based on road hierarchy
                    is_arterial = next_app in ["EAST", "WEST"]
                    max_g = machine["max_green_arterial"] if is_arterial else machine["max_green_feeder"]
                    min_g = machine["min_green"]

                    # Calculate dynamic green time scaled to real-time queue
                    dynamic_duration = round(max(min_g, min(max_g, min_g + (next_q * 2.2) + (next_v * 0.5))), 1)
                    machine["target_duration"] = dynamic_duration

                    self._switch_tls_phase(
                        jid, next_green, current_time,
                        f"Serving {next_app} (Queue: {next_q} veh, Active: {next_v}) -> Allocated {dynamic_duration}s [Min: {min_g}s, Max: {max_g}s]"
                    )
                continue

            # Active Green Phase Handling
            if current_phase in GREEN_TO_YELLOW:
                yellow_phase = GREEN_TO_YELLOW[current_phase]
                min_g = machine["min_green"]
                target_dur = machine["target_duration"]

                # BRTS Priority Extension/Preemption
                brts_event = self.check_brts_priority(jid, current_time)
                if brts_event and self.brts_priority_enabled:
                    if app_name in ["EAST", "WEST"]:
                        # Approaching BRTS in currently green arterial approach -> extend green up to 55s
                        target_dur = min(55.0, target_dur + 10.0)
                        machine["target_duration"] = target_dur
                        machine["decision_reason"] = f"BRTS Priority Hold (Bus {brts_event['busId']} approaching, ETA {brts_event['eta']})"
                    elif elapsed_in_phase >= min_g:
                        # BRTS waiting on East/West while North/South is green -> expedite clearance
                        self._switch_tls_phase(
                            jid, yellow_phase, current_time,
                            f"BRTS Priority Preemption (Bus {brts_event['busId']} on {brts_event['laneId']}, ETA {brts_event['eta']}) -> Yellow"
                        )
                        continue

                # Rule 1: Always guarantee min_green to avoid rapid cycling
                if elapsed_in_phase < min_g:
                    machine["decision_reason"] = f"{app_name} Green Hold (Min: {min_g - elapsed_in_phase:.1f}s remaining, Queue: {curr_q})"
                # Rule 2: Max green ceiling reached -> yield to next approach to guarantee everyone gets a turn
                elif elapsed_in_phase >= target_dur:
                    self._switch_tls_phase(
                        jid, yellow_phase, current_time,
                        f"{app_name} Green Complete ({target_dur}s elapsed) -> Yielding to next approach"
                    )
                # Rule 3: Gap-Out - Queue has emptied and min_green passed -> yield early to prevent idle intersection
                elif curr_q == 0 and elapsed_in_phase >= (min_g + 2.0):
                    next_app = PHASE_APPROACH_NAME[YELLOW_TO_NEXT_GREEN[yellow_phase]]
                    next_q = machine["approach_metrics"].get(next_app, {}).get("queue", 0)
                    self._switch_tls_phase(
                        jid, yellow_phase, current_time,
                        f"{app_name} Gap-out (Queue cleared to 0) -> Yielding early to {next_app} (Queue: {next_q})"
                    )
                else:
                    machine["decision_reason"] = f"{app_name} Active Discharge (Queue: {curr_q} veh, Remaining: {max(0.0, target_dur - elapsed_in_phase):.1f}s)"

    def _switch_tls_phase(self, tls_id: str, new_phase: int, current_time: float, reason: str):
        """Sets the SUMO traffic light phase via TraCI and updates internal state machine."""
        machine = self.signal_machines[tls_id]
        machine["phase"] = new_phase
        machine["phase_start_time"] = current_time
        machine["decision_reason"] = reason

        state_mask = APPROACH_PHASE_STATES.get(new_phase)
        if state_mask and self.traci_started:
            try:
                traci.trafficlight.setRedYellowGreenState(tls_id, state_mask)
            except Exception as e:
                print(f"Error setting state mask for {tls_id}: {e}")

    def get_simulation_state(self) -> Dict[str, Any]:
        """Aggregates and formats the dynamic simulation state."""
        if not self.traci_started:
            return {
                "time": 0.0,
                "vehicles": [],
                "tls": {},
                "lanes": {},
                "stats": {
                    "activeVehicles": 0,
                    "completedVehicles": 0,
                    "avgSpeed": 0.0,
                    "spawnRate": self.spawn_rate,
                    "isPaused": self.is_paused,
                    "speedMultiplier": self.speed_multiplier,
                    "scenarioMode": self.scenario_mode,
                    "is5MinRunning": self.is_5min_running,
                    "demoProgress": 0.0
                },
                "signalIntelligence": {},
                "alerts": self.live_alerts[-5:]
            }

        sim_time = float(traci.simulation.getTime())
        vehicles_data = []
        active_ids = traci.vehicle.getIDList()

        # Prune vehicle static cache when tracking many vehicles
        if len(self.vehicle_static_cache) > 800:
            active_set = set(active_ids)
            self.vehicle_static_cache = {k: v for k, v in self.vehicle_static_cache.items() if k in active_set}

        for veh_id in active_ids:
            try:
                x, y = traci.vehicle.getPosition(veh_id)
                angle = traci.vehicle.getAngle(veh_id)
                speed = traci.vehicle.getSpeed(veh_id)
                lane_id = traci.vehicle.getLaneID(veh_id)
                wait_time = traci.vehicle.getWaitingTime(veh_id)
                accum_wait = traci.vehicle.getAccumulatedWaitingTime(veh_id)

                # Static attribute cache (eliminates 3 redundant socket queries per vehicle per step)
                if veh_id not in self.vehicle_static_cache:
                    type_id = traci.vehicle.getTypeID(veh_id)
                    length = traci.vehicle.getLength(veh_id)
                    width = traci.vehicle.getWidth(veh_id)
                    self.vehicle_static_cache[veh_id] = {
                        "type": type_id,
                        "length": float(length),
                        "width": float(width)
                    }
                v_static = self.vehicle_static_cache[veh_id]
                type_id = v_static["type"]
                length = v_static["length"]
                width = v_static["width"]

                v_edge = lane_id.rsplit("_", 1)[0] if "_" in lane_id else lane_id
                is_brts_lane = (v_edge in BRTS_CORRIDOR_EDGES) and lane_id.endswith("_0") and not lane_id.startswith(":")
                is_intruding = is_brts_lane and type_id not in ["brts_bus", "bus"]

                vehicles_data.append({
                    "id": veh_id,
                    "x": float(x),
                    "y": float(y),
                    "angle": float(angle),
                    "speed": float(speed),
                    "type": type_id,
                    "laneId": lane_id,
                    "waitingTime": float(wait_time),
                    "accumulatedWaitingTime": float(accum_wait),
                    "length": float(length),
                    "width": float(width),
                    "isIntruding": is_intruding
                })
            except traci.TraCIException:
                continue

        # Signal states & intelligence for all 4 corridor junctions
        tls_states = {}
        signal_intel = {}

        for tls_id in CORRIDOR_TLS:
            try:
                mach = self.signal_machines[tls_id]
                cur_phase = mach["phase"]
                elapsed = sim_time - mach["phase_start_time"]
                phase_name = PHASE_NAMES.get(cur_phase, "NORTH GREEN")
                active_approach = PHASE_APPROACH_NAME.get(cur_phase, "NORTH")
                is_yellow = cur_phase in [1, 3, 5, 7]

                # Duration remaining estimate
                dur_remaining = max(0.0, (mach["yellow_duration"] if is_yellow else mach["target_duration"]) - elapsed)

                active_color = "#f59e0b" if is_yellow else "#10b981"
                approach_colors = {
                    "NORTH": active_color if active_approach == "NORTH" else "#ef4444",
                    "EAST":  active_color if active_approach == "EAST"  else "#ef4444",
                    "SOUTH": active_color if active_approach == "SOUTH" else "#ef4444",
                    "WEST":  active_color if active_approach == "WEST"  else "#ef4444"
                }

                current_state_str = traci.trafficlight.getRedYellowGreenState(tls_id) if self.traci_started else APPROACH_PHASE_STATES.get(cur_phase, "")

                tls_states[tls_id] = {
                    "state": current_state_str,
                    "phase": cur_phase,
                    "phaseName": phase_name,
                    "activeApproach": active_approach,
                    "approachColors": approach_colors,
                    "elapsedInPhase": round(elapsed, 1),
                    "remainingSec": round(dur_remaining, 1),
                    "targetDuration": mach["target_duration"]
                }

                signal_intel[tls_id] = {
                    "id": tls_id,
                    "phase": cur_phase,
                    "phaseName": phase_name,
                    "activeApproach": active_approach,
                    "approachColors": approach_colors,
                    "remainingSec": round(dur_remaining, 1),
                    "targetDuration": mach["target_duration"],
                    "ewPressure": mach["ew_pressure"],
                    "nsPressure": mach["ns_pressure"],
                    "reason": mach["decision_reason"],
                    "approaches": mach["approach_metrics"]
                }
            except Exception:
                pass

        # Per-lane metrics & congestion coloring
        # Ultra-fast in-memory lane summary derived from vehicle telemetry (eliminates 320 blocking TraCI socket queries per step)
        lanes_summary = {}
        lane_veh_map = {}
        for v in vehicles_data:
            lid = v.get("laneId", "")
            if lid:
                if lid not in lane_veh_map:
                    lane_veh_map[lid] = {"count": 0, "halted": 0, "speeds": []}
                lane_veh_map[lid]["count"] += 1
                if v.get("speed", 0.0) < 0.1:
                    lane_veh_map[lid]["halted"] += 1
                lane_veh_map[lid]["speeds"].append(v.get("speed", 0.0))

        if self.geometry_cache and "lanes" in self.geometry_cache:
            for l in self.geometry_cache["lanes"]:
                lid = l["id"]
                l_data = lane_veh_map.get(lid)
                if l_data:
                    q_len = l_data["halted"]
                    v_cnt = l_data["count"]
                    occ = min(1.0, (v_cnt * 5.0) / max(l.get("length", 100.0), 30.0))
                    mean_spd = sum(l_data["speeds"]) / max(len(l_data["speeds"]), 1)
                    c_level = "critical" if q_len >= 6 or occ > 0.6 else "congested" if q_len >= 3 or occ > 0.3 else "moderate" if v_cnt > 0 else "low"
                else:
                    q_len = 0
                    v_cnt = 0
                    occ = 0.0
                    mean_spd = 13.89
                    c_level = "low"

                lanes_summary[lid] = {
                    "queueLength": int(q_len),
                    "occupancy": float(occ),
                    "vehicleCount": int(v_cnt),
                    "avgSpeed": float(mean_spd),
                    "congestionLevel": c_level
                }

        active_count = len(vehicles_data)
        avg_speed = sum(v["speed"] for v in vehicles_data) / max(active_count, 1)

        demo_progress = 0.0
        if self.is_5min_running:
            elapsed = sim_time - self.demo_start_time
            demo_progress = min(100.0, round((elapsed / self.demo_target_duration) * 100.0, 1))

        # Dynamic live streaming analytics (retrieved from 1-Hz cached state to eliminate compute lag)
        live_timeline = simulation_analytics.timeline[-60:] if simulation_analytics.timeline else []
        live_heatmaps = simulation_analytics.cached_heatmaps or simulation_analytics._generate_spatial_heatmaps()
        live_bottlenecks = simulation_analytics.cached_bottlenecks or simulation_analytics._calculate_dynamic_bottlenecks()
        live_junctions = simulation_analytics.cached_junctions or simulation_analytics._generate_detailed_junctions_analytics(max(sim_time, 1.0))
        latest_pt = simulation_analytics.timeline[-1] if simulation_analytics.timeline else None
        dyn_wait = round(latest_pt["avgWaitTime"], 1) if latest_pt else 0.0
        dyn_queue = latest_pt["maxQueue"] if latest_pt else 0

        live_whatif = simulation_analytics.cached_whatif or simulation_analytics._compute_ground_truth_comparison(
            cur_throughput=round((len(simulation_analytics.completed_vehicles) / max(sim_time, 1.0)) * 3600, 1),
            cur_speed=round(avg_speed * 3.6, 1),
            cur_wait=dyn_wait,
            cur_queue=dyn_queue,
            cur_co2=round(simulation_analytics.total_co2_grams / 1000.0, 2),
            cur_fuel=round(simulation_analytics.total_fuel_ml / 1000.0, 2),
            cur_completed=len(simulation_analytics.completed_vehicles),
            junctions_data=live_junctions
        )

        state_payload = {
            "time": sim_time,
            "vehicles": vehicles_data,
            "tls": tls_states,
            "lanes": lanes_summary,
            "stats": {
                "activeVehicles": active_count,
                "completedVehicles": len(simulation_analytics.completed_vehicles),
                "avgSpeed": float(avg_speed),
                "spawnRate": float(self.spawn_rate),
                "isPaused": self.is_paused,
                "speedMultiplier": float(self.speed_multiplier),
                "scenarioMode": self.scenario_mode,
                "is5MinRunning": self.is_5min_running,
                "demoProgress": demo_progress
            },
            "signalIntelligence": signal_intel,
            "liveTimeline": live_timeline,
            "liveHeatmaps": live_heatmaps,
            "liveBottlenecks": live_bottlenecks,
            "liveJunctions": live_junctions,
            "liveWhatIf": live_whatif,
            "sustainability": {
                "co2Kg": round(simulation_analytics.total_co2_grams / 1000.0, 2),
                "fuelLiters": round(simulation_analytics.total_fuel_ml / 1000.0, 2)
            },
            "alerts": self.live_alerts[-5:]
        }

        # Feed micro-step into telemetry analytics engine
        if not self.is_paused:
            simulation_analytics.record_step(sim_time, state_payload, lanes_summary)

        return state_payload

    async def start(self):
        """Initializes and starts the SUMO simulation background loop."""
        if not SUMO_AVAILABLE:
            print("SUMO is not installed or SUMO_HOME is invalid. Cannot start simulation.")
            return

        if self.traci_started:
            print("Simulation is already running.")
            return

        # 1. Compile 4-junction corridor if missing
        self.ensure_network()

        # 2. Start SUMO subprocess
        sumo_binary = "sumo"  # Run headless inside backend
        sumo_cmd = [sumo_binary, "-c", self.sumocfg_path]

        print(f"Starting {sumo_binary} and initializing TraCI...")
        try:
            traci.start(sumo_cmd)
            traci.simulationStep()
            for jid in CORRIDOR_TLS:
                try:
                    traci.trafficlight.setRedYellowGreenState(jid, APPROACH_PHASE_STATES[PHASE_NORTH_GREEN])
                except Exception:
                    pass
            self.traci_started = True
            self.is_initialized = True
            print("TraCI initialized successfully with 4-junction corridor network.")
        except Exception as e:
            print(f"Failed to start SUMO / TraCI: {e}")
            self.traci_started = False
            return

        # Pre-populate geometry cache
        self.get_network_geometry()

        # 3. Spawn background simulation loop
        self.loop_task = asyncio.create_task(self.simulation_loop())

    async def stop(self):
        """Stops the simulation and closes the TraCI subprocess connection."""
        print("Shutting down SUMO Service...")
        if self.loop_task:
            self.loop_task.cancel()
            try:
                await self.loop_task
            except asyncio.CancelledError:
                pass
            self.loop_task = None

        if self.traci_started:
            try:
                traci.close()
            except Exception:
                pass
            self.traci_started = False

        self.is_initialized = False
        print("SUMO Service shutdown complete.")

    async def reset(self):
        """Resets the simulation state and cleans vehicles."""
        print("Resetting SUMO simulation environment...")
        self.is_paused = True
        self.is_5min_running = False
        self.live_alerts = []
        self.vehicle_static_cache.clear()
        simulation_analytics.reset()

        for jid in CORRIDOR_TLS:
            self.signal_machines[jid]["phase"] = PHASE_NORTH_GREEN
            self.signal_machines[jid]["phase_start_time"] = 0.0
            self.signal_machines[jid]["target_duration"] = 15.0
            self.signal_machines[jid]["decision_reason"] = "Cycle initialization: North approach green"

        if self.traci_started:
            try:
                traci.load(["-c", self.sumocfg_path])
                traci.simulationStep()
                for jid in CORRIDOR_TLS:
                    traci.trafficlight.setRedYellowGreenState(jid, APPROACH_PHASE_STATES[PHASE_NORTH_GREEN])
                print("SUMO reload complete.")
            except Exception as e:
                print(f"Error reloading SUMO: {e}")
                await self.stop()
                await self.start()

    async def run_5min_demo(self, scenario: str = "adaptive", demand: str = "peak"):
        """Initiates a dedicated 5-minute (300 simulation seconds) demonstration run."""
        await self.reset()

        self.scenario_mode = scenario
        self.demand_preset = demand
        self.spawn_rate = 90.0 if demand == "peak" else 60.0 if demand == "heavy" else 30.0 if demand == "normal" else 15.0

        simulation_analytics.scenario_mode = scenario
        simulation_analytics.demand_level = demand
        simulation_analytics.spawn_rate = self.spawn_rate
        simulation_analytics.scenario_name = (
            "Adaptive Traffic Control" if scenario == "adaptive" else
            "Traditional Fixed-Time Control"
        )

        current_sim_time = float(traci.simulation.getTime()) if self.traci_started else 0.0
        self.demo_start_time = current_sim_time
        self.demo_target_duration = 300.0  # 300 seconds
        self.is_5min_running = True
        self.is_paused = False

        self.live_alerts.append({
            "id": f"ALT_{int(time.time())}",
            "timestamp": "00:00",
            "severity": "info",
            "title": "5-Minute Simulation Started",
            "message": f"Scenario: {simulation_analytics.scenario_name} | Demand: {demand.upper()} ({self.spawn_rate} veh/min)"
        })

    async def simulation_loop(self):
        """Asynchronous loop stepping SUMO and broadcasting state to WebSocket clients."""
        while self.traci_started:
            try:
                if not self.is_paused or self.should_step:
                    if self.should_step:
                        self.should_step = False

                    current_sim_time = float(traci.simulation.getTime())

                    # 1. Dynamically spawn vehicles using balanced 4-way OD matrix
                    self.spawn_balanced_traffic(current_sim_time)

                    # 2. Advance SUMO simulation by 0.1s step
                    traci.simulationStep()

                    # 3. Apply Signal Control logic (Webster Adaptive / Green Wave / Fixed)
                    if not self.is_manual_tl:
                        self.update_signal_controllers(current_sim_time)

                    # 4. Check 5-Minute Demonstration Run Completion
                    if self.is_5min_running:
                        elapsed = current_sim_time - self.demo_start_time
                        if elapsed >= self.demo_target_duration:
                            print(f"5-Minute Simulation Run Complete at t={current_sim_time:.1f}s.")
                            self.is_5min_running = False
                            self.is_paused = True

                            # Automatically generate final analytics report
                            final_report = simulation_analytics.generate_final_analytics()

                            self.live_alerts.append({
                                "id": f"ALT_COMP_{int(time.time())}",
                                "timestamp": f"{int(elapsed // 60):02d}:{int(elapsed % 60):02d}",
                                "severity": "success",
                                "title": "5-Minute Simulation Complete",
                                "message": f"Throughput: {final_report['kpis']['throughputVph']} veh/hr | Avg Speed: {final_report['kpis']['avgSpeedKmh']} km/h"
                            })

                            # Broadcast completion event with full report payload
                            if self.clients:
                                complete_payload = json.dumps({
                                    "type": "simulation_complete",
                                    "data": final_report
                                })
                                await asyncio.gather(
                                    *[c.send_text(complete_payload) for c in self.clients],
                                    return_exceptions=True
                                )

                    # 5. Broadcast state to connected WebSocket clients
                    if self.clients:
                        state = self.get_simulation_state()
                        payload = json.dumps({
                            "type": "state",
                            "data": state
                        })
                        await asyncio.gather(
                            *[client.send_text(payload) for client in self.clients],
                            return_exceptions=True
                        )

                # Step delay adjustment (Exact 1:1 real-time pacing at 1x speed)
                if self.is_paused:
                    await asyncio.sleep(0.1)
                else:
                    delay = max(0.01, 0.08 / max(self.speed_multiplier, 0.1))
                    await asyncio.sleep(delay)

            except Exception as e:
                print(f"Error in SUMO simulation loop: {e}")
                await asyncio.sleep(0.1)

    async def register_client(self, websocket: WebSocket):
        """Adds a client to the broadcast pool and sends them the initial state."""
        self.clients.add(websocket)
        print(f"WebSocket client connected. Total clients: {len(self.clients)}")

        try:
            geom = self.get_network_geometry()
            await websocket.send_json({
                "type": "geometry",
                "data": geom
            })

            await websocket.send_json({
                "type": "config",
                "data": {
                    "isPaused": self.is_paused,
                    "spawnRate": self.spawn_rate,
                    "speedMultiplier": self.speed_multiplier,
                    "scenarioMode": self.scenario_mode,
                    "demandPreset": self.demand_preset,
                    "isManualTl": self.is_manual_tl,
                    "is5MinRunning": self.is_5min_running,
                    "brtsPriorityEnabled": self.brts_priority_enabled
                }
            })

            state = self.get_simulation_state()
            await websocket.send_json({
                "type": "state",
                "data": state
            })
        except Exception as e:
            print(f"Error sending initialization payloads to client: {e}")

    def unregister_client(self, websocket: WebSocket):
        """Removes a client from the broadcast pool."""
        if websocket in self.clients:
            self.clients.remove(websocket)
            print(f"WebSocket client disconnected. Total clients: {len(self.clients)}")

    async def handle_message(self, websocket: WebSocket, raw_message: str):
        """Processes control payloads received from WebSocket clients."""
        try:
            msg = json.loads(raw_message)
            msg_type = msg.get("type")

            if msg_type == "pause":
                self.is_paused = True
            elif msg_type == "resume":
                self.is_paused = False
            elif msg_type == "step":
                self.should_step = True
            elif msg_type == "reset":
                await self.reset()
            elif msg_type == "run_5min":
                scenario = msg.get("scenario", "adaptive")
                demand = msg.get("demand", "peak")
                await self.run_5min_demo(scenario, demand)
            elif msg_type == "set_scenario":
                self.scenario_mode = msg.get("scenario", "adaptive")
                simulation_analytics.scenario_mode = self.scenario_mode
                simulation_analytics.scenario_name = "Adaptive Traffic Control" if self.scenario_mode == "adaptive" else "Traditional Fixed-Time Control"
            elif msg_type == "set_demand_preset":
                self.demand_preset = msg.get("preset", "peak")
                rates = {"low": 15.0, "normal": 30.0, "heavy": 60.0, "peak": 90.0}
                self.spawn_rate = rates.get(self.demand_preset, self.spawn_rate)
            elif msg_type == "set_spawn_rate":
                self.spawn_rate = max(0.0, float(msg.get("value", 60.0)))
                self.demand_preset = "custom"
            elif msg_type == "set_speed_multiplier":
                self.speed_multiplier = max(0.1, float(msg.get("value", 1.0)))
            elif msg_type == "set_brts_priority":
                self.brts_priority_enabled = bool(msg.get("enabled", True))

            # Broadcast configuration update
            config_payload = json.dumps({
                "type": "config",
                "data": {
                    "isPaused": self.is_paused,
                    "spawnRate": self.spawn_rate,
                    "speedMultiplier": self.speed_multiplier,
                    "scenarioMode": self.scenario_mode,
                    "demandPreset": self.demand_preset,
                    "isManualTl": self.is_manual_tl,
                    "is5MinRunning": self.is_5min_running,
                    "brtsPriorityEnabled": self.brts_priority_enabled
                }
            })
            await asyncio.gather(
                *[c.send_text(config_payload) for c in self.clients],
                return_exceptions=True
            )
        except Exception as e:
            print(f"Error handling message from client: {e}")

sumo_service = SumoService()
