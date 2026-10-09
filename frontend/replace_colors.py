import os

files = [
    'frontend/src/pages/JunctionDetailsPage.jsx',
    'frontend/src/pages/BrtsDetailsPage.jsx',
    'frontend/src/pages/AddNodePage.jsx',
    'frontend/src/pages/MonitorPage.jsx',
]

replacements = {
    'bg-slate-50 ': 'bg-transparent ',
    'bg-slate-50\"': 'bg-transparent\"',
    'text-slate-800': 'text-slate-100',
    'text-slate-900': 'text-white',
    'bg-slate-100': 'bg-slate-800',
    'border-slate-200': 'border-slate-700',
    'border-slate-300': 'border-slate-600',
    'text-slate-700': 'text-slate-300',
    'text-slate-600': 'text-slate-400',
    'bg-white': 'bg-slate-800',
    'text-gray-800': 'text-slate-100',
    'text-gray-900': 'text-white',
    'bg-blue-50': 'bg-blue-900/30',
    'bg-orange-50': 'bg-orange-900/30',
}

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for old, new in replacements.items():
            content = content.replace(old, new)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {filepath}')
