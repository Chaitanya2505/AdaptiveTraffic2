import os

emojis_to_remove = ["🚗", "🏍", "🛺", "🚌", "🚚", "🟢", "🔴", "▶️", "⚠️", "🚨", "🔍", "🟡"]
directory = "/Users/atharvachoudhari/AdaptiveTraffic2/frontend/src/pages"

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".jsx"):
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()
            
            original = content
            for emoji in emojis_to_remove:
                # Replace emoji followed by space
                content = content.replace(emoji + " ", "")
                # Replace remaining emojis
                content = content.replace(emoji, "")
                
            if original != content:
                with open(filepath, "w") as f:
                    f.write(content)
                print(f"Removed emojis from {file}")
