import os
import sys
import subprocess
import shutil

# Ensure SUMO tools are on python path
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

def generate_corridor_network(output_dir: str) -> str:
    """
    Generates a realistic 4-junction Surat arterial corridor network with:
    - 4 signalized junctions (J_SVNIT, J_GHODDOD, J_MAJURA, J_SAHARA)
    - Full 4-way approaches (North, South, East, West) at each junction
    - 3 lanes on arterial (Lane 0 = Dedicated BRTS, Lane 1 = Mixed, Lane 2 = Fast/Turn)
    - 2 lanes on cross-feeder streets
    - Realistic turning movements, connections, and standard 6-phase traffic light programs
    """
    os.makedirs(output_dir, exist_ok=True)

    # 1. NODES (corridor.nod.xml)
    nodes_xml = """<?xml version="1.0" encoding="UTF-8"?>
<nodes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/nodes_file.xsd">
    <!-- Corridor Signalized Intersections (Surat Arterial Spine) -->
    <node id="J_SVNIT" x="0" y="0" type="traffic_light"/>
    <node id="J_GHODDOD" x="350" y="0" type="traffic_light"/>
    <node id="J_MAJURA" x="700" y="0" type="traffic_light"/>
    <node id="J_SAHARA" x="1050" y="0" type="traffic_light"/>

    <!-- Corridor Arterial Perimeter Gateways (West & East) -->
    <node id="W_ENTRY" x="-250" y="0" type="priority"/>
    <node id="E_ENTRY" x="1300" y="0" type="priority"/>

    <!-- North/South Feeder Gateways for J_SVNIT -->
    <node id="N_SVNIT" x="0" y="200" type="priority"/>
    <node id="S_SVNIT" x="0" y="-200" type="priority"/>

    <!-- North/South Feeder Gateways for J_GHODDOD -->
    <node id="N_GHODDOD" x="350" y="200" type="priority"/>
    <node id="S_GHODDOD" x="350" y="-200" type="priority"/>

    <!-- North/South Feeder Gateways for J_MAJURA -->
    <node id="N_MAJURA" x="700" y="200" type="priority"/>
    <node id="S_MAJURA" x="700" y="-200" type="priority"/>

    <!-- North/South Feeder Gateways for J_SAHARA -->
    <node id="N_SAHARA" x="1050" y="200" type="priority"/>
    <node id="S_SAHARA" x="1050" y="-200" type="priority"/>
</nodes>
"""
    nod_path = os.path.join(output_dir, "corridor.nod.xml")
    with open(nod_path, "w", encoding="utf-8") as f:
        f.write(nodes_xml)

    # 2. EDGES (corridor.edg.xml)
    edges_xml = """<?xml version="1.0" encoding="UTF-8"?>
<edges xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/edges_file.xsd">
    <!-- Main Arterial Corridor (Westbound & Eastbound) -->
    <!-- Segment 0: West Entry <-> J_SVNIT -->
    <edge id="W_TO_SVNIT" from="W_ENTRY" to="J_SVNIT" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>
    <edge id="SVNIT_TO_W" from="J_SVNIT" to="W_ENTRY" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>

    <!-- Segment 1: J_SVNIT <-> J_GHODDOD -->
    <edge id="SVNIT_TO_GHODDOD" from="J_SVNIT" to="J_GHODDOD" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>
    <edge id="GHODDOD_TO_SVNIT" from="J_GHODDOD" to="J_SVNIT" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>

    <!-- Segment 2: J_GHODDOD <-> J_MAJURA -->
    <edge id="GHODDOD_TO_MAJURA" from="J_GHODDOD" to="J_MAJURA" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>
    <edge id="MAJURA_TO_GHODDOD" from="J_MAJURA" to="J_GHODDOD" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>

    <!-- Segment 3: J_MAJURA <-> J_SAHARA -->
    <edge id="MAJURA_TO_SAHARA" from="J_MAJURA" to="J_SAHARA" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>
    <edge id="SAHARA_TO_MAJURA" from="J_SAHARA" to="J_MAJURA" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>

    <!-- Segment 4: J_SAHARA <-> East Entry -->
    <edge id="SAHARA_TO_E" from="J_SAHARA" to="E_ENTRY" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>
    <edge id="E_TO_SAHARA" from="E_ENTRY" to="J_SAHARA" numLanes="3" speed="16.67">
        <lane index="0" allow="bus custom1" speed="16.67"/>
        <lane index="1" disallow="bus" speed="13.89"/>
        <lane index="2" disallow="bus" speed="13.89"/>
    </edge>

    <!-- North/South Feeder Roads for J_SVNIT -->
    <edge id="N_TO_SVNIT" from="N_SVNIT" to="J_SVNIT" numLanes="2" speed="13.89"/>
    <edge id="SVNIT_TO_N" from="J_SVNIT" to="N_SVNIT" numLanes="2" speed="13.89"/>
    <edge id="S_TO_SVNIT" from="S_SVNIT" to="J_SVNIT" numLanes="2" speed="13.89"/>
    <edge id="SVNIT_TO_S" from="J_SVNIT" to="S_SVNIT" numLanes="2" speed="13.89"/>

    <!-- North/South Feeder Roads for J_GHODDOD -->
    <edge id="N_TO_GHODDOD" from="N_GHODDOD" to="J_GHODDOD" numLanes="2" speed="13.89"/>
    <edge id="GHODDOD_TO_N" from="J_GHODDOD" to="N_GHODDOD" numLanes="2" speed="13.89"/>
    <edge id="S_TO_GHODDOD" from="S_GHODDOD" to="J_GHODDOD" numLanes="2" speed="13.89"/>
    <edge id="GHODDOD_TO_S" from="J_GHODDOD" to="S_GHODDOD" numLanes="2" speed="13.89"/>

    <!-- North/South Feeder Roads for J_MAJURA -->
    <edge id="N_TO_MAJURA" from="N_MAJURA" to="J_MAJURA" numLanes="2" speed="13.89"/>
    <edge id="MAJURA_TO_N" from="J_MAJURA" to="N_MAJURA" numLanes="2" speed="13.89"/>
    <edge id="S_TO_MAJURA" from="S_MAJURA" to="J_MAJURA" numLanes="2" speed="13.89"/>
    <edge id="MAJURA_TO_S" from="J_MAJURA" to="S_MAJURA" numLanes="2" speed="13.89"/>

    <!-- North/South Feeder Roads for J_SAHARA -->
    <edge id="N_TO_SAHARA" from="N_SAHARA" to="J_SAHARA" numLanes="2" speed="13.89"/>
    <edge id="SAHARA_TO_N" from="J_SAHARA" to="N_SAHARA" numLanes="2" speed="13.89"/>
    <edge id="S_TO_SAHARA" from="S_SAHARA" to="J_SAHARA" numLanes="2" speed="13.89"/>
    <edge id="SAHARA_TO_S" from="J_SAHARA" to="S_SAHARA" numLanes="2" speed="13.89"/>
</edges>
"""
    edg_path = os.path.join(output_dir, "corridor.edg.xml")
    with open(edg_path, "w", encoding="utf-8") as f:
        f.write(edges_xml)

    # 3. TRAFFIC LIGHT DEFINITIONS (corridor.tll.xml)
    # Standard 6-phase program for each of the 4 junctions:
    # Phase 0: EW Green (30s)
    # Phase 1: EW Yellow (4s)
    # Phase 2: All Red Clearance (2s)
    # Phase 3: NS Green (25s)
    # Phase 4: NS Yellow (4s)
    # Phase 5: All Red Clearance (2s)
    tll_xml = """<?xml version="1.0" encoding="UTF-8"?>
<tlLogics xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/tllogic_file.xsd">
    <tlLogic id="J_SVNIT" type="static" programID="0" offset="0">
        <phase duration="30" state="GGggrrrrGGggrrrr"/>
        <phase duration="4"  state="yyyyrrrryyyyrrrr"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
        <phase duration="25" state="rrrrGGggrrrrGGgg"/>
        <phase duration="4"  state="rrrryyyyrrrryyyy"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
    </tlLogic>
    <tlLogic id="J_GHODDOD" type="static" programID="0" offset="0">
        <phase duration="30" state="GGggrrrrGGggrrrr"/>
        <phase duration="4"  state="yyyyrrrryyyyrrrr"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
        <phase duration="25" state="rrrrGGggrrrrGGgg"/>
        <phase duration="4"  state="rrrryyyyrrrryyyy"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
    </tlLogic>
    <tlLogic id="J_MAJURA" type="static" programID="0" offset="0">
        <phase duration="30" state="GGggrrrrGGggrrrr"/>
        <phase duration="4"  state="yyyyrrrryyyyrrrr"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
        <phase duration="25" state="rrrrGGggrrrrGGgg"/>
        <phase duration="4"  state="rrrryyyyrrrryyyy"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
    </tlLogic>
    <tlLogic id="J_SAHARA" type="static" programID="0" offset="0">
        <phase duration="30" state="GGggrrrrGGggrrrr"/>
        <phase duration="4"  state="yyyyrrrryyyyrrrr"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
        <phase duration="25" state="rrrrGGggrrrrGGgg"/>
        <phase duration="4"  state="rrrryyyyrrrryyyy"/>
        <phase duration="2"  state="rrrrrrrrrrrrrrrr"/>
    </tlLogic>
</tlLogics>
"""
    tll_path = os.path.join(output_dir, "corridor.tll.xml")
    with open(tll_path, "w", encoding="utf-8") as f:
        f.write(tll_xml)

    # 4. ROUTES AND VEHICLE TYPES (routes.rou.xml)
    # Balanced 4-way OD matrix (Corridor Through 50%, Cross Feeder 25%, Turn Movements 25%)
    routes_xml = """<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/routes_file.xsd">
    <!-- Vehicle Types with Realistic Physics & Classes -->
    <!-- 1. Passenger Car -->
    <vType id="car" vClass="passenger" length="4.8" width="1.8" minGap="2.5" maxSpeed="16.67" accel="2.8" decel="4.5" sigma="0.5" color="6,182,212"/>
    <!-- 2. Motorcycle (High agility, rapid acceleration) -->
    <vType id="motorcycle" vClass="motorcycle" length="2.2" width="0.9" minGap="1.2" maxSpeed="18.0" accel="3.5" decel="5.0" sigma="0.5" color="16,185,129"/>
    <!-- 3. Standard City Transit Bus -->
    <vType id="bus" vClass="bus" length="12.0" width="2.5" minGap="3.0" maxSpeed="12.5" accel="1.5" decel="3.5" sigma="0.5" color="249,115,22"/>
    <!-- 4. Dedicated Sitilink BRTS Bus (Allowed in dedicated BRTS lane) -->
    <vType id="brts_bus" vClass="custom1" length="14.0" width="2.6" minGap="3.5" maxSpeed="16.67" accel="1.8" decel="4.0" sigma="0.5" color="99,102,241"/>
    <!-- 5. Heavy Logistics Truck -->
    <vType id="truck" vClass="truck" length="10.0" width="2.4" minGap="3.5" maxSpeed="10.0" accel="1.2" decel="3.0" sigma="0.5" color="234,179,8"/>

    <!-- A. MAIN CORRIDOR ARTERIAL THROUGH ROUTES (High Volume) -->
    <route id="r_MAIN_W_TO_E" edges="W_TO_SVNIT SVNIT_TO_GHODDOD GHODDOD_TO_MAJURA MAJURA_TO_SAHARA SAHARA_TO_E"/>
    <route id="r_MAIN_E_TO_W" edges="E_TO_SAHARA SAHARA_TO_MAJURA MAJURA_TO_GHODDOD GHODDOD_TO_SVNIT SVNIT_TO_W"/>

    <!-- B. DEDICATED BRTS RAPID TRANSIT ROUTES (Both Directions) -->
    <route id="r_BRTS_W_TO_E" edges="W_TO_SVNIT SVNIT_TO_GHODDOD GHODDOD_TO_MAJURA MAJURA_TO_SAHARA SAHARA_TO_E"/>
    <route id="r_BRTS_E_TO_W" edges="E_TO_SAHARA SAHARA_TO_MAJURA MAJURA_TO_GHODDOD GHODDOD_TO_SVNIT SVNIT_TO_W"/>

    <!-- C. ARTERIAL MERGE AND PARTIAL CORRIDOR MOVEMENTS -->
    <route id="r_W_TO_GHODDOD_N" edges="W_TO_SVNIT SVNIT_TO_GHODDOD GHODDOD_TO_N"/>
    <route id="r_W_TO_MAJURA_S" edges="W_TO_SVNIT SVNIT_TO_GHODDOD GHODDOD_TO_MAJURA MAJURA_TO_S"/>
    <route id="r_E_TO_MAJURA_N" edges="E_TO_SAHARA SAHARA_TO_MAJURA MAJURA_TO_N"/>
    <route id="r_E_TO_GHODDOD_S" edges="E_TO_SAHARA SAHARA_TO_MAJURA MAJURA_TO_GHODDOD GHODDOD_TO_S"/>

    <!-- D. J_SVNIT 4-WAY CROSS & TURNING MOVEMENTS -->
    <route id="r_SVNIT_N_TO_S" edges="N_TO_SVNIT SVNIT_TO_S"/>
    <route id="r_SVNIT_S_TO_N" edges="S_TO_SVNIT SVNIT_TO_N"/>
    <route id="r_SVNIT_N_TO_E" edges="N_TO_SVNIT SVNIT_TO_GHODDOD GHODDOD_TO_MAJURA"/>
    <route id="r_SVNIT_N_TO_W" edges="N_TO_SVNIT SVNIT_TO_W"/>
    <route id="r_SVNIT_S_TO_E" edges="S_TO_SVNIT SVNIT_TO_GHODDOD"/>
    <route id="r_SVNIT_S_TO_W" edges="S_TO_SVNIT SVNIT_TO_W"/>
    <route id="r_SVNIT_W_TO_N" edges="W_TO_SVNIT SVNIT_TO_N"/>
    <route id="r_SVNIT_W_TO_S" edges="W_TO_SVNIT SVNIT_TO_S"/>

    <!-- E. J_GHODDOD 4-WAY CROSS & TURNING MOVEMENTS -->
    <route id="r_GHODDOD_N_TO_S" edges="N_TO_GHODDOD GHODDOD_TO_S"/>
    <route id="r_GHODDOD_S_TO_N" edges="S_TO_GHODDOD GHODDOD_TO_N"/>
    <route id="r_GHODDOD_N_TO_E" edges="N_TO_GHODDOD GHODDOD_TO_MAJURA MAJURA_TO_SAHARA"/>
    <route id="r_GHODDOD_N_TO_W" edges="N_TO_GHODDOD GHODDOD_TO_SVNIT SVNIT_TO_W"/>
    <route id="r_GHODDOD_S_TO_E" edges="S_TO_GHODDOD GHODDOD_TO_MAJURA"/>
    <route id="r_GHODDOD_S_TO_W" edges="S_TO_GHODDOD GHODDOD_TO_SVNIT"/>

    <!-- F. J_MAJURA 4-WAY CROSS & TURNING MOVEMENTS -->
    <route id="r_MAJURA_N_TO_S" edges="N_TO_MAJURA MAJURA_TO_S"/>
    <route id="r_MAJURA_S_TO_N" edges="S_TO_MAJURA MAJURA_TO_N"/>
    <route id="r_MAJURA_N_TO_E" edges="N_TO_MAJURA MAJURA_TO_SAHARA SAHARA_TO_E"/>
    <route id="r_MAJURA_N_TO_W" edges="N_TO_MAJURA MAJURA_TO_GHODDOD GHODDOD_TO_SVNIT"/>
    <route id="r_MAJURA_S_TO_E" edges="S_TO_MAJURA MAJURA_TO_SAHARA"/>
    <route id="r_MAJURA_S_TO_W" edges="S_TO_MAJURA MAJURA_TO_GHODDOD"/>

    <!-- G. J_SAHARA 4-WAY CROSS & TURNING MOVEMENTS -->
    <route id="r_SAHARA_N_TO_S" edges="N_TO_SAHARA SAHARA_TO_S"/>
    <route id="r_SAHARA_S_TO_N" edges="S_TO_SAHARA SAHARA_TO_N"/>
    <route id="r_SAHARA_N_TO_W" edges="N_TO_SAHARA SAHARA_TO_MAJURA MAJURA_TO_GHODDOD"/>
    <route id="r_SAHARA_N_TO_E" edges="N_TO_SAHARA SAHARA_TO_E"/>
    <route id="r_SAHARA_S_TO_W" edges="S_TO_SAHARA SAHARA_TO_MAJURA"/>
    <route id="r_SAHARA_S_TO_E" edges="S_TO_SAHARA SAHARA_TO_E"/>
    <route id="r_SAHARA_E_TO_N" edges="E_TO_SAHARA SAHARA_TO_N"/>
    <route id="r_SAHARA_E_TO_S" edges="E_TO_SAHARA SAHARA_TO_S"/>
</routes>
"""
    rou_path = os.path.join(output_dir, "routes.rou.xml")
    with open(rou_path, "w", encoding="utf-8") as f:
        f.write(routes_xml)

    # 5. SUMO CONFIG (simulation.sumocfg)
    sumocfg_xml = """<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/sumoConfiguration.xsd">
    <input>
        <net-file value="net.net.xml"/>
        <route-files value="routes.rou.xml"/>
    </input>
    <time>
        <begin value="0"/>
        <end value="3600"/>
        <step-length value="0.1"/>
    </time>
    <processing>
        <collision.action value="warn"/>
        <time-to-teleport value="120"/>
    </processing>
    <report>
        <no-warnings value="true"/>
        <no-step-log value="true"/>
    </report>
</configuration>
"""
    cfg_path = os.path.join(output_dir, "simulation.sumocfg")
    with open(cfg_path, "w", encoding="utf-8") as f:
        f.write(sumocfg_xml)

    # 6. Compile with netconvert
    net_path = os.path.join(output_dir, "net.net.xml")
    netconvert_bin = shutil.which("netconvert")
    if not netconvert_bin:
        for possible in [
            r"C:\Program Files (x86)\Eclipse\Sumo\bin\netconvert.exe",
            r"C:\Program Files\Eclipse\Sumo\bin\netconvert.exe",
            "/usr/bin/netconvert",
            "/opt/homebrew/bin/netconvert"
        ]:
            if os.path.exists(possible):
                netconvert_bin = possible
                break

    if netconvert_bin:
        cmd = [
            netconvert_bin,
            f"--node-files={nod_path}",
            f"--edge-files={edg_path}",
            f"--output-file={net_path}",
            "--tls.default-type=static",
            "--no-warnings=true",
            "--junctions.join=true"
        ]
        print(f"Executing: {' '.join(cmd)}")
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"SUMO 4-junction corridor network compiled successfully at {net_path}")
        else:
            print(f"netconvert error: {res.stderr}")
    else:
        print("netconvert not found. Make sure SUMO is installed.")

    return net_path

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    generate_corridor_network(current_dir)
