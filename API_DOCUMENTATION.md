# E-Rakshak Traffic Management API Documentation

This documentation provides an overview of the REST API endpoints available in the backend of the AdaptiveTraffic2 project.

---

## 1. System Operations
Endpoints for general system health and status.

- **`GET /`**
  - **Summary**: Health check and system status.

---

## 2. Authentication
Endpoints for user registration, login, and profile retrieval.

- **`POST /auth/register`**
  - **Summary**: Register a new user.
- **`POST /auth/login`**
  - **Summary**: Login and retrieve an access token.
- **`POST /auth/login-swagger`**
  - **Summary**: Login via Swagger UI (Form data).
- **`GET /auth/me`**
  - **Summary**: Retrieve current logged-in user profile.

---

## 3. Junctions
Endpoints for managing traffic junctions and their current status.

- **`GET /junctions`**
  - **Summary**: Get all junctions.
- **`GET /junctions/{id}`**
  - **Summary**: Get specific junction details by ID.
- **`POST /junctions`**
  - **Summary**: Create or update a junction.
- **`GET /junctions/{id}/status`**
  - **Summary**: Retrieve current operational status of a specific junction.

---

## 4. Computer Vision
Endpoints for vehicle detection, tracking, and intrusion detection using YOLO models.

- **`POST /vision/detect`**
  - **Summary**: Detect vehicles in a single image.
- **`POST /vision/detect-batch`**
  - **Summary**: Detect vehicles across a batch of images.
- **`GET /vision/model-info`**
  - **Summary**: Get current ML model configurations and info.
- **`POST /vision/track`**
  - **Summary**: Perform multi-object tracking over a sequence of images/video.
- **`POST /vision/detect-brt-intrusion`**
  - **Summary**: Identify BRTS lane intrusion events via image input.

---

## 5. Signal Control
Endpoints for traffic signal optimization based on congestion.

- **`POST /signals/optimize`**
  - **Summary**: Run traffic optimization algorithms and calculate new signal timings.
- **`POST /signals/{junction_id}/apply`**
  - **Summary**: Apply newly optimized signal timings to a specific junction.
- **`GET /signals/{junction_id}/history`**
  - **Summary**: Retrieve historical signal timings for a junction.

---

## 6. Violations
Endpoints for viewing and acknowledging traffic violations.

- **`GET /violations`**
  - **Summary**: Retrieve a list of all logged violations.
- **`GET /violations/{id}`**
  - **Summary**: Retrieve specific violation details by ID.
- **`POST /violations/{id}/ack`**
  - **Summary**: Acknowledge a specific violation.

---

## 7. Simulation
Endpoints integrating with the SUMO traffic simulator for modeling.

- **`GET /simulation/geometry`**
  - **Summary**: Get network geometry data.
- **`GET /simulation/state`**
  - **Summary**: Retrieve current state of the simulation.
- **`GET /simulation/analytics`**
  - **Summary**: Retrieve analytics computed from the simulation.
- **`GET /simulation/history`**
  - **Summary**: Get historical simulation data.
- **`GET /simulation/export/csv`**
  - **Summary**: Export simulation data to CSV format.
- **`GET /simulation/export/json`**
  - **Summary**: Export simulation data to JSON format.
- **`GET /simulation/export/report`**
  - **Summary**: Export comprehensive simulation report.
- **`GET /simulation/export/pdf`**
  - **Summary**: Export simulation report in PDF format.
- **`POST /simulation/run-5min`**
  - **Summary**: Run the simulation forward by 5 minutes.
- **`POST /simulation/reset`**
  - **Summary**: Reset the simulation state.

---

## 8. Analytics
Endpoints for system-wide analytics, heatmaps, and predictions.

- **`GET /analytics/heatmap`**
  - **Summary**: Generate traffic congestion heatmap data.
- **`GET /analytics/predict`**
  - **Summary**: Run predictive traffic models for future congestion.

---

## 9. BRTS Dedicated Lane Guard
Endpoints related to the BRTS system, lane guard functionalities, ANPR, and challan (ticket) generation.

- **`GET /api/health/brts`**
  - **Summary**: Health check for the BRTS lane guard system.
- **`GET /api/stream/feed/{junction_id}`**
  - **Summary**: Access live camera stream feed for a BRTS junction.
- **`POST /api/stream/mode`**
  - **Summary**: Change stream monitoring mode.
- **`POST /api/stream/roi`**
  - **Summary**: Set or update Region of Interest (ROI) for camera streams.
- **`GET /api/stream/roi/{junction_id}`**
  - **Summary**: Retrieve current Region of Interest (ROI) for a junction.
- **`GET /api/challan/view/{violation_id}`**
  - **Summary**: HTML view for an e-challan ticket.
- **`GET /api/gis/corridors`**
  - **Summary**: Retrieve GIS data for BRTS corridors.
- **`POST /api/video/upload`**
  - **Summary**: Upload a video file for analysis.
- **`POST /api/image/analyze`**
  - **Summary**: Run ANPR analysis on a specific image.
- **`GET /api/stream/uploaded/{file_id}`**
  - **Summary**: Retrieve details/feed of an uploaded video.
- **`GET /api/violations/brts`**
  - **Summary**: Retrieve BRTS-specific violations.
- **`POST /api/violations/clear`**
  - **Summary**: Clear BRTS violations from logs.
- **`GET /api/whitelist`**
  - **Summary**: Retrieve the list of whitelisted vehicle plates (e.g. buses, emergency vehicles).
- **`POST /api/whitelist`**
  - **Summary**: Add a new license plate to the whitelist.
- **`DELETE /api/whitelist/{plate_number}`**
  - **Summary**: Remove a specific license plate from the whitelist.
- **`GET /api/stats/brts`**
  - **Summary**: Retrieve BRTS-specific analytics and statistics.
- **`POST /api/simulate/inject`**
  - **Summary**: Inject test data for simulation of a BRTS violation.
- **`POST /api/challan/send`**
  - **Summary**: Send/dispatch an e-challan to a violator.
- **`GET /api/evidence/{file_name}`**
  - **Summary**: Retrieve evidence file (image/video) associated with a violation.
