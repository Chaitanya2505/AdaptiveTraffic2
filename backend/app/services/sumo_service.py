import os
import sys
import json
import random
import asyncio
from typing import Set, Dict, Any
from fastapi import WebSocket

# Setup SUMO paths
if "SUMO_HOME" in os.environ:
    tools = os.path.join(os.environ["SUMO_HOME"], "tools")
    if tools not in sys.path:
        sys.path.append(tools)
else:
    homebrew_sumo_tools = "/opt/homebrew/opt/sumo/share/sumo/tools"
    if os.path.exists(homebrew_sumo_tools):
        sys.path.append(homebrew_sumo_tools)

try:
    import traci
    import sumolib
    SUMO_AVAILABLE = True
except ImportError:
    SUMO_AVAILABLE = False

ROUTES = [
    "r_N2S", "r_N2E", "r_N2W",
    "r_S2N", "r_S2E", "r_S2W",
    "r_E2W", "r_E2N", "r_E2S",
    "r_W2E", "r_W2N", "r_W2S"
]
VEHICLE_TYPES = ["car", "truck", "bus"]
VEHICLE_WEIGHTS = [0.75, 0.15, 0.10]

class SumoService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(SumoService, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    def __init__(self):
        # Prevent re-initialization if already done
        if hasattr(self, "_initialized") and self._initialized:
            return
        
        self._initialized = True
        self.is_initialized = False
        self.traci_started = False
        
        # State variables
        self.is_paused = True
        self.should_step = False
        self.spawn_rate = 30.0  # vehicles per minute
        self.speed_multiplier = 1.0
        self.is_manual_tl = False
        self.veh_counter = 0
        self.clients: Set[WebSocket] = set()
        self.loop_task = None
        self.geometry_cache = None

        # Setup directories
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.simulation_dir = os.path.join(self.base_dir, "simulation")
        self.sumocfg_path = os.path.join(self.simulation_dir, "simulation.sumocfg")
        self.net_path = os.path.join(self.simulation_dir, "net.net.xml")

    def create_sumo_files(self):
        """Generates SUMO network XML and configuration files if they are missing."""
        if not SUMO_AVAILABLE:
            print("SUMO is not available, skipping file generation.")
            return

        os.makedirs(self.simulation_dir, exist_ok=True)
        
        # 1. Nodes
        nodes_content = """<nodes>
    <node id="center" x="0" y="0" type="traffic_light"/>
    <node id="north" x="0" y="200" type="priority"/>
    <node id="south" x="0" y="-200" type="priority"/>
    <node id="east" x="200" y="0" type="priority"/>
    <node id="west" x="-200" y="0" type="priority"/>
</nodes>
"""
        with open(os.path.join(self.simulation_dir, "net.nod.xml"), "w") as f:
            f.write(nodes_content)

        # 2. Edges
        edges_content = """<edges>
    <edge id="N2C" from="north" to="center" numLanes="2" speed="13.89"/>
    <edge id="S2C" from="south" to="center" numLanes="2" speed="13.89"/>
    <edge id="E2C" from="east" to="center" numLanes="2" speed="13.89"/>
    <edge id="W2C" from="west" to="center" numLanes="2" speed="13.89"/>
    
    <edge id="C2N" from="center" to="north" numLanes="2" speed="13.89"/>
    <edge id="C2S" from="center" to="south" numLanes="2" speed="13.89"/>
    <edge id="C2E" from="center" to="east" numLanes="2" speed="13.89"/>
    <edge id="C2W" from="center" to="west" numLanes="2" speed="13.89"/>
</edges>
"""
        with open(os.path.join(self.simulation_dir, "net.edg.xml"), "w") as f:
            f.write(edges_content)

        # 3. Routes
        routes_content = """<routes>
    <vType id="car" vClass="passenger" length="5.0" minGap="2.5" maxSpeed="13.89" accel="2.6" decel="4.5" sigma="0.5" color="0,255,255"/>
    <vType id="truck" vClass="truck" length="10.0" minGap="3.0" maxSpeed="8.0" accel="1.2" decel="3.5" sigma="0.5" color="255,255,0"/>
    <vType id="bus" vClass="bus" length="12.0" minGap="3.0" maxSpeed="10.0" accel="1.5" decel="4.0" sigma="0.5" color="255,165,0"/>

    <!-- Routes -->
    <route id="r_N2S" edges="N2C C2S"/>
    <route id="r_N2E" edges="N2C C2E"/>
    <route id="r_N2W" edges="N2C C2W"/>

    <route id="r_S2N" edges="S2C C2N"/>
    <route id="r_S2E" edges="S2C C2E"/>
    <route id="r_S2W" edges="S2C C2W"/>

    <route id="r_E2W" edges="E2C C2W"/>
    <route id="r_E2N" edges="E2C C2N"/>
    <route id="r_E2S" edges="E2C C2S"/>

    <route id="r_W2E" edges="W2C C2E"/>
    <route id="r_W2N" edges="W2C C2N"/>
    <route id="r_W2S" edges="W2C C2S"/>
</routes>
"""
        with open(os.path.join(self.simulation_dir, "routes.rou.xml"), "w") as f:
            f.write(routes_content)

        # 4. SUMO config
        sumocfg_content = """<configuration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/sumoConfiguration.xsd">
    <input>
        <net-file value="net.net.xml"/>
        <route-files value="routes.rou.xml"/>
    </input>
    <time>
        <begin value="0"/>
        <end value="3600"/>
        <step-length value="0.1"/>
    </time>
    <report>
        <no-warnings value="true"/>
        <no-step-log value="true"/>
    </report>
</configuration>
"""
        with open(self.sumocfg_path, "w") as f:
            f.write(sumocfg_content)

        # 5. Compile with netconvert
        import subprocess
        try:
            print(f"Compiling SUMO network geometry in {self.simulation_dir}...")
            subprocess.run([
                "netconvert",
                f"--node-files={os.path.join(self.simulation_dir, 'net.nod.xml')}",
                f"--edge-files={os.path.join(self.simulation_dir, 'net.edg.xml')}",
                f"--output-file={self.net_path}",
                "--no-warnings"
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print("SUMO network geometry compiled successfully.")
        except Exception as e:
            print(f"Failed to run netconvert: {e}")

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
                    lanes_data.append({
                        "id": lane.getID(),
                        "edgeId": edge.getID(),
                        "shape": shape,
                        "width": float(lane.getWidth()),
                        "speed": float(lane.getSpeed()),
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
                
            tls_ids = traci.trafficlight.getIDList() if self.traci_started else []
            tls_configs = {}
            for tls_id in tls_ids:
                links = traci.trafficlight.getControlledLinks(tls_id)
                controlled_links = []
                for index_links in links:
                    idx_links_data = []
                    for link in index_links:
                        idx_links_data.append({
                            "incoming": link[0],
                            "outgoing": link[1]
                        })
                    controlled_links.append(idx_links_data)
                    
                logics = traci.trafficlight.getAllProgramLogics(tls_id)
                phases = []
                if logics:
                    for phase in logics[0].phases:
                        phases.append({
                            "duration": float(phase.duration),
                            "state": phase.state
                        })
                        
                tls_configs[tls_id] = {
                    "id": tls_id,
                    "controlledLinks": controlled_links,
                    "phases": phases
                }
                
            self.geometry_cache = {
                "lanes": lanes_data,
                "nodes": nodes_data,
                "trafficLights": tls_configs
            }
            return self.geometry_cache
        except Exception as e:
            print(f"Error parsing geometry: {e}")
            return {"lanes": [], "nodes": [], "trafficLights": {}}

    def get_simulation_state(self) -> Dict[str, Any]:
        """Aggregates and formats the dynamic simulation state."""
        if not self.traci_started:
            return {
                "time": 0.0,
                "vehicles": [],
                "tls": {},
                "stats": {
                    "activeVehicles": 0,
                    "avgSpeed": 0.0,
                    "spawnRate": self.spawn_rate,
                    "isPaused": self.is_paused,
                    "speedMultiplier": self.speed_multiplier,
                    "isManualTl": self.is_manual_tl
                }
            }

        vehicles_data = []
        active_ids = traci.vehicle.getIDList()
        for veh_id in active_ids:
            try:
                x, y = traci.vehicle.getPosition(veh_id)
                angle = traci.vehicle.getAngle(veh_id)
                speed = traci.vehicle.getSpeed(veh_id)
                type_id = traci.vehicle.getTypeID(veh_id)
                lane_id = traci.vehicle.getLaneID(veh_id)
                length = traci.vehicle.getLength(veh_id)
                width = traci.vehicle.getWidth(veh_id)
                
                vehicles_data.append({
                    "id": veh_id,
                    "x": float(x),
                    "y": float(y),
                    "angle": float(angle),
                    "speed": float(speed),
                    "type": type_id,
                    "laneId": lane_id,
                    "length": float(length),
                    "width": float(width)
                })
            except traci.TraCIException:
                continue

        tls_states = {}
        for tls_id in traci.trafficlight.getIDList():
            tls_states[tls_id] = {
                "state": traci.trafficlight.getRedYellowGreenState(tls_id),
                "phase": int(traci.trafficlight.getPhase(tls_id)),
                "spentTime": float(traci.trafficlight.getSpentDuration(tls_id)),
                "nextSwitch": float(traci.trafficlight.getNextSwitch(tls_id))
            }

        active_count = len(vehicles_data)
        avg_speed = sum(v["speed"] for v in vehicles_data) / active_count if active_count > 0 else 0.0

        return {
            "time": float(traci.simulation.getTime()),
            "vehicles": vehicles_data,
            "tls": tls_states,
            "stats": {
                "activeVehicles": active_count,
                "avgSpeed": float(avg_speed),
                "spawnRate": float(self.spawn_rate),
                "isPaused": self.is_paused,
                "speedMultiplier": float(self.speed_multiplier),
                "isManualTl": self.is_manual_tl
            }
        }

    async def start(self):
        """Initializes and starts the SUMO simulation background loop."""
        if not SUMO_AVAILABLE:
            print("SUMO is not installed or SUMO_HOME is invalid. Cannot start simulation.")
            return

        if self.traci_started:
            print("Simulation is already running.")
            return

        # 1. Compile SUMO XML configs if not present
        if not os.path.exists(self.net_path):
            self.create_sumo_files()

        # 2. Start SUMO subprocess
        sumo_binary = "sumo"  # Run headless inside backend
        sumo_cmd = [sumo_binary, "-c", self.sumocfg_path]
        
        print(f"Starting {sumo_binary} and initializing TraCI...")
        try:
            traci.start(sumo_cmd)
            traci.simulationStep()
            self.traci_started = True
            self.is_initialized = True
            print("TraCI initialized successfully inside FastAPI.")
        except Exception as e:
            print(f"Failed to start SUMO / TraCI: {e}")
            self.traci_started = False
            return

        # Pre-populate geometry cache now that TraCI is running
        self.get_network_geometry()

        # 3. Spawn background simulation task
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

    async def simulation_loop(self):
        """Asynchronous loop stepping SUMO and broadcasting state to all WebSocket clients."""
        while self.traci_started:
            try:
                if not self.is_paused or self.should_step:
                    if self.should_step:
                        self.should_step = False
                    
                    # 1. Dynamically spawn vehicles
                    prob = self.spawn_rate / 600.0
                    if random.random() < prob:
                        self.veh_counter += 1
                        veh_id = f"veh_{self.veh_counter}"
                        route_id = random.choice(ROUTES)
                        type_id = random.choices(VEHICLE_TYPES, weights=VEHICLE_WEIGHTS, k=1)[0]
                        try:
                            traci.vehicle.add(vehID=veh_id, routeID=route_id, typeID=type_id)
                        except traci.TraCIException:
                            pass
                    
                    # 2. Advance SUMO simulation
                    traci.simulationStep()
                    
                    # 3. Broadcast state to clients
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

                # Delay adjustment
                if self.is_paused:
                    await asyncio.sleep(0.1)
                else:
                    delay = max(0.005, 0.1 / self.speed_multiplier)
                    await asyncio.sleep(delay)

            except Exception as e:
                print(f"Error in SUMO simulation loop: {e}")
                await asyncio.sleep(0.1)

    async def register_client(self, websocket: WebSocket):
        """Adds a client to the broadcast pool and sends them the initial state."""
        self.clients.add(websocket)
        print(f"WebSocket client connected. Total clients: {len(self.clients)}")

        try:
            # 1. Geometry
            geom = self.get_network_geometry()
            await websocket.send_json({
                "type": "geometry",
                "data": geom
            })
            
            # 2. Config state
            await websocket.send_json({
                "type": "config",
                "data": {
                    "isPaused": self.is_paused,
                    "spawnRate": self.spawn_rate,
                    "speedMultiplier": self.speed_multiplier,
                    "isManualTl": self.is_manual_tl
                }
            })

            # 3. Current simulation snapshot
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
                print("Simulation paused by client.")
            elif msg_type == "resume":
                self.is_paused = False
                print("Simulation resumed by client.")
            elif msg_type == "step":
                self.should_step = True
                print("Simulation step requested by client.")
            elif msg_type == "set_spawn_rate":
                self.spawn_rate = max(0.0, float(msg.get("value", 30.0)))
                print(f"Spawn rate updated to: {self.spawn_rate} veh/min")
            elif msg_type == "set_speed_multiplier":
                self.speed_multiplier = max(0.1, float(msg.get("value", 1.0)))
                print(f"Speed multiplier updated to: {self.speed_multiplier}x")
            elif msg_type == "set_tl_mode":
                mode = msg.get("mode", "auto")
                if mode == "manual":
                    self.is_manual_tl = True
                    if self.traci_started:
                        for tls_id in traci.trafficlight.getIDList():
                            traci.trafficlight.setPhaseDuration(tls_id, 999999)
                    print("Traffic lights set to MANUAL mode.")
                else:
                    self.is_manual_tl = False
                    if self.traci_started:
                        for tls_id in traci.trafficlight.getIDList():
                            traci.trafficlight.setProgram(tls_id, "0")
                    print("Traffic lights set to AUTO mode.")
            elif msg_type == "set_tl_phase":
                if self.is_manual_tl and self.traci_started:
                    tls_id = msg.get("tlsId")
                    phase_idx = int(msg.get("phaseIndex", 0))
                    try:
                        traci.trafficlight.setPhase(tls_id, phase_idx)
                        traci.trafficlight.setPhaseDuration(tls_id, 999999)
                        print(f"Traffic light {tls_id} manual phase set to: {phase_idx}")
                    except traci.TraCIException as e:
                        print(f"Error setting phase: {e}")

            # Broadcast configuration changes to sync all clients
            config_payload = json.dumps({
                "type": "config",
                "data": {
                    "isPaused": self.is_paused,
                    "spawnRate": self.spawn_rate,
                    "speedMultiplier": self.speed_multiplier,
                    "isManualTl": self.is_manual_tl
                }
            })
            await asyncio.gather(
                *[c.send_text(config_payload) for c in self.clients],
                return_exceptions=True
            )
        except Exception as e:
            print(f"Error handling message from client: {e}")

sumo_service = SumoService()
