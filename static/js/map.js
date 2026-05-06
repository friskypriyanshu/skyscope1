

// Approximate SVG coordinates [cx, cy] for each state label/marker
// viewBox: 0 0 800 900
const STATE_COORDS = {
  "Jammu & Kashmir":      [200, 62],  "Ladakh":               [310, 55],
  "Himachal Pradesh":     [220, 130], "Punjab":               [165, 140],
  "Uttarakhand":          [285, 148], "Haryana":              [190, 170],
  "Delhi":                [210, 192], "Uttar Pradesh":        [310, 210],
  "Rajasthan":            [165, 245], "Bihar":                [400, 230],
  "Sikkim":               [460, 198], "Arunachal Pradesh":    [560, 175],
  "Nagaland":             [570, 210], "Manipur":              [565, 240],
  "Mizoram":              [555, 268], "Tripura":              [530, 262],
  "Meghalaya":            [500, 228], "Assam":                [510, 208],
  "West Bengal":          [450, 265], "Jharkhand":            [418, 268],
  "Odisha":               [408, 320], "Chhattisgarh":         [355, 300],
  "Madhya Pradesh":       [280, 280], "Gujarat":              [150, 295],
  "Maharashtra":          [230, 355], "Telangana":            [310, 360],
  "Andhra Pradesh":       [330, 415], "Karnataka":            [260, 430],
  "Goa":                  [215, 430], "Tamil Nadu":           [300, 490],
  "Kerala":               [255, 510], "Andaman & Nicobar":   [570, 430],
  "Lakshadweep":          [185, 530], "Puducherry":           [335, 498],
  "Chandigarh":           [188, 152], "Dadra & Nagar Haveli": [175, 325],
  "Daman & Diu":          [155, 312]
};

// Layer color scales
const LAYER_SCALES = {
  temp: (v) => {
    if (v <= 5)  return "rgba(173,216,230,0.75)";
    if (v <= 15) return "rgba(100,180,255,0.75)";
    if (v <= 22) return "rgba(100,220,150,0.75)";
    if (v <= 28) return "rgba(255,230,100,0.75)";
    if (v <= 35) return "rgba(255,140,0,0.75)";
    return "rgba(210,30,30,0.75)";
  },
  humidity: (v) => {
    if (v <= 30) return "rgba(255,240,180,0.7)";
    if (v <= 50) return "rgba(150,220,200,0.7)";
    if (v <= 65) return "rgba(80,180,230,0.7)";
    if (v <= 80) return "rgba(30,120,200,0.7)";
    return "rgba(10,60,150,0.8)";
  },
  aqi: (v) => {
    if (v <= 50)  return "rgba(0,200,80,0.7)";
    if (v <= 100) return "rgba(255,210,0,0.7)";
    if (v <= 150) return "rgba(255,100,0,0.7)";
    if (v <= 200) return "rgba(210,0,0,0.75)";
    return "rgba(100,0,120,0.8)";
  },
  wind: (v) => {
    if (v <= 8)  return "rgba(200,240,200,0.7)";
    if (v <= 15) return "rgba(100,220,180,0.7)";
    if (v <= 22) return "rgba(50,160,230,0.7)";
    return "rgba(20,80,200,0.8)";
  }
};

let currentLayer = "none";
let markers = [];

function initMap() {
  renderStateMarkers();
  setupLayerButtons();
}

function renderStateMarkers() {
  const overlay = document.getElementById("markers-overlay");
  overlay.innerHTML = "";
  markers = [];

  const allData = { ...STATES_DATA };

  Object.entries(STATE_COORDS).forEach(([name, [cx, cy]]) => {
    const d = allData[name];
    if (!d) return;

    const svgEl = document.getElementById("india-map");
    const rect = svgEl.getBoundingClientRect();
    const vbW = 800, vbH = 900;
    const scaleX = rect.width / vbW;
    const scaleY = rect.height / vbH;

    const marker = document.createElement("div");
    marker.className = "state-marker";
    marker.setAttribute("data-state", name);
    marker.style.left = (cx * scaleX) + "px";
    marker.style.top  = (cy * scaleY) + "px";
    marker.innerHTML  = `<span class="m-icon">${d.icon}</span><span class="m-temp">${d.temp}°</span>`;

    marker.addEventListener("mouseenter", (e) => showTooltip(name, d, e));
    marker.addEventListener("mouseleave", hideTooltip);
    marker.addEventListener("click", () => selectLocation(name, d));

    overlay.appendChild(marker);
    markers.push({ name, el: marker, cx, cy });
  });
}

function repositionMarkers() {
  const svgEl = document.getElementById("india-map");
  const rect = svgEl.getBoundingClientRect();
  const scaleX = rect.width / 800;
  const scaleY = rect.height / 900;

  markers.forEach(({ el, cx, cy }) => {
    el.style.left = (cx * scaleX) + "px";
    el.style.top  = (cy * scaleY) + "px";
  });
}

function setupLayerButtons() {
  document.querySelectorAll(".layer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const layer = btn.getAttribute("data-layer");
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      if (currentLayer === layer) {
        currentLayer = "none";
        clearOverlay();
      } else {
        currentLayer = layer;
        btn.classList.add("active");
        applyOverlay(layer);
      }
    });
  });
}

function applyOverlay(layer) {
  const svgEl = document.getElementById("india-map");
  // Remove old overlay circles
  svgEl.querySelectorAll(".overlay-circle").forEach(e => e.remove());

  const rect = svgEl.getBoundingClientRect();
  const scaleX = 800 / rect.width;
  const scaleY = 900 / rect.height;

  Object.entries(STATE_COORDS).forEach(([name, [cx, cy]]) => {
    const d = STATES_DATA[name];
    if (!d) return;
    const val = layer === "temp" ? d.temp : layer === "humidity" ? d.humidity :
                layer === "aqi"  ? d.aqi  : d.wind;
    const color = LAYER_SCALES[layer](val);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", 28);
    circle.setAttribute("fill", color);
    circle.setAttribute("class", "overlay-circle");
    svgEl.appendChild(circle);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", cx);
    text.setAttribute("y", cy + 5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#fff");
    text.setAttribute("font-weight", "600");
    text.setAttribute("class", "overlay-circle");
    text.textContent = layer === "temp" ? val + "°" :
                       layer === "humidity" ? val + "%" :
                       layer === "aqi" ? val :
                       val + "kph";
    svgEl.appendChild(text);
  });
}

function clearOverlay() {
  document.querySelectorAll(".overlay-circle").forEach(e => e.remove());
}

function showTooltip(name, d, e) {
  const tt = document.getElementById("map-tooltip");
  document.getElementById("tooltip-icon").textContent = d.icon;
  document.getElementById("tooltip-name").textContent = name;
  document.getElementById("tooltip-temp").textContent = d.temp + "°C";
  document.getElementById("tooltip-desc").textContent = d.desc;

  const mapArea = document.querySelector(".map-area").getBoundingClientRect();
  let x = e.clientX - mapArea.left + 16;
  let y = e.clientY - mapArea.top  + 16;
  if (x + 180 > mapArea.width)  x -= 200;
  if (y + 100 > mapArea.height) y -= 110;

  tt.style.left    = x + "px";
  tt.style.top     = y + "px";
  tt.style.opacity = "1";
  tt.style.pointerEvents = "none";
}

function hideTooltip() {
  document.getElementById("map-tooltip").style.opacity = "0";
}

window.addEventListener("resize", () => {
  setTimeout(repositionMarkers, 100);
});
