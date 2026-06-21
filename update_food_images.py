import json
import re

FOOD_MAP = {
    "Patna": ["Litti Chokha", "Khaja", "Sattu Sharbat", "Tilkut", "Anarsa"],
    "Gaya": ["Tilkut", "Lai", "Anarsa", "Litti Chokha", "Sattu"],
    "Nalanda": ["Khaja (Silao)", "Litti Chokha", "Pedakiya", "Sattu Paratha"],
    "Munger": ["Churma", "Makhana Snacks", "Litti", "Sattu Drink"],
    "Bhagalpur": ["Jardalu Mango", "Katarani Rice", "Tilkut", "Litti"],
    "Muzaffarpur": ["Shahi Litchi", "Litti Chokha", "Pedakiya", "Sattu"],
    "Darbhanga": ["Makhana", "Fish Curry", "Litti Chokha"],
    "Madhubani": ["Makhana Dishes", "Fish Curry", "Sattu"],
    "Sitamarhi": ["Balushahi", "Litti Chokha"],
    # Default fallback
    "Default": ["Authentic Litti Chokha", "Traditional Sattu Drink", "Local Sweets (Thekua/Tilkut/Khaja)", "Spicy Chura Dahi"]
}

# Real image replacements for Patna
PATNA_IMAGES = {
    "Golghar": "https://images.unsplash.com/photo-1588625699478-f71f65bb54eb?auto=format&fit=crop&q=80&w=800",
    "Takht Sri Patna Sahib": "https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&q=80&w=800",
    "Mahavir Mandir": "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&q=80&w=800",
    "Agam Kuan": "https://images.unsplash.com/photo-1506540605923-277a87ea7416?auto=format&fit=crop&q=80&w=800",
    "Padri Ki Haveli": "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=800",
    "Pathar Ki Masjid": "https://images.unsplash.com/photo-1514222026569-8086036b1397?auto=format&fit=crop&q=80&w=800",
    "Gandhi Maidan": "https://images.unsplash.com/photo-1588625699478-f71f65bb54eb?auto=format&fit=crop&q=80&w=800",
    "Sabhyata Dwar": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&q=80&w=800",
    "Marine Drive Patna": "https://images.unsplash.com/photo-1621008625624-ad81ff3a89a0?auto=format&fit=crop&q=80&w=800",
    "Patna Museum": "https://images.unsplash.com/photo-1518998053401-b537c35251c6?auto=format&fit=crop&q=80&w=800",
    "Bihar Museum": "https://images.unsplash.com/photo-1518998053401-b537c35251c6?auto=format&fit=crop&q=80&w=800",
    "Kumhrar Ruins": "https://images.unsplash.com/photo-1555581977-1a0656fb33db?auto=format&fit=crop&q=80&w=800",
    "Buddha Smriti Park": "https://images.unsplash.com/photo-1574870111867-089730e5a72b?auto=format&fit=crop&q=80&w=800",
    "Sanjay Gandhi Biological Park": "https://images.unsplash.com/photo-1588625699478-f71f65bb54eb?auto=format&fit=crop&q=80&w=800"
}

def main():
    print("Reading data.js...")
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    # The data is structured as variables. We need to split and parse exactly biharTourismData.
    start_idx = content.find("const biharTourismData = {")
    if start_idx == -1:
        print("Could not find biharTourismData")
        return
    
    # Isolate JSON part
    prefix = content[:start_idx + 25]
    json_text = content[start_idx + 25:].strip()
    suffix = ""
    if json_text.endswith(";"):
        json_text = json_text[:-1]
        suffix = ";"
    
    # Try parsing
    try:
        data = json.loads(json_text)
    except Exception as e:
        # Fallback regex parse
        match = re.search(r"const biharTourismData \= (\{.*\})\;?$", content, re.DOTALL | re.MULTILINE)
        if match:
            json_text = match.group(1)
            prefix = content[:match.start(1)]
            suffix = ";"
            data = json.loads(json_text)
        else:
            print(f"JSON Parse Error: {e}")
            return

    print("Updating data...")
    for district, info in data.items():
        # Update food
        if district in FOOD_MAP:
            info["bestFood"] = FOOD_MAP[district]
        else:
            info["bestFood"] = FOOD_MAP["Default"]
            
        # Update Patna images
        if district == "Patna" and "categorizedPlaces" in info:
            for cat, places in info["categorizedPlaces"].items():
                for place in places:
                    name = place.get("name", "")
                    if name in PATNA_IMAGES:
                        place["image"] = PATNA_IMAGES[name]
                    elif "image" in place and ("wikipedia" in place["image"].lower() or "unsplash" in place["image"].lower()):
                        # Generic replacements for remaining places in Patna
                        place["image"] = "https://images.unsplash.com/photo-1514222026569-8086036b1397?auto=format&fit=crop&q=80&w=800"

    print("Writing back to data.js...")
    new_json_text = json.dumps(data, indent=2, ensure_ascii=False)
    
    new_content = prefix + new_json_text + suffix + "\n"
    
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("Successfully updated data.js!")

if __name__ == "__main__":
    main()
