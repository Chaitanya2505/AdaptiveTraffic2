from fastapi import APIRouter
import httpx
from datetime import datetime
import json

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("")
async def get_alerts():
    alerts = []
    
    # 1. Traffic Congestion Alert (Simulated internal event)
    alerts.append({
        "id": "alert_1",
        "type": "congestion",
        "severity": "critical",
        "title": "Severe Traffic Jam",
        "message": "Heavy congestion detected at J-001 SVNIT Junction.",
        "junction_id": "J-001",
        "time": "Just now"
    })
    
    # Fetch real data
    async with httpx.AsyncClient() as client:
        try:
            # 2. Weather API (Open-Meteo for Surat)
            weather_res = await client.get('https://api.open-meteo.com/v1/forecast?latitude=21.1702&longitude=72.8311&current_weather=true')
            if weather_res.status_code == 200:
                data = weather_res.json()
                current = data.get("current_weather", {})
                temp = current.get("temperature", 0)
                code = current.get("weathercode", 0)
                wind = current.get("windspeed", 0)
                
                # Simple weather code logic
                condition = "Clear/Sunny"
                severity = "info"
                message = f"Current temperature is {temp}°C with {wind} km/h winds. Weather is currently stable."
                
                if code in [51, 53, 55, 61, 63, 65, 80, 81, 82]:
                    condition = "Rainy"
                    severity = "warning"
                    message = f"Rain expected. Roads may be slippery in Surat. Temp: {temp}°C."
                elif code in [71, 73, 75, 77, 85, 86]:
                    condition = "Snow"
                    severity = "critical"
                    message = f"Snow alert! Avoid unnecessary travel. Temp: {temp}°C."
                elif code in [45, 48]:
                    condition = "Foggy"
                    severity = "warning"
                    message = f"Low visibility due to fog in Surat. Drive carefully. Temp: {temp}°C."
                elif code in [95, 96, 99]:
                    condition = "Thunderstorm"
                    severity = "critical"
                    message = f"Heavy thunderstorm approaching Surat. Secure outdoor equipment! Temp: {temp}°C."

                alerts.append({
                    "id": "alert_2",
                    "type": "weather",
                    "severity": severity,
                    "title": f"Weather Update: {condition}",
                    "message": message,
                    "time": "Live"
                })
        except Exception as e:
            print(f"Weather API error: {e}")
            
        try:
            current_time = datetime.now()
            
            # Let's say Navratri starts Oct 10, Dussehra is Oct 19, 2026.
            navratri_date = datetime(2026, 10, 10)
            dussehra_date = datetime(2026, 10, 19)
            
            days_to_navratri = (navratri_date - current_time).days
            days_to_dussehra = (dussehra_date - current_time).days
            
            msg = ""
            if days_to_navratri >= 0:
                msg += f"Navratri in {days_to_navratri} day{'s' if days_to_navratri != 1 else ''}. "
            if days_to_dussehra >= 0:
                msg += f"Dussehra in {days_to_dussehra} day{'s' if days_to_dussehra != 1 else ''}. "
                
            msg += "Expect high traffic during these days! A long weekend is also approaching, so highway traffic may surge."
            
            alerts.append({
                "id": "alert_3",
                "type": "festival",
                "severity": "info",
                "title": "Festival & Long Weekend Alert",
                "message": msg,
                "time": "Live API"
            })
        except Exception as e:
            print(f"Time API error: {e}")

    return {
        "status": "ok",
        "alerts": alerts
    }
