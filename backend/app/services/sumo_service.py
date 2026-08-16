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

# Weighted Route Categories
ROUTE_CATEGORIES = {
    "corridor_through": [
        "r_MAIN_W_TO_E", "r_MAIN_E_TO_W",
        "r_W_TO_GHODDOD_N", "r_W_TO_MAJURA_S", "r_E_TO_MAJURA_N", "r_E_TO_GHODDOD_S"
    ],
    "cross_feeder": [
        "r_SVNIT_N_TO_S", "r_SVNIT_S_TO_N",
        "r_GHODDOD_N_TO_S", "r_GHODDOD_S_TO_N",
        "r_MAJURA_N_TO_S", "r_MAJURA_S_TO_N",
        "r_SAHARA_N_TO_S", "r_SAHARA_S_TO_N"
    ],
    "turning_movements": [
        "r_SVNIT_N_TO_E", "r_SVNIT_N_TO_W", "r_SVNIT_S_TO_E", "r_SVNIT_S_TO_W", "r_SVNIT_W_TO_N", "r_SVNIT_W_TO_S",
        "r_GHODDOD_N_TO_E", "r_GHODDOD_N_TO_W", "r_GHODDOD_S_TO_E", "r_GHODDOD_S_TO_W",
        "r_MAJURA_N_TO_E", "r_MAJURA_N_TO_W", "r_MAJURA_S_TO_E", "r_MAJURA_S_TO_W",
        "r_SAHARA_N_TO_W", "r_SAHARA_N_TO_E", "r_SAHARA_S_TO_W", "r_SAHARA_S_TO_E", "r_SAHARA_E_TO_N", "r_SAHARA_E_TO_S"
    ],
    "brts_corridor": [
        "r_BRTS_W_TO_E", "r_BRTS_E_TO_W"
    ]
}

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

        # 5-minute automated run tracking
        self.is_5min_running = False
        self.demo_start_time = 0.0
        self.demo_target_duration = 300.0  # 300 simulation seconds = 5 min

        self.veh_counter = 0
        self.clients: Set[WebSocket] = set()
        self.loop_task = None
        self.geometry_cache = None

        # Signal State Machine for 4 junctions
        # Phases: 0 = EW Green, 1 = EW Yellow, 2 = NS Green, 3 = NS Yellow
        self.signal_machines: Dict[str, Dict[str, Any]] = {}
        for jid in CORRIDOR_TLS:
            self.signal_machines[jid] = {
                "phase": 0,               # 0: EW Green, 1: EW Yellow, 2: NS Green, 3: NS Yellow
                "phase_start_time": 0.0,
                "target_duration": 30.0,
                "min_green": 12.0,
                "max_green": 50.0,
                "yellow_duration": 3.5,
                "transitioning_to": None,
                "ew_pressure": 0.0,
                "ns_pressure": 0.0,
                "decision_reason": "Initial EW arterial progression",
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
                for lane in edge.getLanes():
                    shape = [[float(coord[0]), float(coord[1])] for coord in lane.getShape()]
                    is_brts = lane.getID().endswith("_0") and not lane.getID().startswith(":")
                    lanes_data.append({
                        "id": lane.getID(),
                        "edgeId": edge.getID(),
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
        Spawns realistic 4-way traffic using weighted OD matrix:
        - 50% Through Corridor Spine (West -> East & East -> West)
        - 20% North-South Cross-traffic
        - 20% Turning movements (inflow/outflow)
        - 10% Dedicated BRTS buses (running in both directions)
        """
        prob = (self.spawn_rate / 60.0) * 0.1  # probability per 0.1s step
        if random.random() >= prob:
            return

        self.veh_counter += 1
        veh_id = f"veh_{self.veh_counter}"

        # Category selection
        cat = random.choices(
            ["corridor_through", "cross_feeder", "turning_movements", "brts_corridor"],
            weights=[0.48, 0.22, 0.22, 0.08],
            k=1
        )[0]

        route_id = random.choice(ROUTE_CATEGORIES[cat])

        # Vehicle Type selection
        if cat == "brts_corridor":
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
        Pressure = 2.0*Queue + 1.0*Waiting + 25.0*Occupancy + 0.8*Approaching
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
            pressure = (2.0 * total_queue) + (0.5 * (total_wait / max(total_veh, 1))) + (25.0 * total_occ) + (0.8 * total_veh)

            metrics[app_name] = {
                "vehicles": total_veh,
                "queue": total_queue,
                "speed": round(avg_spd, 1),
                "wait": round(total_wait / max(total_veh, 1), 1),
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
        if not self.brts_priority_enabled or self.scenario_mode not in ["adaptive_brts", "green_wave"]:
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
        Executes signal state machine for all 4 junctions:
        1. Adaptive Traffic Control (Queue-Pressure dynamic signal timing)
        2. Traditional Fixed-Time Control (Predefined signal cycle baseline)
        """
        for jid in CORRIDOR_TLS:
            machine = self.signal_machines[jid]
            current_phase = machine["phase"]
            elapsed_in_phase = current_time - machine["phase_start_time"]

            # Calculate live pressure and metrics
            p_data = self.compute_approach_pressures(jid)
            machine["approach_metrics"] = p_data["approaches"]
            machine["ew_pressure"] = p_data["ew_pressure"]
            machine["ns_pressure"] = p_data["ns_pressure"]

            # 1. TRADITIONAL FIXED-TIME CONTROL (60s cycle: 30s EW Green, 3.5s Yellow, 23s NS Green, 3.5s Yellow)
            if self.scenario_mode == "fixed":
                if current_phase == 0 and elapsed_in_phase >= 30.0:
                    self._switch_tls_phase(jid, 1, current_time, "Fixed-Time: EW Green interval complete -> Yellow transition")
                elif current_phase == 1 and elapsed_in_phase >= machine["yellow_duration"]:
                    self._switch_tls_phase(jid, 2, current_time, "Fixed-Time: Yellow interval complete -> NS Green")
                elif current_phase == 2 and elapsed_in_phase >= 23.0:
                    self._switch_tls_phase(jid, 3, current_time, "Fixed-Time: NS Green interval complete -> Yellow transition")
                elif current_phase == 3 and elapsed_in_phase >= machine["yellow_duration"]:
                    self._switch_tls_phase(jid, 0, current_time, "Fixed-Time: Yellow interval complete -> EW Green")
                continue

            # 2. ADAPTIVE TRAFFIC CONTROL (Coordinated Max-Pressure with Progression Bands)
            # Handle Yellow clearance transitions
            if current_phase == 1:  # EW Yellow -> Switch to NS Green after yellow duration
                if elapsed_in_phase >= machine["yellow_duration"]:
                    self._switch_tls_phase(jid, 2, current_time, f"Yellow clearance complete -> NS Green (Pressure: {p_data['ns_pressure']})")
                continue
            elif current_phase == 3:  # NS Yellow -> Switch to EW Green after yellow duration
                if elapsed_in_phase >= machine["yellow_duration"]:
                    self._switch_tls_phase(jid, 0, current_time, f"Yellow clearance complete -> EW Green (Pressure: {p_data['ew_pressure']})")
                continue

            # Coordinated Arterial Progression Offset (12s offset along 350m spacing at 45 km/h)
            j_idx = CORRIDOR_TLS.index(jid)
            prog_offset = j_idx * 12.0
            cycle_time = 60.0
            prog_pos = (current_time + prog_offset) % cycle_time
            is_green_wave_window = prog_pos < 34.0

            # Evaluate Green Phase Extensions vs Phase Transitions
            if current_phase == 0:  # Currently EW Green
                ew_p = p_data["ew_pressure"]
                ns_p = p_data["ns_pressure"]

                if elapsed_in_phase < machine["min_green"]:
                    machine["decision_reason"] = f"Holding EW Green (Min green hold: {machine['min_green'] - elapsed_in_phase:.1f}s remaining)"
                elif is_green_wave_window and elapsed_in_phase < 42.0:
                    # Hold green during arterial platoon arrival
                    machine["decision_reason"] = f"Coordinated Arterial Green Wave Platoon Window ({prog_offset:.0f}s offset sync)"
                elif ns_p > (ew_p + 10.0) and elapsed_in_phase >= machine["min_green"]:
                    # Competing NS pressure is significantly higher -> Switch to Yellow
                    self._switch_tls_phase(jid, 1, current_time, f"NS Pressure ({ns_p}) > EW ({ew_p}) -> Initiating Yellow transition")
                elif elapsed_in_phase >= machine["max_green"]:
                    # Max green ceiling reached -> Force phase switch to prevent NS starvation
                    self._switch_tls_phase(jid, 1, current_time, f"EW Max Green ({machine['max_green']}s) reached -> Switching to NS")
                else:
                    machine["decision_reason"] = f"EW Pressure ({ew_p}) dominant -> Extended Green"

            elif current_phase == 2:  # Currently NS Green
                ew_p = p_data["ew_pressure"]
                ns_p = p_data["ns_pressure"]

                if elapsed_in_phase < machine["min_green"]:
                    machine["decision_reason"] = f"Holding NS Green (Min green hold: {machine['min_green'] - elapsed_in_phase:.1f}s remaining)"
                elif is_green_wave_window and ew_p > 8.0:
                    # Inbound arterial platoon approaching -> Clear NS and return to EW
                    self._switch_tls_phase(jid, 3, current_time, "Arterial Platoon Inbound -> Preempting NS Green for EW Corridor Wave")
                elif ew_p > (ns_p + 10.0) and elapsed_in_phase >= machine["min_green"]:
                    self._switch_tls_phase(jid, 3, current_time, f"EW Pressure ({ew_p}) > NS ({ns_p}) -> Initiating Yellow transition")
                elif elapsed_in_phase >= machine["max_green"]:
                    self._switch_tls_phase(jid, 3, current_time, f"NS Max Green ({machine['max_green']}s) reached -> Switching to EW")
                else:
                    machine["decision_reason"] = f"NS Pressure ({ns_p}) dominant over EW ({ew_p}) -> Extended Green"

                if elapsed_in_phase < machine["min_green"]:
                    machine["decision_reason"] = f"Holding EW Green (Min green hold: {machine['min_green'] - elapsed_in_phase:.1f}s remaining)"
                elif ns_p > (ew_p + 8.0) and elapsed_in_phase >= machine["min_green"]:
                    # Competing NS pressure is significantly higher -> Switch to Yellow
                    self._switch_tls_phase(jid, 1, current_time, f"NS Pressure ({ns_p}) > EW ({ew_p}) -> Initiating Yellow transition")
                elif elapsed_in_phase >= machine["max_green"]:
                    # Max green ceiling reached -> Force phase switch to prevent NS starvation
                    self._switch_tls_phase(jid, 1, current_time, f"EW Max Green ({machine['max_green']}s) reached -> Switching to NS")
                else:
                    # Extend green
                    machine["decision_reason"] = f"EW Pressure ({ew_p}) dominant over NS ({ns_p}) -> Extended Green"

            elif current_phase == 2:  # Currently NS Green
                ew_p = p_data["ew_pressure"]
                ns_p = p_data["ns_pressure"]

                if elapsed_in_phase < machine["min_green"]:
                    machine["decision_reason"] = f"Holding NS Green (Min green hold: {machine['min_green'] - elapsed_in_phase:.1f}s remaining)"
                elif ew_p > (ns_p + 8.0) and elapsed_in_phase >= machine["min_green"]:
                    # Competing EW pressure is significantly higher -> Switch to Yellow
                    self._switch_tls_phase(jid, 3, current_time, f"EW Pressure ({ew_p}) > NS ({ns_p}) -> Initiating Yellow transition")
                elif elapsed_in_phase >= machine["max_green"]:
                    # Max green ceiling reached -> Force phase switch
                    self._switch_tls_phase(jid, 3, current_time, f"NS Max Green ({machine['max_green']}s) reached -> Switching to EW")
                else:
                    machine["decision_reason"] = f"NS Pressure ({ns_p}) dominant over EW ({ew_p}) -> Extended Green"

    def _switch_tls_phase(self, tls_id: str, new_phase: int, current_time: float, reason: str):
        """Sets the SUMO traffic light phase via TraCI and updates internal state machine."""
        machine = self.signal_machines[tls_id]
        machine["phase"] = new_phase
        machine["phase_start_time"] = current_time
        machine["decision_reason"] = reason

        try:
            traci.trafficlight.setPhase(tls_id, new_phase)
        except Exception as e:
            print(f"Error setting phase for {tls_id}: {e}")

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

        for veh_id in active_ids:
            try:
                x, y = traci.vehicle.getPosition(veh_id)
                angle = traci.vehicle.getAngle(veh_id)
                speed = traci.vehicle.getSpeed(veh_id)
                type_id = traci.vehicle.getTypeID(veh_id)
                lane_id = traci.vehicle.getLaneID(veh_id)
                wait_time = traci.vehicle.getWaitingTime(veh_id)
                length = traci.vehicle.getLength(veh_id)
                width = traci.vehicle.getWidth(veh_id)

                is_brts_lane = lane_id.endswith("_0") and not lane_id.startswith(":")
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
                phase_name = "EW GREEN" if cur_phase == 0 else "EW YELLOW" if cur_phase == 1 else "NS GREEN" if cur_phase == 2 else "NS YELLOW"

                # Duration remaining estimate
                dur_remaining = max(0.0, (mach["target_duration"] if cur_phase in [0, 2] else mach["yellow_duration"]) - elapsed)

                tls_states[tls_id] = {
                    "state": traci.trafficlight.getRedYellowGreenState(tls_id),
                    "phase": cur_phase,
                    "phaseName": phase_name,
                    "elapsedInPhase": round(elapsed, 1),
                    "remainingSec": round(dur_remaining, 1)
                }

                signal_intel[tls_id] = {
                    "id": tls_id,
                    "phase": cur_phase,
                    "phaseName": phase_name,
                    "remainingSec": round(dur_remaining, 1),
                    "ewPressure": mach["ew_pressure"],
                    "nsPressure": mach["ns_pressure"],
                    "reason": mach["decision_reason"],
                    "approaches": mach["approach_metrics"]
                }
            except Exception:
                pass

        # Per-lane metrics & congestion coloring
        lanes_summary = {}
        if self.geometry_cache and "lanes" in self.geometry_cache:
            for l in self.geometry_cache["lanes"]:
                lid = l["id"]
                try:
                    q_len = traci.lane.getLastStepHaltingNumber(lid)
                    occ = traci.lane.getLastStepOccupancy(lid)
                    v_cnt = traci.lane.getLastStepVehicleNumber(lid)
                    mean_spd = traci.lane.getLastStepMeanSpeed(lid)

                    # Congestion classification
                    c_level = "critical" if q_len >= 8 or occ > 0.6 else "congested" if q_len >= 4 or occ > 0.3 else "moderate" if v_cnt > 0 else "low"

                    lanes_summary[lid] = {
                        "queueLength": int(q_len),
                        "occupancy": float(occ),
                        "vehicleCount": int(v_cnt),
                        "avgSpeed": float(mean_spd),
                        "congestionLevel": c_level
                    }
                except Exception:
                    pass

        active_count = len(vehicles_data)
        avg_speed = sum(v["speed"] for v in vehicles_data) / max(active_count, 1)

        demo_progress = 0.0
        if self.is_5min_running:
            elapsed = sim_time - self.demo_start_time
            demo_progress = min(100.0, round((elapsed / self.demo_target_duration) * 100.0, 1))

        # Dynamic live streaming analytics
        live_timeline = simulation_analytics.timeline[-60:] if simulation_analytics.timeline else []
        live_heatmaps = simulation_analytics._generate_spatial_heatmaps()
        live_bottlenecks = simulation_analytics._calculate_dynamic_bottlenecks()
        live_junctions = simulation_analytics._generate_detailed_junctions_analytics(max(sim_time, 1.0))
        cur_tp = round((len(simulation_analytics.completed_vehicles) / max(sim_time, 1.0)) * 3600, 1)
        cur_spd = round(avg_speed * 3.6, 1)
        recent_waits = [p["avgWaitTime"] for p in simulation_analytics.timeline[-10:]]
        cur_wait = round(sum(recent_waits) / max(len(recent_waits), 1), 1) if recent_waits else 0.0
        cur_q = max([p["totalQueue"] for p in simulation_analytics.timeline[-10:]] or [0])
        cur_co2 = round(simulation_analytics.total_co2_grams / 1000.0, 2)
        cur_fuel = round(simulation_analytics.total_fuel_ml / 1000.0, 2)

        live_whatif = simulation_analytics._compute_ground_truth_comparison(
            cur_throughput=cur_tp,
            cur_speed=cur_spd,
            cur_wait=cur_wait,
            cur_queue=cur_q,
            cur_co2=cur_co2,
            cur_fuel=cur_fuel,
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
                "co2Kg": cur_co2,
                "fuelLiters": cur_fuel
            },
            "alerts": self.live_alerts[-5:]
        }

        # Feed step into telemetry analytics store
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
        simulation_analytics.reset()

        for jid in CORRIDOR_TLS:
            self.signal_machines[jid]["phase"] = 0
            self.signal_machines[jid]["phase_start_time"] = 0.0

        if self.traci_started:
            try:
                traci.load(["-c", self.sumocfg_path])
                traci.simulationStep()
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

                # Step delay adjustment
                if self.is_paused:
                    await asyncio.sleep(0.1)
                else:
                    delay = max(0.002, 0.1 / self.speed_multiplier)
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
                    "is5MinRunning": self.is_5min_running
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
                    "is5MinRunning": self.is_5min_running
                }
            })
            await asyncio.gather(
                *[c.send_text(config_payload) for c in self.clients],
                return_exceptions=True
            )
        except Exception as e:
            print(f"Error handling message from client: {e}")

sumo_service = SumoService()
