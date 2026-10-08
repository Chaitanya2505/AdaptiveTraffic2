import re

filepath = "E:/Erakshak/AdaptiveTraffic2/frontend/src/pages/VisionPage.jsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace specific emojis and their spaces
content = content.replace("?? Cars", "Cars")
content = content.replace("?? 2-Wheelers", "2-Wheelers")
content = content.replace("?? Autos", "Autos")
content = content.replace("?? Buses", "Buses")
content = content.replace("?? Trucks", "Trucks")
content = content.replace("?? Total Count (PCE)", "Total Count (PCE)")
content = content.replace("?? Accurate Queue Length", "Accurate Queue Length")
content = content.replace("?? Signal Allocation", "Signal Allocation")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
