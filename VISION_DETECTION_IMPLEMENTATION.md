# Vision Detection Implementation - UVH-26 Model Integration

## Overview
The "Analyze 4-Lane CCTV Feeds" button on the Vision Sensing page now uses the **IISc UVH-26 (YOLOv11-S)** deep learning model for real-time vehicle detection and traffic queue analysis.

## Implementation Details

### Frontend Changes (VisionPage.jsx)

#### 1. Enhanced `handleAnalyze()` Function
- Uploads 4-lane CCTV images/videos to backend via `/vision/detect-batch` API
- Uses **FormData** for multipart file upload (no explicit Content-Type header needed)
- Includes comprehensive logging for debugging
- Falls back to dynamic detection if backend is unavailable

**Key Features:**
```javascript
// Logs detection progress
console.log("[VisionPage] Starting UVH-26 vehicle detection...");
console.log("[VisionPage] Queue lengths:", data.queue_lengths);
console.log("[VisionPage] Inference time:", data.inference_time_ms, "ms");
```

#### 2. New State Variable
```javascript
const [inferenceMetadata, setInferenceMetadata] = useState(null);
```
Tracks:
- Model name (UVH-26 or Fallback)
- Inference time in milliseconds
- Batch size (number of lanes processed)
- Detection source (Backend API or Fallback)

#### 3. Enhanced Telemetry Table Subtitle
The table now dynamically displays:
- Detection source and model name
- Inference latency
- Fallback status with notes

### Backend Changes

#### API Endpoint: `/vision/detect-batch`
**Location:** `app/routers/vision.py` (lines 101-207)

**Input:**
- `files`: MultipartForm upload of 1-4 lane images/videos
- `junction_id`: Target junction identifier
- `current_user`: JWT authenticated user

**Processing Pipeline:**
```
1. Read uploaded files → Convert to OpenCV images
2. Run UVH-26 YOLO model in batch mode
3. Extract vehicle class, confidence, bounding boxes
4. Map detections to lanes (Image 0→L1, Image 1→L2, etc.)
5. Calculate IRC:106-1990 PCE queue metrics
6. Save detections to database
7. Trigger signal optimization algorithm
8. Return comprehensive results
```

**Output Response:**
```json
{
  "junction_id": "J-001",
  "batch_size": 4,
  "queue_lengths": {
    "L1": {
      "vehicles": 22,
      "cars": 5,
      "bikes": 5,
      "autos": 12,
      "buses": 0,
      "trucks": 0,
      "pce": 24.7,
      "meters": 29.6,
      "mae": "0.9m"
    },
    // ... L2, L3, L4 similarly
  },
  "inference_time_ms": 156,
  "signal_optimization": { ... },
  "detections": [ ... ]
}
```

#### VisionService: UVH-26 Model Loading
**Location:** `app/services/vision_service.py` (lines 85-130)

**Model Resolution Order:**
1. ✅ **Workspace Path** (PREFERRED)
   - Path: `E:\Erakshak\UVH26_Project\weights\YOLOv11-S\UVH-26-MV-YOLOv11-S.pt`
   - Status: **AVAILABLE** ✓

2. 📁 **Local ML Models Directory**
   - Path: `backend/ml_models/uvh26/UVH-26-MV-YOLOv11-S.pt`
   - Status: Can be used if copied

3. 🌐 **HuggingFace Hub**
   - Repo: `iisc-aim/UVH-26`
   - File: `weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt`
   - Status: Downloads if needed

4. 🔄 **Fallback Models**
   - `yolo11n.pt` (standard YOLOv11 nano)
   - Mock mode (deterministic hash-based detection)

### Vehicle Classification

#### UVH-26 Class Mapping
Input classes from model → Standardized output:
```
"Hatchback", "Sedan", "SUV", "MUV", "Van"        → "car"
"Two-wheeler", "Bicycle"                          → "2-wheeler"
"Three-wheeler"                                   → "auto"
"Bus", "Mini-bus"                                 → "bus"
"Truck", "Tempo-traveller", "LCV"               → "truck"
```

#### IRC:106-1990 PCE (Passenger Car Equivalent)
```
Car:        1.00 PCE, 4.8m length
2-Wheeler:  0.35 PCE, 1.8m length
Auto:       0.60 PCE, 2.8m length
Bus:        2.50 PCE, 11.5m length
Truck:      3.00 PCE, 13.5m length
```

#### Effective Lanes Mapping
```
L1 (North):  2.0 lanes
L2 (South):  3.0 lanes
L3 (East):   2.5 lanes
L4 (West):   3.0 lanes
```

**Queue Length Calculation:**
```
Queue Meters = (Total PCE × 4.8) / Effective Lanes
```

## Testing & Verification

### Prerequisites
- ✅ UVH-26 model weights: `E:\Erakshak\UVH26_Project\weights\YOLOv11-S\UVH-26-MV-YOLOv11-S.pt`
- ✅ Backend running: `http://localhost:8000`
- ✅ Frontend dev server: `http://localhost:5173`

### Test Steps

1. **Navigate to Vision Sensing Page**
   - URL: `http://localhost:5173/vision`

2. **Upload 4-Lane CCTV Images**
   - Use sample images from traffic junctions
   - Can upload up to 4 images (one per lane)
   - Supports JPG, PNG formats

3. **Click "Analyze 4-Lane CCTV Feeds" Button**
   - Check browser console for logs: `[VisionPage] Starting UVH-26 vehicle detection...`
   - Wait for detection to complete

4. **Verify Results in Table**
   - Table subtitle shows: `Backend API Detection • UVH-26 (YOLOv11-S) • XXms inference`
   - Vehicle counts appear for each lane
   - Queue lengths calculated and displayed
   - Signal allocation times shown

5. **Check Backend Logs**
   - Should show: `[VISION SERVICE] Loaded UVH-26 model from workspace path:`
   - Inference time in milliseconds

### Browser Console Logs

**Expected Output (Success):**
```
[VisionPage] Starting UVH-26 vehicle detection...
[VisionPage] Adding Lane 1 file: image1.jpg
[VisionPage] Adding Lane 2 file: image2.jpg
[VisionPage] Adding Lane 3 file: image3.jpg
[VisionPage] Adding Lane 4 file: image4.jpg
[VisionPage] Sending detection request to /vision/detect-batch for junction: J-001
[VisionPage] ✅ UVH-26 Detection successful!
[VisionPage] Queue lengths: {L1: {...}, L2: {...}, L3: {...}, L4: {...}}
[VisionPage] Inference time: 156 ms
```

**If Backend Unavailable:**
```
[VisionPage] ❌ Backend API error: 503 Service Unavailable
[VisionPage] Falling back to dynamic feature detection...
```

## Architecture Diagram

```
Frontend (VisionPage.jsx)
    ↓
    └─→ Upload 4 CCTV images via FormData
        ↓
Backend API (/vision/detect-batch)
    ↓
    ├─→ Load UVH-26 model from workspace
    │   └─→ `E:\Erakshak\UVH26_Project\weights\YOLOv11-S\UVH-26-MV-YOLOv11-S.pt`
    ├─→ Run batch inference (4 images)
    ├─→ Extract vehicle detections
    ├─→ Classify & count by type
    ├─→ Calculate IRC:106 PCE queue lengths
    ├─→ Save to database
    ├─→ Trigger signal optimization
    └─→ Return results
        ↓
Frontend (VisionPage.jsx)
    ├─→ Display inference metadata
    ├─→ Populate telemetry table
    ├─→ Update signal state with timings
    └─→ Highlight active lane & vehicle counts
```

## Performance Metrics

- **Model Size:** ~25-30 MB (YOLOv11-S)
- **Typical Inference Time:** 150-300ms per image (on CPU)
- **GPU Support:** Auto-detects CUDA/MPS if available
- **Batch Processing:** Processes 4 lanes in parallel

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Backend offline | Falls back to frontend dynamic detection |
| Invalid image format | Returns 400 Bad Request with error message |
| Model not found | Uses mock detection mode |
| Database error | Logs error, still returns results |

## File Locations Summary

| Component | Path |
|-----------|------|
| Frontend Page | `E:\Erakshak\AdaptiveTraffic2\frontend\src\pages\VisionPage.jsx` |
| Backend Router | `E:\Erakshak\AdaptiveTraffic2\backend\app\routers\vision.py` |
| Vision Service | `E:\Erakshak\AdaptiveTraffic2\backend\app\services\vision_service.py` |
| UVH-26 Weights | `E:\Erakshak\UVH26_Project\weights\YOLOv11-S\UVH-26-MV-YOLOv11-S.pt` |
| Vehicle Detector Script | `E:\Erakshak\UVH26_Project\vehicle_detect.py` |

## Next Steps (Optional Enhancements)

- [ ] Add real-time video stream processing
- [ ] Implement ROI (Region of Interest) filtering
- [ ] Add vehicle tracking across frames
- [ ] Integrate BRT lane intrusion detection
- [ ] Add confidence threshold adjustment UI
- [ ] Implement batch result caching
- [ ] Add detection visualization overlay
- [ ] Support RTSP/MJPEG stream inputs

---

**Implementation Date:** August 14, 2026
**Model Version:** IISc UVH-26 YOLOv11-S
**Status:** ✅ Ready for Testing
