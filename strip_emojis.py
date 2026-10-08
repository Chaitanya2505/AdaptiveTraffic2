import re

filepath = "E:/Erakshak/AdaptiveTraffic2/frontend/src/pages/VisionPage.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace specific emojis and their spaces
content = content.replace("?? CARS", "CARS")
content = content.replace("?? 2-WHEELERS", "2-WHEELERS")
content = content.replace("?? AUTOS", "AUTOS")
content = content.replace("?? BUSES", "BUSES")
content = content.replace("?? TRUCKS", "TRUCKS")
content = content.replace("?? TOTAL COUNT (PCE)", "TOTAL COUNT (PCE)")
content = content.replace("?? ACCURATE QUEUE LENGTH", "ACCURATE QUEUE LENGTH")
content = content.replace("?? SIGNAL ALLOCATION", "SIGNAL ALLOCATION")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
