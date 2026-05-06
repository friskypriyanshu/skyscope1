"""
============================================================
 SkyScope — Backend (app.py)
 Flask server: serves the frontend + provides smart analysis,
 trip planning, route weather alerts and packing suggestions.
============================================================
"""

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import requests
import os
from datetime import datetime, timedelta
import math
import random

# ────────────────────────────────────────────────────────────
#  App setup — point Flask at our existing /static + /templates
# ────────────────────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates",
)
CORS(app)

# OpenWeatherMap key — replace with your own or set OWM_API_KEY env var.
API_KEY  = os.environ.get("OWM_API_KEY", "9d6eb6d3a3763e5ea98a5c431abac4ff")
OWM_BASE = "https://api.openweathermap.org/data/2.5"
OWM_GEO  = "https://api.openweathermap.org/geo/1.0"


# ────────────────────────────────────────────────────────────
#  Frontend routes
# ────────────────────────────────────────────────────────────
@app.route("/")
def home():
    """Serve the SkyScope SPA."""
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({"status": "SkyScope backend running ✅", "version": "2.0"})


# ────────────────────────────────────────────────────────────
#  Original smart-analysis endpoint
# ────────────────────────────────────────────────────────────
@app.route("/analyze-weather", methods=["POST"])
def analyze():
    """Activity score, car-wash advice, sunburn risk, clothing suggestion."""
    data = request.json or {}
    temp = data.get("temp", 25)
    wind = data.get("wind", 10)
    desc = (data.get("description") or "").lower()
    uv   = data.get("uv_index", 3)

    # --- activity score (0-10) --------------------------------
    score = 10
    if temp > 38 or temp < 0:
        score -= 5
    elif temp > 32 or temp < 8:
        score -= 2
    if wind > 30:
        score -= 2
    elif wind > 20:
        score -= 1
    if any(w in desc for w in ["rain", "storm", "thunder", "snow", "shower"]):
        score -= 4
    elif any(w in desc for w in ["haze", "mist", "fog", "smog"]):
        score -= 2
    if uv >= 8:
        score -= 2
    elif uv >= 6:
        score -= 1
    score = max(0, min(10, score))

    if score >= 8:
        activity_msg = "🏃 Great day for outdoor activities!"
    elif score >= 5:
        activity_msg = "🚶 Moderate conditions — plan accordingly."
    elif score >= 3:
        activity_msg = "😐 Not ideal, but manageable indoors."
    else:
        activity_msg = "🏠 Stay indoors. Conditions are rough."

    # --- car-wash advice --------------------------------------
    rain_kw = ["rain", "drizzle", "storm", "snow", "shower", "sleet"]
    if any(w in desc for w in rain_kw):
        car_wash, cw_color = "❌ Don't wash your car. Rain predicted!", "#ff5252"
    elif any(w in desc for w in ["haze", "dust", "smog", "sand"]):
        car_wash, cw_color = "⚠️ Dusty — wash but expect quick re-dust.", "#ffd600"
    else:
        car_wash, cw_color = "✅ Perfect day for a car wash!", "#69f0ae"

    # --- sunburn / UV -----------------------------------------
    if uv <= 0:
        sun_msg, uv_class = "☁️ No UV risk right now.", "low"
    elif uv <= 2:
        sun_msg, uv_class = f"🌥️ Low UV ({uv}). No SPF needed.", "low"
    elif uv <= 5:
        burn = round(200 / uv)
        sun_msg, uv_class = f"🕶️ Moderate UV ({uv}). Burn in ~{burn} min. Use SPF 30.", "moderate"
    elif uv <= 7:
        burn = round(200 / uv)
        sun_msg, uv_class = f"⚠️ High UV ({uv}). Burn in ~{burn} min. SPF 50+ advised.", "high"
    else:
        burn = round(200 / uv)
        sun_msg, uv_class = f"🚨 Very High UV ({uv})! Burn in ~{burn} min. Stay shaded.", "danger"

    # --- clothing ---------------------------------------------
    if temp <= 5:
        clothing = "🧥 Heavy jacket + gloves + scarf"
    elif temp <= 15:
        clothing = "🧣 Jacket + warm layers"
    elif temp <= 22:
        clothing = "👔 Light jacket or hoodie"
    elif temp <= 30:
        clothing = "👕 T-shirt weather, stay hydrated"
    elif temp <= 36:
        clothing = "🩳 Light breathable clothing + hat"
    else:
        clothing = "🌂 Minimal clothing + sun protection"

    return jsonify({
        "score":          score,
        "activity_msg":   activity_msg,
        "car_wash":       car_wash,
        "car_wash_color": cw_color,
        "sun_advice":     sun_msg,
        "uv_class":       uv_class,
        "clothing":       clothing,
        "uv_val":         uv,
        "bg_type":        "warm" if temp > 22 else "cold",
    })


# ────────────────────────────────────────────────────────────
#  Live weather passthroughs
# ────────────────────────────────────────────────────────────
@app.route("/weather")
def live_weather():
    lat, lon = request.args.get("lat"), request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "lat and lon required"}), 400
    try:
        r = requests.get(
            f"{OWM_BASE}/weather",
            params={"lat": lat, "lon": lon, "appid": API_KEY, "units": "metric"},
            timeout=8,
        )
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/forecast")
def live_forecast():
    lat, lon = request.args.get("lat"), request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "lat and lon required"}), 400
    try:
        r = requests.get(
            f"{OWM_BASE}/forecast",
            params={"lat": lat, "lon": lon, "appid": API_KEY, "units": "metric"},
            timeout=8,
        )
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ════════════════════════════════════════════════════════════
#  ✈️  TRAVELLER FEATURES  (the new stuff)
# ════════════════════════════════════════════════════════════

# Approximate lat/lon for popular Indian + global destinations.
# Used as a fallback when a user types a city we don't have geocoding for.
CITY_DB = {
    # Indian states/UTs
    "delhi":               (28.61, 77.20), "mumbai":              (19.07, 72.87),
    "bangalore":           (12.97, 77.59), "bengaluru":           (12.97, 77.59),
    "chennai":             (13.08, 80.27), "kolkata":             (22.57, 88.36),
    "hyderabad":           (17.38, 78.48), "pune":                (18.52, 73.85),
    "ahmedabad":           (23.02, 72.57), "jaipur":              (26.91, 75.78),
    "lucknow":             (26.84, 80.94), "kanpur":              (26.44, 80.33),
    "nagpur":              (21.14, 79.08), "indore":              (22.71, 75.85),
    "bhopal":              (23.25, 77.41), "patna":               (25.59, 85.13),
    "ludhiana":            (30.90, 75.85), "agra":                (27.17, 78.00),
    "varanasi":            (25.31, 82.97), "amritsar":            (31.63, 74.87),
    "chandigarh":          (30.73, 76.77), "shimla":              (31.10, 77.17),
    "manali":              (32.24, 77.18), "leh":                 (34.15, 77.57),
    "srinagar":            (34.08, 74.79), "dehradun":            (30.31, 78.03),
    "rishikesh":           (30.08, 78.27), "haridwar":            (29.94, 78.16),
    "ghaziabad":           (28.66, 77.45), "noida":               (28.53, 77.39),
    "gurgaon":             (28.45, 77.02), "gurugram":            (28.45, 77.02),
    "goa":                 (15.29, 74.12), "panaji":              (15.49, 73.82),
    "udaipur":             (24.58, 73.68), "jodhpur":             (26.23, 73.02),
    "jaisalmer":           (26.91, 70.91), "mount abu":           (24.59, 72.71),
    "kochi":               (9.93, 76.26),  "thiruvananthapuram":  (8.52, 76.93),
    "munnar":              (10.08, 77.06), "ooty":                (11.41, 76.69),
    "darjeeling":          (27.04, 88.26), "gangtok":             (27.33, 88.61),
    "guwahati":            (26.14, 91.73), "shillong":            (25.57, 91.88),
    "puri":                (19.81, 85.83), "bhubaneswar":         (20.30, 85.82),
    "vizag":               (17.69, 83.21), "visakhapatnam":       (17.69, 83.21),
    "mysore":              (12.30, 76.64), "mysuru":              (12.30, 76.64),
    "coorg":               (12.42, 75.74), "madikeri":            (12.42, 75.74),
    "pondicherry":         (11.94, 79.80), "puducherry":          (11.94, 79.80),
    # globals
    "london":              (51.51, -0.13), "new york":            (40.71, -74.01),
    "tokyo":               (35.68, 139.65),"dubai":               (25.20, 55.27),
    "singapore":           (1.35, 103.82), "paris":               (48.86, 2.35),
    "sydney":              (-33.87, 151.21),"bangkok":            (13.76, 100.50),
    "moscow":              (55.76, 37.62), "new zealand":         (-40.90, 174.89),
}


def geocode(city: str):
    """Return (lat, lon) for a city — try OWM geocoder, fall back to local DB."""
    if not city:
        return None
    key = city.strip().lower()
    if key in CITY_DB:
        return CITY_DB[key]
    try:
        r = requests.get(
            f"{OWM_GEO}/direct",
            params={"q": city, "limit": 1, "appid": API_KEY},
            timeout=6,
        ).json()
        if r and isinstance(r, list):
            return (r[0]["lat"], r[0]["lon"])
    except Exception:
        pass
    return None


def haversine_km(a, b):
    """Great-circle distance between two (lat, lon) points, in km."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def interpolate_points(start, end, n):
    """Generate n evenly spaced (lat, lon) waypoints between start and end."""
    points = []
    for i in range(n):
        t = i / max(1, n - 1)
        lat = start[0] + (end[0] - start[0]) * t
        lon = start[1] + (end[1] - start[1]) * t
        points.append((round(lat, 4), round(lon, 4)))
    return points


def fetch_forecast_at(lat, lon):
    """Fetch a 5-day / 3-hour forecast block from OWM, or return None on error."""
    try:
        r = requests.get(
            f"{OWM_BASE}/forecast",
            params={"lat": lat, "lon": lon, "appid": API_KEY, "units": "metric"},
            timeout=8,
        ).json()
        if r.get("cod") and str(r["cod"]) != "200":
            return None
        return r
    except Exception:
        return None


def fake_forecast(lat, lon, seed_offset=0):
    """
    Deterministic demo forecast used when the live API is unavailable
    (no internet / invalid key). Same lat/lon → same data, so trips are
    reproducible offline.
    """
    rng = random.Random(int(abs(lat * 1000) + abs(lon * 1000)) + seed_offset)

    # base temp by latitude (rough): warmer near equator
    base_temp = 32 - abs(lat) * 0.45
    base_temp += rng.uniform(-3, 3)

    # rain probability: higher near coasts / monsoon belt (10-25 N in India in summer)
    rain_chance = 0.25
    if 8 <= lat <= 26 and 70 <= lon <= 90:
        rain_chance = 0.55
    if lat > 30:
        rain_chance = 0.20

    weather_pool = []
    for _ in range(40):
        if rng.random() < rain_chance:
            weather_pool.append(("Rain", "light rain", "10d"))
        elif rng.random() < 0.3:
            weather_pool.append(("Clouds", "scattered clouds", "03d"))
        else:
            weather_pool.append(("Clear", "clear sky", "01d"))

    list_data = []
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    for i in range(40):  # 5 days × 8 slots
        dt = now + timedelta(hours=3 * i)
        main, desc, icon = weather_pool[i]
        temp = base_temp + math.sin(i / 4) * 4 + rng.uniform(-1.5, 1.5)
        list_data.append({
            "dt": int(dt.timestamp()),
            "dt_txt": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "main": {
                "temp": round(temp, 1),
                "feels_like": round(temp + 2, 1),
                "humidity": rng.randint(40, 90),
                "pressure": rng.randint(995, 1015),
            },
            "weather": [{"main": main, "description": desc, "icon": icon}],
            "wind": {"speed": round(rng.uniform(2, 8), 1)},
            "rain": {"3h": round(rng.uniform(0.5, 6), 1)} if main == "Rain" else {},
        })
    return {"list": list_data, "city": {"name": "Demo", "coord": {"lat": lat, "lon": lon}}}


def summarize_forecast(forecast, target_date=None):
    """
    Reduce a 3-hour-block forecast to one daily summary.
    If target_date (YYYY-MM-DD) given, use slots for that date; else use the
    earliest day available.
    """
    if not forecast or "list" not in forecast:
        return None

    by_day = {}
    for slot in forecast["list"]:
        date_key = slot["dt_txt"][:10]
        by_day.setdefault(date_key, []).append(slot)

    if target_date and target_date in by_day:
        slots = by_day[target_date]
    else:
        # earliest day
        first_day = sorted(by_day.keys())[0]
        slots = by_day[first_day]
        target_date = first_day

    if not slots:
        return None

    temps = [s["main"]["temp"] for s in slots]
    descs = [s["weather"][0]["description"] for s in slots]
    mains = [s["weather"][0]["main"] for s in slots]
    rain_amounts = [s.get("rain", {}).get("3h", 0) for s in slots]
    winds = [s.get("wind", {}).get("speed", 0) * 3.6 for s in slots]  # m/s → km/h

    has_rain = any(m in ("Rain", "Drizzle", "Thunderstorm") for m in mains)
    has_thunder = any(m == "Thunderstorm" for m in mains)
    has_snow = any(m == "Snow" for m in mains)

    # pick midday-ish slot for icon
    icon_slot = slots[len(slots) // 2]

    return {
        "date":         target_date,
        "temp_min":     round(min(temps)),
        "temp_max":     round(max(temps)),
        "temp_avg":     round(sum(temps) / len(temps)),
        "humidity":     round(sum(s["main"]["humidity"] for s in slots) / len(slots)),
        "wind_kmh":     round(max(winds)),
        "rain_mm":      round(sum(rain_amounts), 1),
        "has_rain":     has_rain,
        "has_thunder":  has_thunder,
        "has_snow":     has_snow,
        "main":         icon_slot["weather"][0]["main"],
        "description":  icon_slot["weather"][0]["description"].title(),
        "icon":         icon_slot["weather"][0]["icon"],
    }


def build_packing_list(summary, traveller_type, days):
    """
    Build a category-grouped packing checklist based on weather + traveller type.
    `summary` comes from summarize_forecast().
    """
    if not summary:
        return []

    avg = summary["temp_avg"]
    items = {"Essentials": [], "Clothing": [], "Weather Gear": [], "For Your Trip": []}

    # ── Essentials (always) ────────────────────────────────────────
    items["Essentials"].extend([
        ("🪪", "Government ID / Aadhaar"),
        ("💳", "Wallet, cards, some cash"),
        ("📱", "Phone + charger + power bank"),
        ("💊", "Personal medication & first-aid kit"),
        ("🧴", "Toiletries & sanitizer"),
        ("🍫", "Snacks & water bottle"),
    ])

    # ── Clothing (temperature based) ──────────────────────────────
    if avg <= 5:
        items["Clothing"].extend([
            ("🧥", "Heavy down jacket"),
            ("🧣", "Wool scarf, beanie & insulated gloves"),
            ("🧦", "Thermal innerwear + wool socks"),
            ("🥾", "Warm waterproof boots"),
        ])
    elif avg <= 15:
        items["Clothing"].extend([
            ("🧥", "Warm jacket / fleece"),
            ("👖", "Full-sleeve tops & long pants"),
            ("🧦", "Closed shoes + warm socks"),
        ])
    elif avg <= 22:
        items["Clothing"].extend([
            ("👔", "Light jacket or hoodie for evenings"),
            ("👕", "Mix of t-shirts and full-sleeves"),
            ("👟", "Comfortable walking shoes"),
        ])
    elif avg <= 30:
        items["Clothing"].extend([
            ("👕", "Cotton t-shirts (one per day)"),
            ("🩳", "Shorts / light trousers"),
            ("👟", "Breathable shoes / sandals"),
        ])
    else:  # > 30 °C
        items["Clothing"].extend([
            ("👕", "Loose, light cotton clothes"),
            ("🩳", "Shorts & breathable trousers"),
            ("🧢", "Cap or wide-brim hat"),
            ("🕶️", "UV sunglasses"),
            ("🧴", "SPF 50+ sunscreen"),
        ])

    # ── Weather Gear (rain / snow / wind / heat) ───────────────────
    if summary["has_rain"]:
        items["Weather Gear"].extend([
            ("☂️", "Compact umbrella"),
            ("🧥", "Waterproof raincoat / poncho"),
            ("👟", "Quick-dry shoes or extra socks"),
            ("🛍️", "Waterproof bag cover for backpack"),
            ("📱", "Ziplock pouch for phone & documents"),
        ])
    if summary["has_thunder"]:
        items["Weather Gear"].append(
            ("⚡", "Avoid open areas during storms — plan indoor stops"))
    if summary["has_snow"]:
        items["Weather Gear"].extend([
            ("❄️", "Snow boots with good grip"),
            ("🧤", "Waterproof gloves"),
            ("🥽", "Snow goggles (if heading higher)"),
        ])
    if summary["wind_kmh"] >= 25:
        items["Weather Gear"].append(("💨", "Windbreaker jacket"))
    if avg >= 32:
        items["Weather Gear"].append(("💧", "Extra water + electrolyte sachets (ORS)"))

    # ── Traveller-type specific ───────────────────────────────────
    t = (traveller_type or "general").lower()

    if t in ("bike", "biker", "motorcycle"):
        items["For Your Trip"].extend([
            ("🪖", "ISI-marked full-face helmet"),
            ("🧤", "Riding gloves with knuckle protection"),
            ("🧥", "Riding jacket with armour"),
            ("👖", "Riding pants / knee guards"),
            ("👢", "Ankle-high riding boots"),
            ("🔧", "Basic toolkit + tyre puncture kit"),
            ("🪫", "Phone mount + USB charger on bike"),
            ("📄", "RC, DL, PUC & insurance — keep copies"),
        ])
        if summary["has_rain"]:
            items["For Your Trip"].extend([
                ("🌧️", "Two-piece rain suit (top + pants)"),
                ("🥽", "Anti-fog visor / pinlock"),
                ("⚠️", "Slow down on wet roads — avoid painted lines"),
            ])
    elif t in ("car", "driver", "road trip"):
        items["For Your Trip"].extend([
            ("📄", "RC, DL, PUC & insurance papers"),
            ("⛑️", "Spare tyre, jack & basic tools"),
            ("🪫", "Car phone mount + charger"),
            ("🎵", "Road-trip playlist downloaded"),
            ("🧊", "Cooler / water for the car"),
            ("🗺️", "Offline maps (low-network areas)"),
        ])
    elif t in ("hike", "hiker", "trek", "trekker"):
        items["For Your Trip"].extend([
            ("🎒", "55-65 L trekking backpack"),
            ("🥾", "Broken-in trekking shoes with grip"),
            ("🦯", "Trekking poles"),
            ("🔦", "Headlamp + spare batteries"),
            ("🧭", "Offline map & compass"),
            ("🥫", "High-energy snacks (nuts, bars, chocolate)"),
            ("🩹", "Blister plasters + antiseptic"),
        ])
        if avg < 10:
            items["For Your Trip"].append(("⛺", "4-season tent / sleeping bag rated for cold"))
    elif t in ("family", "kids"):
        items["For Your Trip"].extend([
            ("🧸", "Kids' favourite toy or comfort item"),
            ("📚", "Activity / colouring books for the journey"),
            ("🍪", "Plenty of kid-friendly snacks"),
            ("👶", "Wet wipes & extra clothes for kids"),
            ("💊", "Child-specific medication & ORS"),
        ])
    elif t in ("backpacker", "solo"):
        items["For Your Trip"].extend([
            ("🎒", "Lightweight 40 L backpack"),
            ("🔒", "TSA padlock for hostels"),
            ("🪪", "Photocopies of ID stored separately"),
            ("📓", "Travel journal / pen"),
        ])
    elif t in ("business",):
        items["For Your Trip"].extend([
            ("👔", "Formal outfit (one per meeting day)"),
            ("💻", "Laptop + charger + adapter"),
            ("📁", "Documents folder / business cards"),
        ])
    else:  # general tourist
        items["For Your Trip"].extend([
            ("📷", "Camera or phone with enough storage"),
            ("🎒", "Day bag for sightseeing"),
            ("🗺️", "Offline maps of the city"),
        ])

    if days >= 4:
        items["For Your Trip"].append(("🧺", f"Laundry bag ({days}-day trip)"))

    # convert to list of {category, items: [...]}
    out = []
    for cat, lst in items.items():
        if not lst:
            continue
        out.append({
            "category": cat,
            "items":    [{"emoji": e, "text": t} for e, t in lst],
        })
    return out


def build_alerts(summary, traveller_type, route_alerts):
    """Plain-English headline alerts for the user."""
    alerts = []
    t = (traveller_type or "general").lower()

    # destination-level alerts
    if summary["has_thunder"]:
        alerts.append({
            "level": "danger",
            "icon":  "⛈️",
            "title": "Thunderstorm warning",
            "msg":   "Lightning expected at your destination. Avoid open areas, "
                     "metal structures and water bodies. Indoor activities recommended.",
        })
    elif summary["has_rain"]:
        if t in ("bike", "biker", "motorcycle"):
            alerts.append({
                "level": "warning",
                "icon":  "🌧️",
                "title": "Rain expected — ride carefully",
                "msg":   "Carry a rain suit and waterproof your luggage. "
                         "Slow down on wet roads, increase following distance, "
                         "and avoid riding through flooded patches.",
            })
        elif t in ("hike", "hiker", "trek", "trekker"):
            alerts.append({
                "level": "warning",
                "icon":  "🌧️",
                "title": "Wet trail conditions",
                "msg":   "Trails may be slippery. Carry a poncho, waterproof your "
                         "gear and watch out for landslides on hill routes.",
            })
        else:
            alerts.append({
                "level": "warning",
                "icon":  "☂️",
                "title": "Carry an umbrella",
                "msg":   f"Rain is expected (~{summary['rain_mm']} mm). "
                         "Pack an umbrella or raincoat and waterproof your bag.",
            })

    if summary["has_snow"]:
        alerts.append({
            "level": "warning",
            "icon":  "❄️",
            "title": "Snowfall expected",
            "msg":   "Roads may close. Carry chains for tyres if driving, "
                     "warm waterproof boots and layered insulation.",
        })

    if summary["temp_max"] >= 40:
        alerts.append({
            "level": "danger",
            "icon":  "🔥",
            "title": "Extreme heat",
            "msg":   f"Highs of {summary['temp_max']}°C. Hydrate constantly, "
                     "avoid 11 AM – 4 PM outdoors, wear loose light cotton.",
        })
    elif summary["temp_max"] >= 35:
        alerts.append({
            "level": "info",
            "icon":  "🌡️",
            "title": "Hot day ahead",
            "msg":   f"Expect {summary['temp_max']}°C. Keep water handy and "
                     "use sunscreen.",
        })

    if summary["temp_min"] <= 0:
        alerts.append({
            "level": "warning",
            "icon":  "🥶",
            "title": "Sub-zero temperatures",
            "msg":   f"Lows of {summary['temp_min']}°C — black ice possible at dawn. "
                     "Layer up properly.",
        })

    if summary["wind_kmh"] >= 35:
        alerts.append({
            "level": "warning",
            "icon":  "💨",
            "title": "Strong winds",
            "msg":   f"Gusts up to {summary['wind_kmh']} km/h. "
                     "Bikers — be cautious on highways and bridges.",
        })

    # add per-route alerts (already built)
    alerts.extend(route_alerts)

    return alerts


# ────────────────────────────────────────────────────────────
#  /plan-trip  →  the headline traveller endpoint
# ────────────────────────────────────────────────────────────
@app.route("/plan-trip", methods=["POST"])
def plan_trip():
    """
    Body JSON:
      {
        "origin": "Delhi",            # optional
        "destination": "Manali",
        "travel_date": "2025-07-15",  # YYYY-MM-DD, optional
        "duration_days": 3,           # optional, default 1
        "traveller_type": "bike",     # bike | car | hike | family | backpacker | business | general
        "use_demo": false             # if true, skip live API and use demo data
      }
    """
    data = request.json or {}
    destination     = (data.get("destination") or "").strip()
    origin          = (data.get("origin") or "").strip()
    travel_date     = data.get("travel_date")
    duration        = max(1, min(int(data.get("duration_days") or 1), 14))
    traveller_type  = (data.get("traveller_type") or "general").lower()
    use_demo        = bool(data.get("use_demo"))

    if not destination:
        return jsonify({"error": "destination is required"}), 400

    dest_coords = geocode(destination)
    if not dest_coords:
        return jsonify({"error": f"Could not find location: {destination}"}), 404

    # ── destination forecast ─────────────────────────────────
    forecast = None if use_demo else fetch_forecast_at(*dest_coords)
    used_demo = forecast is None
    if used_demo:
        forecast = fake_forecast(*dest_coords)

    # daily summaries for `duration` days
    by_day = {}
    for slot in forecast["list"]:
        by_day.setdefault(slot["dt_txt"][:10], []).append(slot)

    sorted_days = sorted(by_day.keys())
    if travel_date and travel_date in by_day:
        start_idx = sorted_days.index(travel_date)
    else:
        start_idx = 0

    daily_summaries = []
    for i in range(duration):
        if start_idx + i >= len(sorted_days):
            break
        d = sorted_days[start_idx + i]
        s = summarize_forecast({"list": by_day[d]}, target_date=d)
        if s:
            daily_summaries.append(s)

    if not daily_summaries:
        return jsonify({"error": "No forecast data available"}), 500

    # use day 1 as the "primary" summary for packing + alerts
    primary = daily_summaries[0]

    # ── route alerts (only if origin provided) ────────────────
    route_alerts = []
    route_points = []
    if origin:
        origin_coords = geocode(origin)
        if origin_coords:
            distance_km = round(haversine_km(origin_coords, dest_coords))
            n_waypoints = min(6, max(2, distance_km // 100))
            waypoints = interpolate_points(origin_coords, dest_coords, n_waypoints)

            for idx, wp in enumerate(waypoints):
                wp_fc = None if use_demo else fetch_forecast_at(*wp)
                if wp_fc is None:
                    wp_fc = fake_forecast(*wp, seed_offset=idx)
                wp_summary = summarize_forecast(wp_fc, target_date=primary["date"])
                if not wp_summary:
                    continue

                segment_km = round(distance_km * (idx / max(1, n_waypoints - 1)))
                route_points.append({
                    "lat":         wp[0],
                    "lon":         wp[1],
                    "distance_km": segment_km,
                    "summary":     wp_summary,
                })

                # generate alerts only for points along the way (skip origin & dest)
                if 0 < idx < len(waypoints) - 1:
                    if wp_summary["has_thunder"]:
                        route_alerts.append({
                            "level": "danger",
                            "icon":  "⛈️",
                            "title": f"Thunderstorm ~{segment_km} km ahead",
                            "msg":   ("Lightning activity reported near "
                                      f"({wp[0]}, {wp[1]}). "
                                      "Stop and take shelter — do not ride/drive through it."),
                        })
                    elif wp_summary["has_rain"]:
                        if traveller_type in ("bike", "biker", "motorcycle"):
                            route_alerts.append({
                                "level": "warning",
                                "icon":  "🌧️",
                                "title": f"Rain ~{segment_km} km ahead",
                                "msg":   (f"Heads up — rain reported about {segment_km} km ahead on your route. "
                                          "Plan a stop at the next fuel station or roadside cafe if needed. "
                                          "Put on your rain suit and keep your visor clean."),
                            })
                        else:
                            route_alerts.append({
                                "level": "warning",
                                "icon":  "🌧️",
                                "title": f"Rain ~{segment_km} km ahead",
                                "msg":   ("Wet patch on the route. Drive slow, "
                                          "switch on headlights and keep wipers ready."),
                            })
                    if wp_summary["wind_kmh"] >= 35:
                        route_alerts.append({
                            "level": "info",
                            "icon":  "💨",
                            "title": f"Strong crosswinds ~{segment_km} km ahead",
                            "msg":   f"Gusts up to {wp_summary['wind_kmh']} km/h. "
                                     "Grip the handlebar firmly and keep speed moderate.",
                        })

    # ── packing list ─────────────────────────────────────────
    packing = build_packing_list(primary, traveller_type, duration)

    # ── final alerts (destination + route) ────────────────────
    alerts = build_alerts(primary, traveller_type, route_alerts)

    return jsonify({
        "destination":    destination.title(),
        "origin":         origin.title() if origin else None,
        "dest_coords":    {"lat": dest_coords[0], "lon": dest_coords[1]},
        "travel_date":    primary["date"],
        "duration_days":  duration,
        "traveller_type": traveller_type,
        "used_demo":      used_demo,
        "primary":        primary,
        "daily":          daily_summaries,
        "route":          route_points,
        "alerts":         alerts,
        "packing":        packing,
    })


# ────────────────────────────────────────────────────────────
#  Run
# ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🌤️  SkyScope server starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
