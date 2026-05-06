// ============================================================
//  SkyScope — trip.js
//  Travel-planner modal: form, submission, result rendering,
//  packing-list checklist with persistent ticks.
// ============================================================

let selectedTravellerType = "general";
let lastTripData = null;

// Map weather "main" values + has_rain etc → friendly emoji
function tripWeatherEmoji(s) {
  if (s.has_thunder) return "⛈️";
  if (s.has_snow)    return "❄️";
  if (s.has_rain)    return "🌧️";
  if (s.main === "Clouds") return "☁️";
  if (s.temp_max >= 38) return "🔥";
  return "☀️";
}

// ─── Modal open / close ───────────────────────────────────
function openTripModal() {
  const m = document.getElementById("trip-modal");
  m.classList.add("open");
  document.body.classList.add("modal-open");
  // Default date = today
  const dateEl = document.getElementById("trip-date");
  if (!dateEl.value) {
    const d = new Date();
    dateEl.value = d.toISOString().slice(0, 10);
  }
}

function closeTripModal() {
  document.getElementById("trip-modal").classList.remove("open");
  document.body.classList.remove("modal-open");
}

// ─── Init listeners ───────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("plan-trip-btn")
    .addEventListener("click", openTripModal);

  document.getElementById("modal-close")
    .addEventListener("click", closeTripModal);

  // Close on backdrop click
  document.getElementById("trip-modal").addEventListener("click", e => {
    if (e.target.id === "trip-modal") closeTripModal();
  });

  // Esc to close
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeTripModal();
  });

  // Traveller type buttons
  document.querySelectorAll(".tt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tt-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedTravellerType = btn.getAttribute("data-type");
    });
  });

  // Submit
  document.getElementById("trip-submit")
    .addEventListener("click", submitTrip);

  // Back to form
  document.getElementById("back-to-form")
    .addEventListener("click", () => {
      document.getElementById("trip-result").style.display = "none";
      document.getElementById("trip-form").style.display = "block";
    });
});

// ─── Submit ───────────────────────────────────────────────
async function submitTrip() {
  const destination = document.getElementById("trip-destination").value.trim();
  if (!destination) {
    alert("Please enter a destination");
    document.getElementById("trip-destination").focus();
    return;
  }

  const payload = {
    origin:         document.getElementById("trip-origin").value.trim(),
    destination,
    travel_date:    document.getElementById("trip-date").value || null,
    duration_days:  parseInt(document.getElementById("trip-duration").value || "1", 10),
    traveller_type: selectedTravellerType,
    use_demo:       (typeof dataSource !== "undefined") && dataSource === "demo",
  };

  // UI: show loading
  document.getElementById("trip-form").style.display = "none";
  document.getElementById("trip-result").style.display = "none";
  document.getElementById("trip-loading").style.display = "flex";

  try {
    const res = await fetch(`${BACKEND_URL}/plan-trip`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Trip planning failed");
      document.getElementById("trip-loading").style.display = "none";
      document.getElementById("trip-form").style.display = "block";
      return;
    }

    lastTripData = data;
    renderTripResult(data);

  } catch (err) {
    alert("Could not reach the server. Make sure the Flask backend is running.");
    document.getElementById("trip-loading").style.display = "none";
    document.getElementById("trip-form").style.display = "block";
  }
}

// ─── Render result ────────────────────────────────────────
function renderTripResult(data) {
  document.getElementById("trip-loading").style.display = "none";
  document.getElementById("trip-result").style.display = "block";

  // Hero card
  const p = data.primary;
  const ttLabels = {
    general:    "🌐 General Tourist",
    bike:       "🏍️ Bike Trip",
    car:        "🚗 Road Trip",
    hike:       "🥾 Trek / Hike",
    family:     "👨‍👩‍👧 Family Trip",
    backpacker: "🎒 Backpacker",
    business:   "💼 Business Trip",
  };

  const demoBadge = data.used_demo
    ? `<span class="demo-badge">Demo data</span>` : "";

  document.getElementById("trip-hero").innerHTML = `
    <div class="hero-top">
      <div>
        <div class="hero-route">
          ${data.origin ? `<span>${data.origin}</span> <span class="hero-arrow">→</span>` : ""}
          <span class="hero-dest">${data.destination}</span>
        </div>
        <div class="hero-meta">
          ${ttLabels[data.traveller_type] || data.traveller_type}
          · ${data.duration_days} day${data.duration_days > 1 ? "s" : ""}
          · From ${data.travel_date}
          ${demoBadge}
        </div>
      </div>
      <div class="hero-weather">
        <div class="hero-icon">${tripWeatherEmoji(p)}</div>
        <div class="hero-temp">${p.temp_max}°<span>/${p.temp_min}°</span></div>
        <div class="hero-desc">${p.description}</div>
      </div>
    </div>
  `;

  // Alerts
  const alertsBox = document.getElementById("trip-alerts");
  if (!data.alerts.length) {
    alertsBox.innerHTML = `
      <div class="alert-card alert-success">
        <div class="alert-icon">✅</div>
        <div>
          <div class="alert-title">All clear!</div>
          <div class="alert-msg">No major weather warnings for your trip. Have a safe journey!</div>
        </div>
      </div>`;
  } else {
    alertsBox.innerHTML = data.alerts.map(a => `
      <div class="alert-card alert-${a.level}">
        <div class="alert-icon">${a.icon}</div>
        <div>
          <div class="alert-title">${a.title}</div>
          <div class="alert-msg">${a.msg}</div>
        </div>
      </div>
    `).join("");
  }

  // Route
  const routeSection = document.getElementById("trip-route-section");
  const routeBox = document.getElementById("trip-route");
  if (data.route && data.route.length > 0) {
    routeSection.style.display = "block";
    routeBox.innerHTML = `
      <div class="route-line">
        ${data.route.map((r, i) => {
          const s = r.summary;
          const isFirst = i === 0;
          const isLast  = i === data.route.length - 1;
          const label   = isFirst ? "Start" : isLast ? "End" : `+${r.distance_km} km`;
          return `
            <div class="route-stop">
              <div class="route-marker">${tripWeatherEmoji(s)}</div>
              <div class="route-label">${label}</div>
              <div class="route-temp">${s.temp_max}°/${s.temp_min}°</div>
              <div class="route-desc">${s.description}</div>
            </div>`;
        }).join('<div class="route-connector"></div>')}
      </div>
    `;
  } else {
    routeSection.style.display = "none";
  }

  // Daily forecast
  document.getElementById("trip-daily").innerHTML = data.daily.map(d => {
    const dt = new Date(d.date);
    const dayName = dt.toLocaleDateString("en-IN", { weekday: "short" });
    const dayNum  = dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `
      <div class="day-card">
        <div class="day-name">${dayName}</div>
        <div class="day-date">${dayNum}</div>
        <div class="day-icon">${tripWeatherEmoji(d)}</div>
        <div class="day-temps">
          <span class="day-hi">${d.temp_max}°</span>
          <span class="day-lo">${d.temp_min}°</span>
        </div>
        <div class="day-desc">${d.description}</div>
        ${d.has_rain ? `<div class="day-extra">☂️ ${d.rain_mm} mm rain</div>` : ""}
      </div>`;
  }).join("");

  // Packing list — interactive checklist
  renderPackingList(data.packing);
}

function renderPackingList(packing) {
  const box = document.getElementById("trip-packing");
  if (!packing || !packing.length) {
    box.innerHTML = "";
    return;
  }

  let total = 0, checked = 0;
  const tripKey = `skyscope_pack_${selectedTravellerType}_${(lastTripData && lastTripData.destination) || "trip"}`
                    .toLowerCase().replace(/\s+/g, "_");
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(tripKey) || "{}"); } catch(e) {}

  box.innerHTML = packing.map(group => {
    return `
      <div class="pack-group">
        <div class="pack-group-title">${group.category}</div>
        <div class="pack-items">
          ${group.items.map(item => {
            total += 1;
            const id  = `${group.category}::${item.text}`;
            const isChecked = !!saved[id];
            if (isChecked) checked += 1;
            return `
              <label class="pack-item ${isChecked ? 'is-checked' : ''}">
                <input type="checkbox" data-id="${id.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
                <span class="pack-emoji">${item.emoji}</span>
                <span class="pack-text">${item.text}</span>
                <span class="pack-tick">✓</span>
              </label>`;
          }).join("")}
        </div>
      </div>`;
  }).join("");

  updatePackingProgress(checked, total);

  // Wire up checkboxes
  box.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-id");
      saved[id] = cb.checked;
      localStorage.setItem(tripKey, JSON.stringify(saved));
      cb.closest(".pack-item").classList.toggle("is-checked", cb.checked);

      const items = box.querySelectorAll('input[type="checkbox"]');
      const c = Array.from(items).filter(i => i.checked).length;
      updatePackingProgress(c, items.length);
    });
  });
}

function updatePackingProgress(c, t) {
  const el = document.getElementById("packing-progress");
  el.textContent = `${c} / ${t} packed`;
  el.style.color = c === t && t > 0 ? "#69f0ae" : "rgba(255,255,255,0.55)";
}
