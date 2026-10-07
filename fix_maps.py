import os

# 1. Update index.css
css_path = 'E:/Erakshak/AdaptiveTraffic2/frontend/src/index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

filter_css = """
/* Dark mode for OpenStreetMap */
.leaflet-layer,
.leaflet-control-zoom-in,
.leaflet-control-zoom-out,
.leaflet-control-attribution {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}
"""
if "filter: invert" not in css_content:
    with open(css_path, 'a', encoding='utf-8') as f:
        f.write(filter_css)

# 2. Update Map URLs
map_files = [
    'E:/Erakshak/AdaptiveTraffic2/frontend/src/components/dashboard/LiveMap.jsx',
    'E:/Erakshak/AdaptiveTraffic2/frontend/src/components/SuratJunctionMap.jsx',
    'E:/Erakshak/AdaptiveTraffic2/frontend/src/pages/AnalyticsPage.jsx',
    'E:/Erakshak/AdaptiveTraffic2/frontend/src/pages/JunctionDetailPage.jsx'
]

for filepath in map_files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace carto with OSM
        content = content.replace(
            'url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"',
            'url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"'
        )
        content = content.replace(
            'attribution=\'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>\'',
            'attribution=\'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors\''
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
