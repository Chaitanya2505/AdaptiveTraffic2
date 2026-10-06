"""
Camera Stream Service Module for E-Rakshak Intelligent Traffic Management System.
Supports RTSP, MJPEG, Local MP4 Video Loop, Synthetic Generator, and Edge Push Ingestion.
"""

from .camera_manager import CameraFeedManager, camera_manager
from .stream_processor import StreamProcessor, stream_processor

__all__ = [
    "CameraFeedManager",
    "camera_manager",
    "StreamProcessor",
    "stream_processor"
]
