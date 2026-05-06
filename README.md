# ☁️ SkyScope — India Weather & Travel Planner

A beautiful, glass-themed weather app for India with **smart trip planning** —
get destination forecasts, weather alerts along your route, and personalised
packing lists tailored to **how** you're travelling (bike, car, trek, family,
backpacker, business, or general tourist).

> **What's new in v2.0**
> - 🧳 **Trip Planner** — destination + route weather + packing list
> - 🏍️ **Smart route alerts** for bike riders ("Rain ~135 km ahead — plan a stop")
> - 🎒 **Persistent packing checklist** that remembers what you've packed
> - 🐛 **Bug fixes** in the original frontend (broken element ID, server location)

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the server

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

That's it — Flask serves both the frontend and the API from a single port.

---

## 🌤️ Features

### Weather Map (existing)
- Interactive SVG map of all 36 Indian states & UTs
- 10 global cities (London, Tokyo, Dubai, NYC, Sydney…)
- 4 layer overlays: Temperature, Humidity, AQI, Wind
- 24-hour temperature chart, 5-day forecast, sunrise/sunset arc
- Live weather animations (rain, thunder, snow, sun, clouds, mist)
- AQI ring with health classification
- °C / °F unit toggle
- **Demo mode** (built-in data, no internet) and **Live API** mode

### Trip Planner (new in v2)
- Click **"Plan a Trip"** in the sidebar
- Enter destination (origin optional), date, duration, traveller type
- Get back:
  - **Hero summary** — destination, weather, route
  - **Smart alerts** — thunderstorm, rain, heat, cold, wind warnings
  - **Route weather** — waypoint-by-waypoint forecast (when origin given)
  - **Day-by-day forecast** — temperature ranges, rain in mm, conditions
  - **Personalised packing list** — checklist that saves your progress

### Traveller Types & What They Get

| Type | Special Items in Packing List | Special Alerts |
|------|------------------------------|----------------|
| 🌐 **General** | Camera, day bag, offline maps | Standard weather warnings |
| 🏍️ **Bike Trip** | Helmet, gloves, riding jacket, toolkit, rain suit | Riding-specific route alerts: "Rain ~135 km ahead, plan a stop" |
| 🚗 **Road Trip** | RC/DL papers, spare tyre, mounts, road playlist | Wet road / wind warnings |
| 🥾 **Trek / Hike** | Trekking pole, headlamp, blister kit, tent if cold | Slippery trail alerts |
| 👨‍👩‍👧 **Family** | Kids' toys, activity books, wet wipes, kid medicines | All standard warnings |
| 🎒 **Backpacker** | Padlock, copies of ID, journal, lightweight bag | Standard warnings |
| 💼 **Business** | Formal outfits, laptop, docs folder | Standard warnings |

---

## 📁 Project Structure

```
SkyScope-main/
├── app.py                 ← Flask backend (entry point — run this)
├── requirements.txt
├── README.md              ← this file
├── DOCUMENTATION.md       ← detailed dev docs
│
├── templates/
│   └── index.html         ← single-page UI
│
└── static/
    ├── css/
    │   └── style.css      ← all styles (glass theme)
    └── js/
        ├── data.js        ← demo data for states + global cities
        ├── animations.js  ← canvas weather animations
        ├── map.js         ← SVG map + markers + layer overlays
        ├── chart.js       ← 24-hr chart + sunrise arc
        ├── trip.js        ← Travel Planner modal logic ★ new
        └── app.js         ← main app glue: search, sidebar, unit toggle
```

---

## 🔑 OpenWeatherMap API Key (optional)

The app ships with a sample API key. To use your own:

**Option A — Environment variable:**
```bash
export OWM_API_KEY="your_key_here"
python app.py
```

**Option B — In the UI:**
Toggle "Live API" in the sidebar's *Data Source* section, paste your key,
hit **Save & Reload**.

Get a free key at: https://openweathermap.org/api

---

## 🛠️ Tech Stack

- **Backend:** Flask 3, flask-cors, requests
- **Frontend:** Vanilla JS, Chart.js, custom SVG, CSS glassmorphism
- **APIs:** OpenWeatherMap (current weather, 5-day forecast, geocoding)
- **No build step** — open the URL and it just works.

---

## 🐛 Bugs Fixed

The original codebase had three blocking issues:

1. **Broken element ID lookup** in `app.js`:
   `getElementById("9d6eb6d3a3763e5ea98a5c431abac4ff")` — that's the API key
   used as a DOM ID! Replaced with the correct `"api-key-input"`.
2. **Misplaced `app.py`** lived at `static/js/app.py` and didn't serve any
   frontend. Moved to project root and now serves the SPA + static files.
3. **Hard-coded `BACKEND_URL`** in `data.js` pointed to `localhost:5000`,
   creating CORS friction. Now relative — same origin as the page.

---

## 📜 License

For the assignment / educational use. Weather data © OpenWeatherMap.

---

See **DOCUMENTATION.md** for API reference, architecture details and
extension guides.
