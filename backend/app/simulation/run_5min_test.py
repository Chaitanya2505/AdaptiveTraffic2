import os
import sys
import time

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import sumolib
import traci
from app.services.sumo_service import sumo_service, CORRIDOR_TLS
from app.services.simulation_analytics import SimulationAnalyticsEngine
from app.simulation.convert_json_to_pdf import generate_pdf_from_json

def run_single_simulation_pass(scenario: str, total_steps: int = 3000, seed: int = 42) -> tuple:
    """Executes a full 3,000 step SUMO run under the specified control policy with a fixed seed."""
    sumocfg = os.path.join(backend_dir, "app", "simulation", "simulation.sumocfg")
    sumo_binary = sumolib.checkBinary("sumo")

    try:
        traci.close()
    except Exception:
        pass

    traci.start([
        sumo_binary,
        "-c", sumocfg,
        "--no-step-log", "true",
        "--time-to-teleport", "180",
        "--seed", str(seed)
    ])

    engine = SimulationAnalyticsEngine()
    engine.scenario_mode = scenario
    engine.demand_level = "peak"
    engine.spawn_rate = 90.0
    engine.scenario_name = "Adaptive Traffic Control" if scenario == "adaptive" else "Traditional Fixed-Time Control"

    sumo_service.traci_started = True
    sumo_service.scenario_mode = scenario
    sumo_service.demand_preset = "peak"
    sumo_service.spawn_rate = 90.0

    for step in range(1, total_steps + 1):
        sim_time = step * 0.1

        # 1. Spawn balanced 4-way traffic
        sumo_service.spawn_balanced_traffic(sim_time)

        # 2. Advance SUMO step
        traci.simulationStep()

        # 3. Apply Signal Control Policy
        sumo_service.update_signal_controllers(sim_time)

        # 4. Collect Live Simulation State
        state = sumo_service.get_simulation_state()

        # 5. Record step in analytics
        engine.record_step(sim_time, state, {})

        if step % 600 == 0:
            formatted_time = f"{int(sim_time // 60):02d}:{int(sim_time % 60):02d}"
            active_v = state["stats"]["activeVehicles"]
            comp_cnt = state["stats"]["completedVehicles"]
            avg_spd = state["stats"]["avgSpeed"] * 3.6
            print(f"   [{scenario.upper():<8}] {formatted_time} / 05:00 | Active: {active_v:<4} | Completed: {comp_cnt:<4} | Speed: {avg_spd:>5.1f} km/h", flush=True)

    traci.close()
    sumo_service.traci_started = False
    return engine

def run_dual_run_evaluation():
    print("\n" + "=" * 80, flush=True)
    print("🚦 E-RAKSHAK: EMPIRICAL DUAL-RUN BENCHMARK & GROUND-TRUTH ANALYTICS", flush=True)
    print("=" * 80, flush=True)
    print("Test Matrix:", flush=True)
    print("  • Corridor Network : 4 Junctions (SVNIT -> Ghod Dod -> Majura -> Sahara)", flush=True)
    print("  • Demand Profile   : Peak Hour (90 vehicles/min across 4-way OD matrix)", flush=True)
    print("  • Step Count       : 3,000 steps per run (300.0 simulation seconds = 5 min)", flush=True)
    print("  • Comparative Runs : 1) Fixed-Time Baseline  vs  2) Dynamic Adaptive Control", flush=True)
    print("=" * 80, flush=True)

    # 1. RUN 1: FIXED-TIME BASELINE
    print("\n[PHASE 1/3] Executing Run 1: Traditional Fixed-Time Control Baseline...", flush=True)
    baseline_engine = run_single_simulation_pass(scenario="fixed", total_steps=3000, seed=42)
    baseline_report = baseline_engine.generate_final_analytics()

    # 2. RUN 2: ADAPTIVE TRAFFIC CONTROL
    print("\n[PHASE 2/3] Executing Run 2: Dynamic Adaptive Traffic Control (Queue-Pressure)...", flush=True)
    adaptive_engine = run_single_simulation_pass(scenario="adaptive", total_steps=3000, seed=42)
    final_report = adaptive_engine.generate_final_analytics(baseline_report=baseline_report)

    # 3. GENERATE 2-PAGE RICH PDF WITH EMBEDDED CHARTS
    print("\n[PHASE 3/3] Generating Executive PDF Report with Embedded Charts...", flush=True)
    json_path = os.path.join(backend_dir, "app", "simulation_runs", f"{final_report['runId']}.json")
    pdf_path = os.path.join(backend_dir, "app", "simulation_runs", f"{final_report['runId']}_report.pdf")

    generate_pdf_from_json(json_path, pdf_path)

    # Print Executive Summary
    print("\n" + "=" * 80, flush=True)
    print("📊 EMPIRICAL GROUND-TRUTH RESULTS — DUAL-RUN COMPARISON", flush=True)
    print("=" * 80, flush=True)
    kpis = final_report["kpis"]
    b_kpis = baseline_report["kpis"]
    whatif = final_report["whatIfComparison"]
    imp = whatif["improvements"]

    tp_str = f"+{imp['throughputGainPct']}%" if imp['throughputGainPct'] >= 0 else f"{imp['throughputGainPct']}%"
    spd_str = f"+{imp['speedIncreasePct']}%" if imp['speedIncreasePct'] >= 0 else f"{imp['speedIncreasePct']}%"
    wait_str = f"-{abs(imp['waitReductionPct'])}%" if imp['waitReductionPct'] >= 0 else f"+{abs(imp['waitReductionPct'])}%"

    print(f"{'Performance Metric':<30} | {'Fixed Baseline':<16} | {'Adaptive Control':<16} | {'Empirical Delta'}", flush=True)
    print("-" * 80, flush=True)
    print(f"{'Throughput Rate':<30} | {b_kpis['throughputVph']:>8.1f} veh/hr  | {kpis['throughputVph']:>8.1f} veh/hr  | {tp_str}", flush=True)
    print(f"{'Completed Corridor Trips':<30} | {b_kpis['completedVehicles']:>8} trips   | {kpis['completedVehicles']:>8} trips   | {tp_str}", flush=True)
    print(f"{'Average Corridor Travel Speed':<30} | {b_kpis['avgSpeedKmh']:>8.1f} km/h    | {kpis['avgSpeedKmh']:>8.1f} km/h    | {spd_str}", flush=True)
    print(f"{'Average Intersection Stop Delay':<30} | {b_kpis['avgWaitTimeSec']:>8.1f} s       | {kpis['avgWaitTimeSec']:>8.1f} s       | {wait_str}", flush=True)
    print(f"{'Total CO2 Emissions Generated':<30} | {b_kpis['totalCO2Kg']:>8.2f} kg      | {kpis['totalCO2Kg']:>8.2f} kg      | -{imp['co2ReductionPct']}% ({imp['co2SavedKg']} kg saved)", flush=True)
    print(f"{'Total Fuel Consumed':<30} | {b_kpis['totalFuelLiters']:>8.2f} L       | {kpis['totalFuelLiters']:>8.2f} L       | -{imp['fuelReductionPct']}% ({imp['fuelSavedLiters']} L saved)", flush=True)
    print("-" * 80, flush=True)

    print("\n⚠️ DYNAMIC BOTTLENECK HOTSPOTS (Direct TraCI Sensor Detection):", flush=True)
    for b in final_report["bottlenecks"]:
        print(f"  #{b['rank']} {b['location']:<35} | Score: {b['score']:>4.1f}/100 | Speed: {b['avgSpeedKmh']} km/h | Severity: {b['severity']}", flush=True)
        print(f"     Root Cause: {b['primaryFactor']}", flush=True)

    print("\n👷 QUANTITATIVE CONTEXTUAL RECOMMENDATIONS:", flush=True)
    for r in final_report["recommendations"]:
        print(f"  • [{r['id']}] {r['title']}", flush=True)
        print(f"    Target: {r['targetLocation']} | Impact: {r['impact']}", flush=True)
        print(f"    Action: {r['description']}\n", flush=True)

    print("=" * 80, flush=True)
    print(f"✅ JSON Telemetry File: {json_path}", flush=True)
    print(f"✅ Executive PDF File : {pdf_path}", flush=True)
    print("=" * 80, flush=True)

if __name__ == "__main__":
    run_dual_run_evaluation()
