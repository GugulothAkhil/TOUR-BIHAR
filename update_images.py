import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Fallback images matched approximately by Category
FALLBACKS = {
    "Religious": "https://images.unsplash.com/photo-1549487222-28df529cecf1?auto=format&fit=crop&q=80&w=800",
    "Historical": "https://images.unsplash.com/photo-1555581977-1a0656fb33db?auto=format&fit=crop&q=80&w=800",
    "Museum / Cultural": "https://images.unsplash.com/photo-1518998053401-b537c35251c6?auto=format&fit=crop&q=80&w=800",
    "Parks / Gardens": "https://images.unsplash.com/photo-1588625699478-f71f65bb54eb?auto=format&fit=crop&q=80&w=800",
    "Wildlife / Nature": "https://images.unsplash.com/photo-1574870111867-089730e5a72b?auto=format&fit=crop&q=80&w=800",
    "Rivers / Lakes / Ghats": "https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&q=80&w=800",
    "Hills / Caves": "https://images.unsplash.com/photo-1506540605923-277a87ea7416?auto=format&fit=crop&q=80&w=800",
}
DEFAULT_FALLBACK = "https://images.unsplash.com/photo-1506461883276-594a12b11cb3?auto=format&fit=crop&q=80&w=800"

def get_wikimedia_image(place_name, district):
    query = f"{place_name} Bihar"
    url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrlimit=1&prop=pageimages&piprop=original|thumbnail&pithumbsize=800"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'TourByBiharBot/1.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            pages = data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                if 'thumbnail' in page_data:
                    return page_data['thumbnail']['source']
                if 'original' in page_data:
                    return page_data['original']['source']
    except Exception as e:
        pass
    return None

def process_place(place, category, district):
    if "image" not in place or not place["image"].startswith("http"):
        image_url = get_wikimedia_image(place["name"], district)
        if image_url:
            place["image"] = image_url
            print(f"[Wikipedia] Found image for {place['name']}")
        else:
            place["image"] = FALLBACKS.get(category, DEFAULT_FALLBACK)
            print(f"[Fallback] Used fallback for {place['name']}")
    return place

def main():
    print("Reading data.js...")
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()

    # The data is structured as variables. We need to split and parse exactly biharTourismData.
    # Luckily, biharTourismData is at the end.
    match = re.search(r"const biharTourismData \= (\{.*\})\;?$", content, re.DOTALL | re.MULTILINE)
    if not match:
        # If it doesn't end cleanly, try a more relaxed regex or finding the string start
        start_idx = content.find("const biharTourismData = {")
        if start_idx == -1:
            print("Could not find biharTourismData")
            return
        
        json_text = content[start_idx + 25:].strip()
        if json_text.endswith(";"):
            json_text = json_text[:-1]
    else:
        json_text = match.group(1)

    print("Parsing JSON data...")
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON: {e}")
        return

    tasks = []
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        for district, district_info in data.items():
            if "categorizedPlaces" in district_info:
                categories = district_info["categorizedPlaces"]
                for category, places in categories.items():
                    for place in places:
                        futures = executor.submit(process_place, place, category, district)
                        tasks.append(futures)

        print(f"Waiting for {len(tasks)} image fetches to complete...")
        for count, future in enumerate(as_completed(tasks), 1):
            future.result()
            if count % 100 == 0:
                print(f"Processed {count}/{len(tasks)}...")

    print("Writing back to data.js...")
    new_json_text = json.dumps(data, indent=2, ensure_ascii=False)
    
    # Reconstruct file
    start_idx = content.find("const biharTourismData = ")
    prefix = content[:start_idx]
    
    new_content = prefix + "const biharTourismData = " + new_json_text + ";\n"
    
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("Successfully updated data.js with real images!")

if __name__ == "__main__":
    main()
