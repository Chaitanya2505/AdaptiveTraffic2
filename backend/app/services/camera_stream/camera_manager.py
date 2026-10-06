"""
Camera Feed Manager - Ingests camera streams across multiple protocols (RTSP, File, Synthetic, Edge Push).
Maintains background capture worker threads for high-throughput, non-blocking frame retrieval.
"""

import cv2
import numpy as np
import threading
import time
import os
import base64
from typing import Dict, Optional, Any, List
from pathlib import Path

# Paths to sample videos if available
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
SAMPLE_VIDEO_CANDIDATES = [
    BASE_DIR / "test" / "video.mp4",
    BASE_DIR / "result" / "video.mp4",
    BASE_DIR / "frontend" / "public" / "sample_cctv" / "brt_sample.mp4"
]

def find_sample_video() -> Optional[str]:
    for p in SAMPLE_VIDEO_CANDIDATES:
        if p.exists() and p.stat().st_size > 0:
            return str(p)
    return None

DEFAULT_SAMPLE_VIDEO = find_sample_video()


class CameraChannel:
    """Represents a single camera channel (e.g., North, South, East, West Approach)."""
    def __init__(
        self,
        camera_id: str,
        name: str,
        approach: str,
        junction_id: str,
        source_type: str = "synthetic",  # 'rtsp', 'video_file', 'synthetic', 'edge_push'
        source_url: Optional[str] = None
    ):
        self.camera_id = camera_id
        self.name = name
        self.approach = approach
        self.junction_id = junction_id
        self.source_type = source_type
        self.source_url = source_url or (DEFAULT_SAMPLE_VIDEO if source_type == "video_file" else "")
        
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()
        
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_timestamp: float = 0.0
        self.frame_count: int = 0
        self.fps: float = 0.0
        self.status: str = "INITIALIZING"
        self.error_message: Optional[str] = None
        self.resolution: str = "1280x720"
        
        # Influx/simulation state for synthetic generator
        self.synthetic_density = 4  # base vehicle count

    def set_source(self, source_type: str, source_url: Optional[str] = None):
        """Switch source protocol/URL dynamically."""
        with self.lock:
            self.source_type = source_type
            if source_url:
                self.source_url = source_url
            elif source_type == "video_file" and not self.source_url:
                self.source_url = DEFAULT_SAMPLE_VIDEO or ""
            self.error_message = None
            self.status = "RESTARTING"

    def update_edge_frame(self, frame_bgr: np.ndarray):
        """Update frame pushed by an edge device."""
        with self.lock:
            self.latest_frame = frame_bgr
            self.latest_timestamp = time.time()
            self.frame_count += 1
            self.status = "ONLINE"
            self.source_type = "edge_push"

    def get_frame(self) -> Optional[np.ndarray]:
        """Thread-safe copy of latest frame."""
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None

    def get_info(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "camera_id": self.camera_id,
                "name": self.name,
                "approach": self.approach,
                "junction_id": self.junction_id,
                "source_type": self.source_type,
                "source_url": self.source_url,
                "status": self.status,
                "fps": round(self.fps, 1),
                "frame_count": self.frame_count,
                "resolution": self.resolution,
                "error_message": self.error_message,
                "last_seen_epoch": self.latest_timestamp
            }


class CameraFeedManager:
    """Coordinates all junction camera channels and background acquisition threads."""
    def __init__(self):
        self.channels: Dict[str, CameraChannel] = {}
        self._init_default_channels()
        self._started = False

    def ensure_started(self):
        if not self._started:
            self._started = True
            self.start_all()

    def _init_default_channels(self):
        """Initialize standard 4-way intersection cameras (North, South, East, West)."""
        configs = [
            ("CAM_01_NORTH", "North Approach CCTV", "NORTH", "J-001", "synthetic"),
            ("CAM_02_SOUTH", "South Approach CCTV", "SOUTH", "J-001", "synthetic"),
            ("CAM_03_EAST", "East Approach CCTV", "EAST", "J-001", "synthetic"),
            ("CAM_04_WEST", "West Approach CCTV", "WEST", "J-001", "synthetic"),
        ]

        for cid, name, approach, jid, stype in configs:
            self.channels[cid] = CameraChannel(
                camera_id=cid,
                name=name,
                approach=approach,
                junction_id=jid,
                source_type=stype,
                source_url=DEFAULT_SAMPLE_VIDEO if stype == "video_file" else None
            )

    def start_all(self):
        for channel in self.channels.values():
            if not channel.is_running:
                channel.is_running = True
                channel.thread = threading.Thread(target=self._feed_worker, args=(channel,), daemon=True)
                channel.thread.start()

    def get_channel(self, camera_id: str) -> Optional[CameraChannel]:
        self.ensure_started()
        return self.channels.get(camera_id)

    def list_channels(self) -> List[Dict[str, Any]]:
        self.ensure_started()
        return [ch.get_info() for ch in self.channels.values()]


    def register_or_update(
        self,
        camera_id: str,
        name: str,
        approach: str,
        junction_id: str,
        source_type: str,
        source_url: Optional[str] = None
    ) -> Dict[str, Any]:
        if camera_id in self.channels:
            ch = self.channels[camera_id]
            ch.name = name
            ch.approach = approach
            ch.junction_id = junction_id
            ch.set_source(source_type, source_url)
        else:
            ch = CameraChannel(camera_id, name, approach, junction_id, source_type, source_url)
            self.channels[camera_id] = ch
            ch.is_running = True
            ch.thread = threading.Thread(target=self._feed_worker, args=(ch,), daemon=True)
            ch.thread.start()
        return ch.get_info()

    def _feed_worker(self, channel: CameraChannel):
        """Worker loop reading frames from RTSP, file loop, or synthetic generator."""
        cap = None
        current_source_type = None
        current_source_url = None
        fps_timer = time.time()
        frames_in_second = 0

        while channel.is_running:
            try:
                # Detect configuration changes
                if (current_source_type != channel.source_type or
                    current_source_url != channel.source_url or
                    channel.status == "RESTARTING"):
                    if cap is not None:
                        cap.release()
                        cap = None
                    current_source_type = channel.source_type
                    current_source_url = channel.source_url
                    channel.status = "CONNECTING"

                # 1. Edge Push Mode (frames are fed asynchronously via POST)
                if current_source_type == "edge_push":
                    time.sleep(0.04)
                    if time.time() - channel.latest_timestamp > 5.0 and channel.latest_timestamp > 0:
                        channel.status = "OFFLINE (EDGE IDLE)"
                    continue

                # 2. Synthetic Generator Mode
                elif current_source_type == "synthetic":
                    frame = self._generate_synthetic_frame(channel)
                    with channel.lock:
                        channel.latest_frame = frame
                        channel.latest_timestamp = time.time()
                        channel.frame_count += 1
                        channel.status = "ONLINE (SYNTHETIC)"
                        channel.resolution = f"{frame.shape[1]}x{frame.shape[0]}"
                    time.sleep(0.04)  # ~25 FPS

                # 3. RTSP Stream or Video File Mode
                elif current_source_type in ("rtsp", "video_file"):
                    if cap is None:
                        target = current_source_url
                        if not target and current_source_type == "video_file":
                            target = DEFAULT_SAMPLE_VIDEO

                        if not target:
                            channel.status = "NO SOURCE URL"
                            channel.latest_frame = self._generate_error_frame(channel, "No URL/File Configured")
                            time.sleep(1.0)
                            continue

                        cap = cv2.VideoCapture(target)
                        if not cap.isOpened():
                            channel.status = "CONNECTION FAILED"
                            channel.error_message = f"Cannot open {current_source_type}: {target}"
                            channel.latest_frame = self._generate_error_frame(channel, f"Failed: {target[:30]}")
                            time.sleep(2.0)
                            cap = None
                            continue
                        else:
                            channel.status = f"ONLINE ({current_source_type.upper()})"
                            channel.error_message = None

                    ret, frame = cap.read()
                    if not ret:
                        # For video_file, loop continuously
                        if current_source_type == "video_file":
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            ret, frame = cap.read()
                        
                        if not ret:
                            channel.status = "STREAM ENDED / TIMEOUT"
                            cap.release()
                            cap = None
                            time.sleep(1.0)
                            continue

                    with channel.lock:
                        channel.latest_frame = frame
                        channel.latest_timestamp = time.time()
                        channel.frame_count += 1
                        channel.status = f"ONLINE ({current_source_type.upper()})"
                        channel.resolution = f"{frame.shape[1]}x{frame.shape[0]}"

                    # Throttle file playback to ~25 FPS
                    time.sleep(0.04)

                # FPS Calculation
                frames_in_second += 1
                now = time.time()
                if now - fps_timer >= 1.0:
                    channel.fps = frames_in_second / (now - fps_timer)
                    frames_in_second = 0
                    fps_timer = now

            except Exception as e:
                channel.status = "WORKER ERROR"
                channel.error_message = str(e)
                time.sleep(1.0)

        if cap is not None:
            cap.release()

    def _generate_synthetic_frame(self, channel: CameraChannel) -> np.ndarray:
        """Generates dynamic realistic CCTV street scene frames with road lanes and simulated vehicles."""
        w, h = 640, 360
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        
        # Asphalt roadway
        frame[:] = (35, 38, 42)
        
        # Road boundaries & lane markings
        cv2.rectangle(frame, (60, 40), (580, 320), (50, 55, 60), -1)
        
        # Lane divider lines (dashed)
        t = time.time()
        dash_offset = int((t * 50) % 40)
        for y in range(40 + dash_offset, 320, 40):
            cv2.line(frame, (230, y), (230, min(320, y + 20)), (200, 200, 200), 2)
            cv2.line(frame, (410, y), (410, min(320, y + 20)), (200, 200, 200), 2)
            
        # BRTS Dedicated Lane strip (Left Lane)
        cv2.line(frame, (100, 40), (100, 320), (0, 165, 255), 3)
        cv2.putText(frame, "BRTS BUSWAY", (70, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 165, 255), 1)

        # Procedural Moving Vehicles
        lane_x = [150, 320, 490]
        speeds = [60, 75, 50]
        colors = [(220, 120, 50), (60, 180, 75), (200, 50, 200), (255, 255, 255)]
        
        for i, lx in enumerate(lane_x):
            # Compute position based on sine waves and time
            speed = speeds[i]
            y_pos = int((t * speed + i * 110) % 240) + 50
            car_w = 40
            car_h = 65
            c = colors[i % len(colors)]
            
            # Car body
            cv2.rectangle(frame, (lx - car_w // 2, y_pos), (lx + car_w // 2, y_pos + car_h), c, -1)
            # Windshield
            cv2.rectangle(frame, (lx - car_w // 2 + 5, y_pos + 12), (lx + car_w // 2 - 5, y_pos + 25), (40, 40, 40), -1)
            # Headlights
            cv2.circle(frame, (lx - car_w // 2 + 6, y_pos + car_h - 2), 3, (0, 255, 255), -1)
            cv2.circle(frame, (lx + car_w // 2 - 6, y_pos + car_h - 2), 3, (0, 255, 255), -1)

        # CCTV On-Screen Display (OSD) HUD
        timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.rectangle(frame, (0, 0), (w, 30), (15, 15, 20), -1)
        cv2.putText(frame, f"CCTV: {channel.name} [{channel.approach}]", (10, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 200), 1)
        cv2.putText(frame, f"LIVE REC {timestamp_str}", (w - 210, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)
        
        # Red REC blinking indicator
        if int(t * 2) % 2 == 0:
            cv2.circle(frame, (w - 225, 16), 5, (0, 0, 255), -1)

        return frame

    def _generate_error_frame(self, channel: CameraChannel, message: str) -> np.ndarray:
        """Generates visual test pattern / error screen when camera is offline or disconnected."""
        w, h = 640, 360
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:] = (25, 20, 25)
        
        # Caution cross stripes
        cv2.putText(frame, "NO SIGNAL / DISCONNECTED", (160, 160),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        cv2.putText(frame, f"Channel: {channel.name} ({channel.camera_id})", (160, 195),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        cv2.putText(frame, f"Status: {message}", (160, 225),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 150, 255), 1)
        return frame


# Global singleton instance
camera_manager = CameraFeedManager()
