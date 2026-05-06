

let dataSource  = localStorage.getItem("skyscope_source") || "demo";
let currentData = null;
let currentName = "Delhi";
let unitC       = true; // true = °C, false = °F

document.addEventListener("DOMContentLoaded", () => {
  initAnimCanvas();
  initMap();
  updateDateTime();
  setInterval(updateDateTime, 30000);

  // Load saved API key if any
  const saved = localStorage.getItem("skyscope_apikey");
  const apiKeyInput = document.getElementById("api-key-input");
  if (saved && apiKeyInput) apiKeyInput.value = saved;

  // Sidebar toggle
  document.getElementById("menu-btn").addEventListener("click", openSidebar);
  document.getElementById("sidebar-close").addEventListener("click", closeSidebar);

  // Search
  document.getElementById("search-btn").addEventListener("click", doSearch);
  document.getElementById("search-input").addEventListener("keydown", e => {
    if (e.key === "Enter") doSearch();
  });
  document.getElementById("search-input").addEventListener("input", showSuggestions);

  // Unit toggle
  document.getElementById("unit-toggle").addEventListener("click", toggleUnit);

  // Default load — Delhi
  selectLocation("Delhi", STATES_DATA["Delhi"]);
});

// ─── SIDEBAR ─────────────────────────────────────────────────
function openSidebar()  { document.getElementById("sidebar").classList.remove("hidden"); }
function closeSidebar() { document.getElementById("sidebar").classList.add("hidden"); }

// ─── DATE TIME ───────────────────────────────────────────────
function updateDateTime() {
  const now = new Date();
  document.getElementById("current-time").textContent = now.toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"
  });
}

// ─── SEARCH ──────────────────────────────────────────────────
function doSearch() {
  const val = document.getElementById("search-input").value.trim().toLowerCase();
  document.getElementById("suggestions").innerHTML = "";
  if (!val) return;

  const allKeys = [...Object.keys(STATES_DATA), ...Object.keys(GLOBAL_CITIES)];
  const match = allKeys.find(k => k.toLowerCase() === val) ||
                allKeys.find(k => k.toLowerCase().includes(val));

  if (match) {
    const d = STATES_DATA[match] || GLOBAL_CITIES[match];
    selectLocation(match, d);
    document.getElementById("search-input").value = "";
    openSidebar();
  }
}

function showSuggestions() {
  const val  = document.getElementById("search-input").value.trim().toLowerCase();
  const wrap = document.getElementById("suggestions");
  wrap.innerHTML = "";
  if (!val || val.length < 2) return;

  const allKeys = [...Object.keys(STATES_DATA), ...Object.keys(GLOBAL_CITIES)];
  const matches = allKeys.filter(k => k.toLowerCase().includes(val)).slice(0, 6);

  matches.forEach(name => {
    const d   = STATES_DATA[name] || GLOBAL_CITIES[name];
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = `<span>${d.icon}</span> ${name}`;
    div.addEventListener("click", () => {
      selectLocation(name, d);
      document.getElementById("search-input").value = "";
      wrap.innerHTML = "";
      openSidebar();
    });
    wrap.appendChild(div);
  });
}

// ─── MAIN SELECT ─────────────────────────────────────────────
async function selectLocation(name, demoData) {
  currentName = name;
  let d = demoData;

  if (dataSource === "api" && demoData.lat) {
    const live = await fetchLiveWeather(demoData.lat, demoData.lon);
    if (live) d = parseLiveData(live, demoData);
  }

  currentData = d;
  updateSidebar(name, d);
  updateBackground(d.bg);
  startAnim(d.bg);
  highlightMarker(name);

  // Flask smart analysis (non-blocking)
  fetchAnalysis(d.temp, d.wind, d.desc, d.uv).then(analysis => {
    if (analysis) renderAnalysis(analysis);
  });
}

function parseLiveData(live, fallback) {
  const { cur, uvi, fiveDay } = live;
  const sunriseDate = new Date(cur.sys.sunrise * 1000);
  const sunsetDate  = new Date(cur.sys.sunset  * 1000);
  const fmt = d => `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;

  // Build hourly from fiveDay (3-hour slots → interpolate to 24)
  const slots  = (fiveDay.list || []).slice(0, 8).map(s => Math.round(s.main.temp));
  const hourly = [];
  slots.forEach((t, i) => {
    for (let j = 0; j < 3; j++) hourly.push(t + Math.round((j / 3) * ((slots[i+1] || t) - t)));
  });
  while (hourly.length < 24) hourly.push(hourly[hourly.length - 1]);

  // 5-day from fiveDay (noon slots)
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const forecast = [];
  const seen = new Set();
  for (const s of (fiveDay.list || [])) {
    const dt   = new Date(s.dt * 1000);
    const key  = dt.toDateString();
    if (!seen.has(key) && dt.getHours() >= 11 && dt.getHours() <= 14) {
      seen.add(key);
      forecast.push({
        day:  days[dt.getDay()],
        icon: owmIconToEmoji(s.weather[0].icon),
        hi:   Math.round(s.main.temp_max),
        lo:   Math.round(s.main.temp_min)
      });
      if (forecast.length === 5) break;
    }
  }
  while (forecast.length < 5) forecast.push(...fallback.forecast.slice(forecast.length, 5));

  return {
    ...fallback,
    temp:       Math.round(cur.main.temp),
    feels:      Math.round(cur.main.feels_like),
    humidity:   cur.main.humidity,
    wind:       Math.round(cur.wind.speed * 3.6),
    visibility: Math.round((cur.visibility || 10000) / 1000),
    pressure:   cur.main.pressure,
    uv:         Math.round(uvi.value || fallback.uv),
    desc:       cur.weather[0].description.replace(/\b\w/g, c => c.toUpperCase()),
    icon:       owmIconToEmoji(cur.weather[0].icon),
    bg:         owmBg(cur.weather[0].main),
    sunrise:    fmt(sunriseDate),
    sunset:     fmt(sunsetDate),
    hourly:     hourly.slice(0, 24),
    forecast
  };
}

function owmIconToEmoji(icon) {
  const m = { "01d":"☀️","01n":"🌙","02d":"⛅","02n":"☁️","03d":"☁️","03n":"☁️",
              "04d":"☁️","04n":"☁️","09d":"🌧️","09n":"🌧️","10d":"🌦️","10n":"🌧️",
              "11d":"⛈️","11n":"⛈️","13d":"🌨️","13n":"🌨️","50d":"🌫️","50n":"🌫️" };
  return m[icon] || "🌡️";
}

function owmBg(main) {
  const m = { Clear:"clear-day", Clouds:"cloudy", Rain:"rainy", Drizzle:"rainy",
              Thunderstorm:"thunderstorm", Snow:"snow", Mist:"mist", Fog:"mist", Haze:"mist" };
  return m[main] || "clear-day";
}

// ─── SIDEBAR UPDATE ──────────────────────────────────────────
function updateSidebar(name, d) {
  const t = v => unitC ? v : Math.round(v * 9 / 5 + 32);
  const u = unitC ? "°C" : "°F";

  document.getElementById("current-icon").textContent  = d.icon;
  document.getElementById("current-temp").textContent  = t(d.temp) + u;
  document.getElementById("current-city").textContent  = name;
  document.getElementById("current-state").textContent = d.country || "India";
  document.getElementById("current-desc").textContent  = d.desc;

  document.getElementById("stat-humidity").textContent   = d.humidity + "%";
  document.getElementById("stat-wind").textContent       = d.wind + " km/h";
  document.getElementById("stat-feels").textContent      = t(d.feels) + u;
  document.getElementById("stat-visibility").textContent = d.visibility + " km";
  document.getElementById("stat-pressure").textContent   = d.pressure + " hPa";
  document.getElementById("stat-uv").textContent         = d.uv;

  // AQI
  const aqiInfo = getAQIInfo(d.aqi);
  document.getElementById("aqi-value").textContent   = d.aqi;
  document.getElementById("aqi-label").textContent   = aqiInfo.label;
  document.getElementById("aqi-label").style.color   = aqiInfo.color;
  const pct = Math.min(100, (d.aqi / 300) * 100);
  document.getElementById("aqi-bar-fill").style.width      = pct + "%";
  document.getElementById("aqi-bar-fill").style.background = aqiInfo.color;

  // Sunrise/sunset
  renderSunArc(d.sunrise, d.sunset);

  // Chart
  const hourlyC = d.hourly;
  const hourlyDisplay = unitC ? hourlyC : hourlyC.map(v => Math.round(v * 9 / 5 + 32));
  initChart(hourlyDisplay, d.bg);

  // 5-day
  const fcDisplay = d.forecast.map(f => ({
    ...f,
    hi: t(f.hi),
    lo: t(f.lo)
  }));
  renderForecast(fcDisplay);
}

// ─── SMART ANALYSIS ──────────────────────────────────────────
function renderAnalysis(a) {
  const wrap = document.getElementById("analysis-wrap");
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="analysis-card">
      <div class="analysis-row">
        <span class="analysis-label">Activity Score</span>
        <span class="analysis-score">${a.score}<span>/10</span></span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width:${a.score*10}%;background:${a.score>=7?'#69f0ae':a.score>=4?'#ffd600':'#ff5252'}"></div></div>
    </div>
    <div class="analysis-card">
      <div class="analysis-row carwash-row" style="color:${a.car_wash_color}">${a.car_wash}</div>
    </div>
    <div class="analysis-card">
      <div class="analysis-label">☀️ Sunburn Risk</div>
      <div class="sun-advice">${a.sun_advice}</div>
    </div>`;
}

// ─── BACKGROUND ──────────────────────────────────────────────
function updateBackground(bg) {
  const body = document.body;
  body.className = getBgClass(bg);
}

// ─── MARKER HIGHLIGHT ────────────────────────────────────────
function highlightMarker(name) {
  document.querySelectorAll(".state-marker").forEach(m => m.classList.remove("active"));
  const active = document.querySelector(`.state-marker[data-state="${name}"]`);
  if (active) active.classList.add("active");
}

// ─── UNIT TOGGLE ─────────────────────────────────────────────
function toggleUnit() {
  unitC = !unitC;
  document.getElementById("unit-toggle").textContent = unitC ? "°C / °F" : "°F / °C";
  if (currentData) updateSidebar(currentName, currentData);
}

// ─── DATA SOURCE ─────────────────────────────────────────────
function setDataSource(src) {
  dataSource = src;
  localStorage.setItem("skyscope_source", src);
  document.getElementById("btn-demo").classList.toggle("active", src === "demo");
  document.getElementById("btn-api").classList.toggle("active",  src === "api");
  document.getElementById("api-input-wrap").style.display = src === "api" ? "block" : "none";
  document.getElementById("api-hint").textContent = src === "api"
    ? "Live data from OpenWeatherMap."
    : "Using built-in demo data for all states.";
  if (currentData) selectLocation(currentName, currentData);
}

function saveApiKey() {
  const key = document.getElementById("api-key-input").value.trim();
  if (key) {
    localStorage.setItem("skyscope_apikey", key);
    document.getElementById("api-hint").textContent = "API key saved! Loading live data…";
    if (currentData) selectLocation(currentName, currentData);
  }
}

// ─── GLOBAL CITY CARDS ───────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("global-grid");
  if (!grid) return;
  Object.entries(GLOBAL_CITIES).forEach(([name, d]) => {
    const card = document.createElement("div");
    card.className = "global-card";
    card.innerHTML = `
      <div class="gc-icon">${d.icon}</div>
      <div class="gc-name">${name}</div>
      <div class="gc-country">${d.country}</div>
      <div class="gc-temp">${d.temp}°C</div>
      <div class="gc-desc">${d.desc}</div>`;
    card.addEventListener("click", () => {
      selectLocation(name, d);
      openSidebar();
    });
    grid.appendChild(card);
  });
});
