import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.junction import Junction
from app.models.signal import Signal
from app.models.detection import Detection

class SignalService:
    @staticmethod
    async def optimize(db: AsyncSession, junction_id: str, mode: str) -> Signal:
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
        for d in recent_dets:
            lane_counts[d.lane_id] = lane_counts.get(d.lane_id, 0) + 1

        # Determine the green phase based on active traffic load
        # For simplicity, compare odd lanes (e.g. L1, L3) vs even lanes (e.g. L2, L4)
        odd_lane_count = sum(count for lane, count in lane_counts.items() if any(c in lane for c in ["1", "3", "5"]))
        even_lane_count = sum(count for lane, count in lane_counts.items() if any(c in lane for c in ["2", "4", "6"]))

        if odd_lane_count > even_lane_count:
            phase = "NS_GREEN"
            max_load = odd_lane_count
        else:
            phase = "EW_GREEN"
            max_load = even_lane_count

        # Webster-like dynamic duration: base of 30s + 5s per waiting vehicle, capped at 90s
        duration = min(max(30 + max_load * 5, 30), 90)

        # Fallback to random defaults if there are no vehicles active currently
        if not recent_dets:
            phase = random.choice(["NS_GREEN", "EW_GREEN", "NS_LEFT", "EW_LEFT"])
            duration = random.randint(30, 60)

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
