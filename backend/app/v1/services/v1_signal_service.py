import math
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.junction import Junction
from app.models.signal import Signal
from app.models.detection import Detection


# Traffic Engineering Parameters (IRC:106-1990 / Indo-HCM 2017)
PCE_FACTORS = {
    "car": 1.00,
    "2-wheeler": 0.35,
    "auto": 0.60,
    "bus": 2.50,
    "truck": 3.00
}

BASE_SATURATION_FLOW_PER_LANE = 1800.0  # PCE / hr / lane

# Calibrated approach road geometry (effective lane count per approach)
APPROACH_LANES = {
    "L1": 2.0,  # North
    "L2": 3.0,  # South
    "L3": 2.5,  # East
    "L4": 3.0   # West
}

# Modal composition friction coefficients
COEFF_BIKE_SEEPAGE = 0.12
COEFF_HEAVY_FRICTION = 0.18
FRICTION_MIN_BOUND = 0.75
FRICTION_MAX_BOUND = 1.25

# Signal timing bounds (seconds)
LOST_TIME_PER_PHASE = 4.0     # 3s yellow + 1s all-red clearance
TOTAL_LOST_TIME = 4 * LOST_TIME_PER_PHASE  # L = 16.0s for 4 phases
MIN_GREEN_FLOOR = 10          # Pedestrian clearance minimum green
MAX_GREEN_CEILING = 65        # Green maximum per phase
CYCLE_MIN = 4 * MIN_GREEN_FLOOR + int(TOTAL_LOST_TIME)  # 56s minimum feasible cycle
CYCLE_MAX = 160               # Maximum cycle length

EMA_ALPHA_DEMAND = 0.30       # Demand smoothing factor against camera detection noise
STARVATION_T_MAX_WAIT = 180.0 # Maximum wait time threshold (seconds) for starvation priority

PHASE_TO_LANE = {
    "LANE_1_NORTH": "L1",
    "LANE_2_SOUTH": "L2",
    "LANE_3_EAST": "L3",
    "LANE_4_WEST": "L4"
}
LANE_TO_PHASE = {v: k for k, v in PHASE_TO_LANE.items()}
PHASE_SEQUENCE = ["LANE_1_NORTH", "LANE_2_SOUTH", "LANE_3_EAST", "LANE_4_WEST"]


class V1SignalService:
    """
    Queue-Responsive Modified Webster Controller (QR-MWC).

    Guarantees:
      - Mathematical Invariant: sum(G_i) + lost_time == cycle_length exactly.
      - Oversaturation Mode: Gating at C_max when critical flow ratio Y >= 0.85.
      - Bounded Waterfilling: Ensures each phase gets green within [min_green, max_green].
      - Vision Noise Filtering: First-order EMA demand smoothing.
    """

    _lane_history: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def _get_or_init_history(cls, junction_id: str) -> Dict[str, Any]:
        if junction_id not in cls._lane_history:
            cls._lane_history[junction_id] = {
                "smooth_pce": {"L1": 0.0, "L2": 0.0, "L3": 0.0, "L4": 0.0},
                "prev_queues": {"L1": 0.0, "L2": 0.0, "L3": 0.0, "L4": 0.0},
                "last_green_time": {p: time.time() for p in PHASE_SEQUENCE},
                "prev_cycle_length": 60.0
            }
        return cls._lane_history[junction_id]

    @staticmethod
    async def optimize(
        db: AsyncSession,
        junction_id: str,
        mode: str = "VISION",
        lane_counts_override: Optional[Dict[str, Any]] = None,
        dry_run: bool = False
    ) -> Signal:
        """
        Executes QR-MWC Optimization, commits active signal record to database,
        and returns the mathematically balanced 4-phase coordinated plan.
        """
        result = await db.execute(select(Junction).where(Junction.id == junction_id))
        junction = result.scalar_one_or_none()
        if not junction:
            raise ValueError(f"Junction {junction_id} not found")

        history = V1SignalService._get_or_init_history(junction_id)
        now_epoch = time.time()

        # Step 1: Ingest lane counts or query recent database detections as fallback
        if lane_counts_override is None:
            time_window = datetime.now(timezone.utc) - timedelta(minutes=2)
            result = await db.execute(
                select(Detection).where(
                    Detection.junction_id == junction_id,
                    Detection.timestamp >= time_window
                )
            )
            recent_dets = result.scalars().all()
            db_counts = {l: {"vehicles": 0, "cars": 0, "bikes": 0, "autos": 0, "buses": 0, "trucks": 0} for l in ["L1", "L2", "L3", "L4"]}
            for d in recent_dets:
                lid = d.lane_id if d.lane_id in db_counts else "L1"
                db_counts[lid]["vehicles"] += 1
                vc = (d.vehicle_class or "").lower()
                if "car" in vc:
                    db_counts[lid]["cars"] += 1
                elif "2-wheeler" in vc or "bike" in vc:
                    db_counts[lid]["bikes"] += 1
                elif "auto" in vc:
                    db_counts[lid]["autos"] += 1
                elif "bus" in vc:
                    db_counts[lid]["buses"] += 1
                elif "truck" in vc:
                    db_counts[lid]["trucks"] += 1
                else:
                    db_counts[lid]["cars"] += 1
            lane_counts_override = db_counts

        approach_data = V1SignalService._extract_approach_metrics(lane_counts_override)

        # Apply EMA smoothing on PCE demand
        smoothed_pce = {}
        for l, d in approach_data.items():
            prev_s = history["smooth_pce"].get(l, d["pce"])
            s_val = (EMA_ALPHA_DEMAND * d["pce"]) + ((1.0 - EMA_ALPHA_DEMAND) * prev_s)
            smoothed_pce[l] = round(s_val, 2)
            history["smooth_pce"][l] = s_val

        # Step 2: Saturation flow and flow ratios per approach
        saturation_flows = {}
        flow_ratios = {}
        prev_c = max(CYCLE_MIN, min(history["prev_cycle_length"], CYCLE_MAX))

        for lane_id, data in approach_data.items():
            eff_lanes = APPROACH_LANES.get(lane_id, 2.5)
            total_veh = max(1, data["vehicles"])
            bike_p = data.get("bikes", 0) / total_veh
            heavy_p = (data.get("buses", 0) + data.get("trucks", 0)) / total_veh

            # Modal friction modifier
            f_comp = 1.0 + (COEFF_BIKE_SEEPAGE * bike_p) - (COEFF_HEAVY_FRICTION * heavy_p)
            f_comp = max(FRICTION_MIN_BOUND, min(f_comp, FRICTION_MAX_BOUND))

            s_i = BASE_SATURATION_FLOW_PER_LANE * eff_lanes * f_comp
            saturation_flows[lane_id] = s_i

            q_i = (smoothed_pce[lane_id] / prev_c) * 3600.0
            y_i = max(0.04, min(q_i / s_i, 0.40))
            flow_ratios[lane_id] = y_i

        # Step 3: Critical ratio Y and cycle length calculation
        Y = sum(flow_ratios.values())
        is_oversaturated = (Y >= 0.85)

        if is_oversaturated:
            # Gating at maximum cycle length to maximize capacity under oversaturation
            cycle_length = CYCLE_MAX
            control_state = "OVERSATURATION_CLEARANCE"
            effective_green_budget = cycle_length - TOTAL_LOST_TIME
        else:
            # Modified Webster delay-minimizing optimum cycle
            c_opt = (1.5 * TOTAL_LOST_TIME + 5.0) / (1.0 - Y)
            cycle_length = int(round(max(CYCLE_MIN, min(c_opt, CYCLE_MAX))))
            control_state = "WEBSTER_OPTIMAL"
            effective_green_budget = cycle_length - TOTAL_LOST_TIME

        history["prev_cycle_length"] = float(cycle_length)

        # Step 4: Queue momentum and red starvation urgency weights
        urgency_weights = {}
        prev_queues = history["prev_queues"]

        for lane_id, data in approach_data.items():
            phase_key = LANE_TO_PHASE[lane_id]
            curr_q = smoothed_pce[lane_id]
            prev_q = prev_queues.get(lane_id, curr_q)
            delta_q = curr_q - prev_q

            t_wait = max(0.0, now_epoch - history["last_green_time"].get(phase_key, now_epoch - 60.0))
            starvation_factor = math.pow(min(t_wait / STARVATION_T_MAX_WAIT, 1.5), 2)

            momentum = 1.0 + (0.25 * math.tanh(delta_q / 4.0))
            omega = (curr_q * momentum) + (3.0 * starvation_factor)
            urgency_weights[lane_id] = max(0.2, omega)
            prev_queues[lane_id] = curr_q

        # Step 5: Bounded waterfilling green split allocation (sum(G_i) + L == C)
        phase_durations = V1SignalService._allocate_bounded_green(
            flow_ratios=flow_ratios,
            urgency_weights=urgency_weights,
            total_green_budget=int(effective_green_budget),
            min_green=MIN_GREEN_FLOOR,
            max_green=MAX_GREEN_CEILING
        )

        # Verification of invariant: sum(G_i) + L == cycle_length
        allocated_green_sum = sum(phase_durations.values())
        assert allocated_green_sum + int(TOTAL_LOST_TIME) == cycle_length, (
            f"Invariant violation: {allocated_green_sum} + {int(TOTAL_LOST_TIME)} != {cycle_length}"
        )

        # ----------------------------------------------------------------------
        # Step 6: Sequence Progression & Database Persistence
        # ----------------------------------------------------------------------
        last_signal_result = await db.execute(
            select(Signal)
            .where(Signal.junction_id == junction_id)
            .order_by(Signal.timestamp.desc())
            .limit(1)
        )
        last_signal = last_signal_result.scalar_one_or_none()

        if mode.upper() == "DRL":
            from app.v1.services.v1_drl_service import drl_service
            
            metrics = {
                "NORTH": {"queue": approach_data.get("L1", {}).get("vehicles", 0), "wait": max(0.0, now_epoch - history["last_green_time"].get("LANE_1_NORTH", now_epoch - 60.0))},
                "SOUTH": {"queue": approach_data.get("L2", {}).get("vehicles", 0), "wait": max(0.0, now_epoch - history["last_green_time"].get("LANE_2_SOUTH", now_epoch - 60.0))},
                "EAST": {"queue": approach_data.get("L3", {}).get("vehicles", 0), "wait": max(0.0, now_epoch - history["last_green_time"].get("LANE_3_EAST", now_epoch - 60.0))},
                "WEST": {"queue": approach_data.get("L4", {}).get("vehicles", 0), "wait": max(0.0, now_epoch - history["last_green_time"].get("LANE_4_WEST", now_epoch - 60.0))}
            }
            active_approach = last_signal.phase if last_signal else "LANE_1_NORTH"
            
            if last_signal and last_signal.timestamp.tzinfo is None:
                last_ts = last_signal.timestamp.replace(tzinfo=timezone.utc).timestamp()
            elif last_signal:
                last_ts = last_signal.timestamp.timestamp()
            else:
                last_ts = now_epoch
                
            elapsed_time = now_epoch - last_ts
            action = drl_service.get_action(metrics, active_approach, elapsed_time)
            
            if action == 0:
                if active_approach in ["LANE_1_NORTH", "LANE_2_SOUTH"]:
                    next_phase = "LANE_2_SOUTH" if active_approach == "LANE_1_NORTH" else "LANE_1_NORTH"
                else:
                    next_phase = "LANE_1_NORTH"
            else:
                if active_approach in ["LANE_3_EAST", "LANE_4_WEST"]:
                    next_phase = "LANE_4_WEST" if active_approach == "LANE_3_EAST" else "LANE_3_EAST"
                else:
                    next_phase = "LANE_3_EAST"
            control_state = "DRL_AGENT_CONTROL"
        else:
            if last_signal and last_signal.phase in PHASE_SEQUENCE:
                curr_idx = PHASE_SEQUENCE.index(last_signal.phase)
                next_phase = PHASE_SEQUENCE[(curr_idx + 1) % 4]
            else:
                next_phase = "LANE_1_NORTH"

        history["last_green_time"][next_phase] = now_epoch
        active_duration = phase_durations[next_phase]

        optimized_signal = Signal(
            junction_id=junction_id,
            phase=next_phase,
            duration=active_duration,
            mode=mode.upper()
        )
        if not dry_run:
            db.add(optimized_signal)
            await db.commit()
            await db.refresh(optimized_signal)

        # Attach telemetry metrics for downstream clients
        optimized_signal.phase_plan = phase_durations
        optimized_signal.cycle_length = cycle_length
        optimized_signal.critical_ratio = round(Y, 3)
        optimized_signal.control_state = control_state

        return optimized_signal

    @staticmethod
    def _allocate_bounded_green(
        flow_ratios: Dict[str, float],
        urgency_weights: Dict[str, float],
        total_green_budget: int,
        min_green: int,
        max_green: int
    ) -> Dict[str, int]:
        """
        Iterative waterfilling algorithm for bounded green split distribution.
        
        Ensures that:
          1. Every phase receives at least min_green.
          2. No phase exceeds max_green.
          3. Total allocated green matches total_green_budget exactly (sum(G_i) == G_total).
          4. Distribution strictly preserves demand and urgency weight proportionality.
        """
        phases = list(PHASE_SEQUENCE)
        num_phases = len(phases)

        # Base nominal weights combining flow ratio y_i with queue urgency omega_i
        raw_weights = {}
        for p in phases:
            lane_id = PHASE_TO_LANE[p]
            y_i = flow_ratios.get(lane_id, 0.1)
            omega_i = urgency_weights.get(lane_id, 1.0)
            raw_weights[p] = max(0.01, y_i * (0.60 + 0.40 * (omega_i / max(0.1, sum(urgency_weights.values()) / num_phases))))

        # Clamping floors and ceilings
        allocated = {p: min_green for p in phases}
        remaining_budget = total_green_budget - (min_green * num_phases)

        if remaining_budget <= 0:
            # Extreme low cycle fallback: each lane gets min_green
            return allocated

        # Iterative distribution over free (unclamped) phases
        free_phases = set(phases)
        while remaining_budget > 0 and free_phases:
            weight_sum = sum(raw_weights[p] for p in free_phases)
            if weight_sum <= 0:
                # Distribute evenly if weights are zero
                split = remaining_budget // len(free_phases)
                for p in list(free_phases):
                    room = max_green - allocated[p]
                    add = min(room, split)
                    allocated[p] += add
                    remaining_budget -= add
                    free_phases.remove(p)
                break

            any_clamped = False
            for p in list(free_phases):
                share = (raw_weights[p] / weight_sum) * remaining_budget
                proposed = allocated[p] + share
                if proposed >= max_green:
                    remaining_budget -= (max_green - allocated[p])
                    allocated[p] = max_green
                    free_phases.remove(p)
                    any_clamped = True

            if not any_clamped:
                # No phases hit ceiling: allocate integer parts and distribute residuals
                int_shares = {}
                int_sum = 0
                for p in free_phases:
                    share = int(math.floor((raw_weights[p] / weight_sum) * remaining_budget))
                    int_shares[p] = share
                    int_sum += share

                for p in free_phases:
                    allocated[p] += int_shares[p]
                remaining_budget -= int_sum

                # Distribute remainder seconds (1s per phase) by highest fractional remainder
                if remaining_budget > 0:
                    ranked = sorted(free_phases, key=lambda p: raw_weights[p], reverse=True)
                    for p in ranked[:remaining_budget]:
                        allocated[p] += 1
                    remaining_budget = 0
                break

        # Final sanity adjustment to ensure exact budget match down to the second
        diff = total_green_budget - sum(allocated.values())
        if diff != 0:
            # Adjust non-critical lane without breaching [min_green, max_green]
            for p in sorted(phases, key=lambda p: raw_weights[p], reverse=(diff > 0)):
                room = (max_green - allocated[p]) if diff > 0 else (allocated[p] - min_green)
                adj = min(abs(diff), room)
                if adj > 0:
                    allocated[p] += adj if diff > 0 else -adj
                    diff += -adj if diff > 0 else adj
                if diff == 0:
                    break

        return allocated

    @staticmethod
    def _extract_approach_metrics(lane_counts_override: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Extracts multi-class vehicle counts, physical meters, and PCE sums.
        """
        lanes = ["L1", "L2", "L3", "L4"]
        output = {}

        for l in lanes:
            raw = (lane_counts_override or {}).get(l, {})
            if isinstance(raw, dict):
                cars = raw.get("cars", 0)
                bikes = raw.get("bikes", 0)
                autos = raw.get("autos", 0)
                buses = raw.get("buses", 0)
                trucks = raw.get("trucks", 0)

                # Use provided PCE or calculate strictly using PCE_FACTORS
                pce_calc = (
                    (cars * PCE_FACTORS["car"]) +
                    (bikes * PCE_FACTORS["2-wheeler"]) +
                    (autos * PCE_FACTORS["auto"]) +
                    (buses * PCE_FACTORS["bus"]) +
                    (trucks * PCE_FACTORS["truck"])
                )
                pce_val = float(raw.get("pce", pce_calc))

                output[l] = {
                    "vehicles": raw.get("vehicles", cars + bikes + autos + buses + trucks),
                    "cars": cars,
                    "bikes": bikes,
                    "autos": autos,
                    "buses": buses,
                    "trucks": trucks,
                    "pce": round(pce_val, 2),
                    "meters": float(raw.get("meters", 0.0))
                }
            elif isinstance(raw, (int, float)):
                v = int(raw)
                output[l] = {
                    "vehicles": v, "cars": v, "bikes": 0, "autos": 0, "buses": 0, "trucks": 0,
                    "pce": float(v) * 1.0,
                    "meters": float(v) * 4.8 / APPROACH_LANES.get(l, 2.5)
                }
            else:
                output[l] = {
                    "vehicles": 0, "cars": 0, "bikes": 0, "autos": 0, "buses": 0, "trucks": 0,
                    "pce": 0.0, "meters": 0.0
                }

        return output


