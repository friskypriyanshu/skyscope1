// ============================================================
//  SkyScope — chart.js
//  24-hour temperature chart + sunrise/sunset arc
// ============================================================

let hourlyChart = null;

function initChart(hourlyData, bg) {
  const ctx = document.getElementById("hourly-chart").getContext("2d");

  // Gradient fill based on weather bg
  const gradColors = {
    "hot":          ["rgba(255,120,0,0.5)",  "rgba(255,120,0,0.02)"],
    "clear-day":    ["rgba(255,200,50,0.5)", "rgba(255,200,50,0.02)"],
    "rainy":        ["rgba(80,150,255,0.5)", "rgba(80,150,255,0.02)"],
    "thunderstorm": ["rgba(130,80,255,0.5)", "rgba(130,80,255,0.02)"],
    "cloudy":       ["rgba(160,180,220,0.5)","rgba(160,180,220,0.02)"],
    "snow":         ["rgba(180,220,255,0.5)","rgba(180,220,255,0.02)"],
    "mist":         ["rgba(180,190,200,0.5)","rgba(180,190,200,0.02)"],
    "clear-night":  ["rgba(100,80,200,0.5)", "rgba(100,80,200,0.02)"]
  };

  const [c1, c2] = gradColors[bg] || gradColors["clear-day"];
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);

  const lineColor = bg === "snow" ? "#90caf9" :
                    bg === "rainy" || bg === "thunderstorm" ? "#64b5f6" :
                    bg === "hot" ? "#ff8f00" : "rgba(255,255,255,0.9)";

  const labels = Array.from({length:24}, (_, i) => {
    const h = i % 12 === 0 ? 12 : i % 12;
    return i < 12 ? `${h}am` : `${h}pm`;
  });

  if (hourlyChart) hourlyChart.destroy();

  hourlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: hourlyData,
        borderColor: lineColor,
        borderWidth: 2.5,
        backgroundColor: grad,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.6)",
          titleColor: "#fff",
          bodyColor: "rgba(255,255,255,0.8)",
          callbacks: {
            label: ctx => `  ${ctx.parsed.y}°C`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)", drawTicks: false },
          ticks: {
            color: "rgba(255,255,255,0.5)",
            font: { size: 10, family: "'DM Sans'" },
            maxRotation: 0,
            maxTicksLimit: 8
          }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.06)", drawTicks: false },
          ticks: {
            color: "rgba(255,255,255,0.5)",
            font: { size: 10, family: "'DM Sans'" },
            callback: v => v + "°"
          }
        }
      }
    }
  });
}

// Sunrise / Sunset arc
function renderSunArc(sunrise, sunset) {
  const wrap = document.getElementById("sun-arc-wrap");
  if (!wrap) return;

  const [srH, srM] = sunrise.split(":").map(Number);
  const [ssH, ssM] = sunset.split(":").map(Number);
  const nowH = new Date().getHours();
  const nowM = new Date().getMinutes();

  const total  = (ssH * 60 + ssM) - (srH * 60 + srM);
  const nowMin = nowH * 60 + nowM;
  const srMin  = srH * 60 + srM;
  const progress = Math.max(0, Math.min(1, (nowMin - srMin) / total));

  // Arc params
  const W = 220, H = 110, cx = 110, cy = 105, r = 90;
  const startAngle = Math.PI;
  const endAngle   = 0;
  const sunAngle   = Math.PI - progress * Math.PI;

  const sx = cx + r * Math.cos(sunAngle);
  const sy = cy - r * Math.sin(sunAngle);

  wrap.innerHTML = `
    <svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;overflow:visible">
      <defs>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="rgba(255,200,50,0.3)"/>
          <stop offset="100%" stop-color="rgba(255,100,0,0.3)"/>
        </linearGradient>
      </defs>
      <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}"
            fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3" stroke-linecap="round"/>
      <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${sx} ${sy}"
            fill="none" stroke="url(#arcGrad)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${sx}" cy="${sy}" r="7" fill="#ffd700" opacity="0.95"/>
      <circle cx="${sx}" cy="${sy}" r="11" fill="rgba(255,215,0,0.25)"/>
      <text x="${cx-r-4}" y="${cy+16}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="10" font-family="DM Sans">${sunrise}</text>
      <text x="${cx+r+4}" y="${cy+16}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="10" font-family="DM Sans">${sunset}</text>
      <text x="${cx}" y="${cy+18}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="DM Sans">Sunrise · Sunset</text>
    </svg>`;
}

// 5-day forecast strip
function renderForecast(forecast) {
  const list = document.getElementById("forecast-list");
  if (!list) return;
  list.innerHTML = forecast.map(f => `
    <div class="forecast-row">
      <span class="fc-day">${f.day}</span>
      <span class="fc-icon">${f.icon}</span>
      <span class="fc-range"><span class="fc-hi">${f.hi}°</span><span class="fc-lo">${f.lo}°</span></span>
    </div>`).join("");
}
