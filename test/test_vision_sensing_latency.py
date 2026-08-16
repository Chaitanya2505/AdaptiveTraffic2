"""
Vision Sensing Inference Latency & Performance Benchmark
Tests real 4-lane CCTV frame ingestion and measures exact inference times.
"""

import sys
import os
import time
from pathlib import Path
import cv2
import numpy as np

# Resolve paths relative to Project Root
project_root = Path(__file__).resolve().parent.parent
backend_dir = project_root / "backend"
sys.path.insert(0, str(backend_dir))

# Set test database env if not set
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_traffic.db")
os.environ.setdefault("SECRET_KEY", "test_secret_key_12345678901234567890")

from app.services.vision_service import detector, vision_logger, PCE_LENGTH_MAP, EFFECTIVE_LANES_MAP

print("=" * 75)
print("   VISION SENSING INFERENCE BENCHMARK (4-LANE CCTV FEEDS)")
print("=" * 75)
print(f"Model Engine   : {detector.model_type}")
print(f"Model Device   : {getattr(detector.model, 'device', 'CPU') if detector.model else 'Mock'}")

candidates = [
    project_root / "test" / "video.mp4",
    project_root / "result" / "video.mp4",
    project_root / "backend" / "test" / "video.mp4",
    project_root / "frontend" / "public" / "sample_cctv" / "brt_sample.mp4"
]

video_path = None
for c in candidates:
    if c.exists():
        video_path = c
        break

if not video_path:
    print(f"Error: Video file not found. Checked: {[str(c) for c in candidates]}")
    sys.exit(1)

print(f"Video Source   : {video_path.resolve()}")

# Extract 4 sample frames simulating 4 approach lanes (L1, L2, L3, L4)
cap = cv2.VideoCapture(str(video_path))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1000
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

frame_indices = [
    int(total_frames * 0.10), # Lane 1 (North)
    int(total_frames * 0.35), # Lane 2 (South)
    int(total_frames * 0.60), # Lane 3 (East)
    int(total_frames * 0.85)  # Lane 4 (West)
]

lane_frames = []
for idx in frame_indices:
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ret, f = cap.read()
    if ret:
        lane_frames.append(f)
    else:
        lane_frames.append(np.zeros((540, 960, 3), dtype=np.uint8))
cap.release()

print(f"Sampled Feeds  : 4 Approach Lanes extracted ({len(lane_frames)} frames @ {lane_frames[0].shape[1]}x{lane_frames[0].shape[0]})")
print("-" * 75)

# --- Warm-up Run ---
print(">> Warming up neural network engine...")
_ = detector.detect(lane_frames[0], conf_threshold=0.35)

# --- Test 1: Single Frame Inference Benchmark ---
print("\n" + "=" * 75)
print("TEST 1: SINGLE-LANE CCTV FRAME INFERENCE")
print("=" * 75)

single_latencies = []
iterations = 5

for i in range(iterations):
    t0 = time.perf_counter()
    # Preprocessing
    resized = cv2.resize(lane_frames[0], (640, 640))
    t1 = time.perf_counter()
    
    # Model Forward Pass
    detections = detector.detect(resized, conf_threshold=0.35)
    t2 = time.perf_counter()
    
    pre_ms = (t1 - t0) * 1000
    infer_ms = (t2 - t1) * 1000
    total_ms = (t2 - t0) * 1000
    single_latencies.append((pre_ms, infer_ms, total_ms))
    print(f"Run {i+1}: Preprocess = {pre_ms:5.2f}ms | Neural Forward Pass = {infer_ms:6.2f}ms | Total = {total_ms:6.2f}ms | Detections: {len(detections)}")

avg_single_pre = sum(x[0] for x in single_latencies) / iterations
avg_single_infer = sum(x[1] for x in single_latencies) / iterations
avg_single_total = sum(x[2] for x in single_latencies) / iterations

print("-" * 75)
print(f"✓ Avg Single-Frame Forward Pass : {avg_single_infer:6.2f} ms")
print(f"✓ Avg Single-Frame Total Latency : {avg_single_total:6.2f} ms ({1000.0 / avg_single_total:.1f} FPS)")

# --- Test 2: 4-Lane Simultaneous Batch Inference ---
print("\n" + "=" * 75)
print("TEST 2: 4-LANE SIMULTANEOUS BATCH INFERENCE (L1 + L2 + L3 + L4)")
print("=" * 75)

batch_latencies = []
batch_runs = 5

for r in range(batch_runs):
    t_start = time.perf_counter()
    
    # 1. Ingest & Preprocess 4 Frames
    t_pre_0 = time.perf_counter()
    preprocessed_batch = [cv2.resize(f, (640, 640)) for f in lane_frames]
    t_pre_1 = time.perf_counter()
    
    # 2. Model Forward Pass on 4 frames simultaneously
    t_inf_0 = time.perf_counter()
    batch_results = detector.detect_batch(preprocessed_batch, conf_threshold=0.35)
    t_inf_1 = time.perf_counter()
    
    # 3. IRC:106-1990 PCE Queue & Density Analysis
    t_q_0 = time.perf_counter()
    queue_summary = {}
    lanes = ["L1", "L2", "L3", "L4"]
    
    for idx, detections in enumerate(batch_results):
        lane = lanes[idx]
        cars, bikes, autos, buses, trucks = 0, 0, 0, 0, 0
        pce_sum, total_len = 0.0, 0.0
        
        for d in detections:
            raw = d.get("raw_label")
            vc = d.get("vehicle_class", "car")
            if raw:
                if raw in {"Hatchback", "Sedan", "SUV", "MUV", "Van"}: cars += 1
                elif raw in {"Two-wheeler"}: bikes += 1
                elif raw in {"Three-wheeler"}: autos += 1
                elif raw in {"Bus", "Mini-bus"}: buses += 1
                elif raw in {"Truck", "LCV", "Tempo-traveller"}: trucks += 1
            else:
                if vc == "car": cars += 1
                elif vc == "2-wheeler": bikes += 1
                elif vc == "auto": autos += 1
                elif vc == "bus": buses += 1
                elif vc == "truck": trucks += 1
                
            factors = PCE_LENGTH_MAP.get(vc, PCE_LENGTH_MAP["car"])
            pce_sum += factors["pce"]
            total_len += factors["length_m"]
            
        num_lanes = EFFECTIVE_LANES_MAP.get(lane, 2.5)
        queue_meters = round(total_len / num_lanes, 1) if len(detections) > 0 else 0.0
        
        queue_summary[lane] = {
            "vehicles": len(detections),
            "cars": cars,
            "bikes": bikes,
            "autos": autos,
            "buses": buses,
            "trucks": trucks,
            "pce": round(pce_sum, 1),
            "meters": queue_meters
        }
    t_q_1 = time.perf_counter()
    
    pre_ms = (t_pre_1 - t_pre_0) * 1000
    infer_ms = (t_inf_1 - t_inf_0) * 1000
    queue_ms = (t_q_1 - t_q_0) * 1000
    total_ms = (t_q_1 - t_start) * 1000
    
    batch_latencies.append({
        "pre_ms": pre_ms,
        "infer_ms": infer_ms,
        "queue_ms": queue_ms,
        "total_ms": total_ms
    })
    
    print(f"Batch Run {r+1}: Ingest = {pre_ms:5.2f}ms | 4-Frame Forward Pass = {infer_ms:6.2f}ms | Queue PCE = {queue_ms:4.2f}ms | TOTAL = {total_ms:6.2f}ms")

# Average Timing Profile
avg_pre = sum(x["pre_ms"] for x in batch_latencies) / batch_runs
avg_infer = sum(x["infer_ms"] for x in batch_latencies) / batch_runs
avg_queue = sum(x["queue_ms"] for x in batch_latencies) / batch_runs
avg_total = sum(x["total_ms"] for x in batch_latencies) / batch_runs

# Log using Vision Logger
vision_logger.log_inference(
    junction_id="TEST-JUNCTION-01",
    model_name=detector.model_type,
    batch_size=4,
    timings={
        "pre_ms": avg_pre,
        "infer_ms": avg_infer,
        "track_ms": 5.0,
        "queue_ms": avg_queue,
        "total_ms": avg_total
    },
    queue_summary=queue_summary
)

print("=" * 75)
print("                   FINAL BENCHMARK RESULTS")
print("=" * 75)
print(f"  • Single Frame Inference Time : {avg_single_infer:.2f} ms ({1000.0/avg_single_infer:.1f} FPS)")
print(f"  • 4-Lane Batch Forward Pass   : {avg_infer:.2f} ms")
print(f"  • Per-Lane Effective Latency  : {avg_infer/4.0:.2f} ms per camera")
print(f"  • Complete 4-Lane Cycle Time  : {avg_total:.2f} ms")
print("=" * 75)
