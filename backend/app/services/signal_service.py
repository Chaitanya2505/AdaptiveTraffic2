import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.junction import Junction
from app.models.signal import Signal
from app.models.detection import Detection

class SignalService:
    @staticmethod
    async def optimize(db: AsyncSession, junction_id: str, mode: str, lane_counts_override: dict = None) -> Signal:
        # Check if junction exists
        result = await db.execute(select(Junction).where(Junction.id == junction_id))
        junction = result.scalar_one_or_none()
        if not junction:
            raise ValueError(f"Junction {junction_id} not found")

        # Query recent detections (last 5 minutes) to estimate lane density
        five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
        det_query = select(Detection).where(
            Detection.junction_id == junction_id,
            Detection.timestamp >= five_mins_ago
        )
        det_result = await db.execute(det_query)
        recent_dets = det_result.scalars().all()

        # Count vehicles per lane
        lane_counts = {}
        if lane_counts_override is not None:
            lane_counts = lane_counts_override
        else:
            for d in recent_dets:
                lane_counts[d.lane_id] = lane_counts.get(d.lane_id, 0) + 1

        # Query the most recent signal to determine the NEXT phase in the cycle
        last_signal_result = await db.execute(
            select(Signal)
            .where(Signal.junction_id == junction_id)
            .order_by(Signal.timestamp.desc())
            .limit(1)
        )
        last_signal = last_signal_result.scalar_one_or_none()
        
        # 4-Phase Sequence: NORTH -> EAST -> SOUTH -> WEST
        phase_sequence = ["NORTH_GREEN", "EAST_GREEN", "SOUTH_GREEN", "WEST_GREEN"]
        
        if last_signal and last_signal.phase in phase_sequence:
            current_index = phase_sequence.index(last_signal.phase)
            next_phase = phase_sequence[(current_index + 1) % 4]
        else:
            next_phase = "NORTH_GREEN" # Default start

        # Group lanes assuming L1=North, L2=East, L3=South, L4=West
        # Based on 4 video lanes requirement
        lane_mapping = {
            "NORTH_GREEN": "L1",
            "EAST_GREEN": "L2",
            "SOUTH_GREEN": "L3",
            "WEST_GREEN": "L4"
        }

        # Calculate Webster's Optimum Cycle Length
        # Saturation flow (S) approx 1800 veh/hr/lane = 0.5 veh/sec
        # We estimate hourly volume (V) by taking the 5-min count * 12
        Y = 0.0
        y_ratios = {}
        
        for p in phase_sequence:
            lane = lane_mapping[p]
            count = lane_counts.get(lane, 0)
            
            # V = hourly volume. (count in 5 mins * 12)
            hourly_vol = count * 12
            
            # y = V / S. We cap y at 0.22 to ensure Y doesn't exceed 0.9 for stability
            y = min(hourly_vol / 1800.0, 0.22)
            y_ratios[p] = max(y, 0.05) # Minimum flow ratio to guarantee some green time
            Y += y_ratios[p]

        # Total lost time (L) for 4 phases (approx 5s lost per phase due to yellow/all-red clearance)
        L = 4 * 5
        
        # C_opt = (1.5L + 5) / (1 - Y)
        # Cap Y at 0.85 to avoid division by zero or infinite cycle lengths
        Y_capped = min(Y, 0.85)
        c_opt = (1.5 * L + 5) / (1 - Y_capped)
        
        # Bound the cycle length between 40s (min) and 180s (max)
        c_opt = min(max(c_opt, 40), 180)

        # Allocate green time for the NEXT phase proportionally
        # G = (y / Y) * (C_opt - L)
        y_next = y_ratios[next_phase]
        green_time = (y_next / Y_capped) * (c_opt - L)
        
        # Bound the green time to practical limits (Min 10s, Max 60s)
        duration = min(max(int(green_time), 10), 60)
        
        # Final override if there's absolutely no traffic detected
        if not recent_dets and lane_counts_override is None:
            duration = 15

        phase = next_phase

        # Save the new signal timing plan
        optimized_signal = Signal(
            junction_id=junction_id,
            phase=phase,
            duration=duration,
            mode=mode.upper()
        )
        db.add(optimized_signal)
        await db.commit()
        await db.refresh(optimized_signal)

        return optimized_signal
