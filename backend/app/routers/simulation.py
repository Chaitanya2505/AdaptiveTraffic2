import os
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Response, Query
from typing import Optional
from app.services.sumo_service import sumo_service
from app.services.simulation_analytics import simulation_analytics

router = APIRouter(tags=["Simulation"])

@router.websocket("/ws/simulation")
async def websocket_simulation(websocket: WebSocket):
    await websocket.accept()
    await sumo_service.register_client(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await sumo_service.handle_message(websocket, data)
    except WebSocketDisconnect:
        sumo_service.unregister_client(websocket)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        sumo_service.unregister_client(websocket)

@router.get("/simulation/geometry")
async def get_simulation_geometry():
    """Returns network layout, lane geometries, and traffic light linkages."""
    return sumo_service.get_network_geometry()

@router.get("/simulation/state")
async def get_simulation_state():
    """Returns latest dynamic snapshot of vehicles, signals, and KPIs."""
    return sumo_service.get_simulation_state()

@router.get("/simulation/analytics")
async def get_simulation_analytics():
    """Returns the latest post-simulation or active analytics report."""
    if simulation_analytics.final_report:
        return simulation_analytics.final_report
    return simulation_analytics.generate_final_analytics()

@router.get("/simulation/history")
async def get_simulation_history():
    """Returns list of past completed simulation sessions."""
    return {"runs": simulation_analytics.runs_history}

@router.get("/simulation/export/csv")
async def export_simulation_csv():
    """Downloads 1-second interval simulation telemetry log in CSV format."""
    csv_data = simulation_analytics.export_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=erakshak_telemetry_{simulation_analytics.active_run_id}.csv"}
    )

@router.get("/simulation/export/json")
async def export_simulation_json():
    """Downloads full structured simulation dataset in JSON format."""
    report = simulation_analytics.final_report or simulation_analytics.generate_final_analytics()
    return Response(
        content=str(report).replace("'", '"'),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=erakshak_report_{simulation_analytics.active_run_id}.json"}
    )

@router.get("/simulation/export/report")
async def export_simulation_html_report():
    """Generates and downloads a printable HTML / PDF-ready formal engineering report."""
    report = simulation_analytics.final_report or simulation_analytics.generate_final_analytics()
    kpis = report["kpis"]
    cfg = report["configuration"]
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>E-RAKSHAK Traffic Simulation Report - {report['runId']}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #0f172a; color: #f8fafc; line-height: 1.6; }}
        .header {{ border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; }}
        .title {{ font-size: 26px; font-weight: 800; color: #10b981; margin: 0; }}
        .subtitle {{ font-size: 14px; color: #94a3b8; margin-top: 5px; }}
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }}
        .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 15px; }}
        .card-label {{ font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }}
        .card-val {{ font-size: 22px; font-weight: 800; color: #fff; margin-top: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; background: #1e293b; border-radius: 8px; overflow: hidden; }}
        th, td {{ padding: 12px 15px; text-align: left; border-bottom: 1px solid #334155; font-size: 13px; }}
        th {{ background: #0f172a; color: #94a3b8; text-transform: uppercase; font-size: 11px; }}
        .badge {{ display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }}
        .badge-critical {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }}
        .badge-high {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }}
        .section-title {{ font-size: 18px; font-weight: 700; color: #38bdf8; margin-top: 30px; margin-bottom: 15px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">🚦 E-RAKSHAK Traffic Simulation & Optimization Report</h1>
        <div class="subtitle">Session ID: {report['runId']} | Generated: {report['generatedAt']} | Network: {cfg['networkCorridor']}</div>
    </div>

    <div class="grid">
        <div class="card">
            <div class="card-label">Throughput</div>
            <div class="card-val">{kpis['throughputVph']} <span style="font-size:12px;color:#94a3b8">veh/hr</span></div>
        </div>
        <div class="card">
            <div class="card-label">Average Speed</div>
            <div class="card-val">{kpis['avgSpeedKmh']} <span style="font-size:12px;color:#94a3b8">km/h</span></div>
        </div>
        <div class="card">
            <div class="card-label">Average Delay</div>
            <div class="card-val">{kpis['avgWaitTimeSec']}s</div>
        </div>
        <div class="card">
            <div class="card-label">BRTS Intrusions</div>
            <div class="card-val" style="color:#f87171">{kpis['totalBrtsIntrusions']}</div>
        </div>
    </div>

    <div class="section-title">1. 4-Junction Operational Performance & Level of Service (HCM)</div>
    <table>
        <thead>
            <tr>
                <th>Junction Name</th>
                <th>Throughput</th>
                <th>Avg Delay</th>
                <th>Level of Service</th>
                <th>Avg Speed</th>
                <th>Max Queue</th>
                <th>Phase Split (EW / NS)</th>
            </tr>
        </thead>
        <tbody>
            {"".join([f"<tr><td><strong>{j.get('name', jid)}</strong></td><td>{j.get('throughputVph', 0)} veh/hr</td><td>{j.get('avgDelaySec', 0)}s</td><td><span class='badge' style='background:rgba(16,185,129,0.2);color:#34d399;border:1px solid #10b981'>LOS {j.get('levelOfService', 'A')}</span></td><td>{j.get('avgSpeedKmh', 0)} km/h</td><td>{j.get('maxQueueVehicles', 0)} veh</td><td>{j.get('phaseSplit', {{}}).get('ewGreenPct', 50)}% / {j.get('phaseSplit', {{}}).get('nsGreenPct', 50)}%</td></tr>" for jid, j in report.get('junctions', {{}}).items()])}
        </tbody>
    </table>

    <div class="section-title">2. Bottleneck Hotspots Analysis</div>
    <table>
        <thead>
            <tr>
                <th>Rank</th>
                <th>Junction / Corridor Location</th>
                <th>Congestion Score</th>
                <th>Average Delay</th>
                <th>Severity</th>
            </tr>
        </thead>
        <tbody>
            {"".join([f"<tr><td>#{b['rank']}</td><td><strong>{b['location']}</strong></td><td>{b['score']}/100</td><td>{b['avgDelay']}</td><td><span class='badge badge-{b['severity'].lower()}'>{b['severity']}</span></td></tr>" for b in report['bottlenecks']])}
        </tbody>
    </table>

    <div class="section-title">3. Data-Driven Engineering Recommendations</div>
    <table>
        <thead>
            <tr>
                <th>Code</th>
                <th>Category</th>
                <th>Recommendation Title</th>
                <th>Actionable Details</th>
            </tr>
        </thead>
        <tbody>
            {"".join([f"<tr><td><strong>{r['id']}</strong></td><td>{r['category']}</td><td>{r['title']}</td><td>{r['description']}</td></tr>" for r in report['recommendations']])}
        </tbody>
    </table>

    <div class="section-title">4. What-If Comparison (vs Fixed-Time Baseline)</div>
    <div class="grid">
        <div class="card">
            <div class="card-label">Throughput Improvement</div>
            <div class="card-val" style="color:#34d399">+{report['whatIfComparison']['improvements']['throughputGainPct']}%</div>
        </div>
        <div class="card">
            <div class="card-label">Corridor Speed Gain</div>
            <div class="card-val" style="color:#34d399">+{report['whatIfComparison']['improvements']['speedIncreasePct']}%</div>
        </div>
        <div class="card">
            <div class="card-label">Waiting Time Reduction</div>
            <div class="card-val" style="color:#38bdf8">-{report['whatIfComparison']['improvements']['waitReductionPct']}%</div>
        </div>
        <div class="card">
            <div class="card-label">Queue Length Reduction</div>
            <div class="card-val" style="color:#38bdf8">-{report['whatIfComparison']['improvements']['queueReductionPct']}%</div>
        </div>
    </div>
</body>
</html>
"""
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f"inline; filename=erakshak_report_{simulation_analytics.active_run_id}.html"}
    )

@router.get("/simulation/export/pdf")
async def export_simulation_pdf():
    """Generates and serves the latest executive PDF report."""
    try:
        report = simulation_analytics.generate_final_analytics()
        run_id = report.get("runId", simulation_analytics.active_run_id)
        runs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "simulation_runs")
        json_path = os.path.join(runs_dir, f"{run_id}.json")
        pdf_path = os.path.join(runs_dir, f"{run_id}_report.pdf")

        from app.simulation.convert_json_to_pdf import generate_pdf_from_json
        await asyncio.to_thread(generate_pdf_from_json, json_path, pdf_path)

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=erakshak_report_{run_id}.pdf",
                "Content-Type": "application/pdf"
            }
        )
    except Exception as e:
        print(f"Error generating simulation PDF: {e}")
        # Fallback to serving the HTML report if PDF conversion encounters any issue
        return await export_simulation_html_report()

@router.post("/simulation/run-5min")
async def start_5min_run(scenario: str = Query("adaptive"), demand: str = Query("peak")):
    """Initiates an automated 5-minute (300s) demonstration simulation."""
    await sumo_service.run_5min_demo(scenario=scenario, demand=demand)
    return {
        "status": "started",
        "scenario": scenario,
        "demand": demand,
        "targetDuration": 300.0,
        "message": "5-Minute SUMO demonstration run initiated."
    }

@router.post("/simulation/reset")
async def reset_simulation():
    """Resets SUMO simulation state and clears active telemetry."""
    await sumo_service.reset()
    return {"status": "reset", "message": "Simulation state reset complete."}
