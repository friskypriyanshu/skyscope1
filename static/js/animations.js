// ============================================================
//  SkyScope — animations.js
//  Canvas-based weather animations: rain, sun, clouds, snow, thunder
// ============================================================

let animCanvas, animCtx, animFrame, animType = null;
const particles = [];

function initAnimCanvas() {
  animCanvas = document.getElementById("anim-canvas");
  if (!animCanvas) return;
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!animCanvas) return;
  animCanvas.width  = window.innerWidth;
  animCanvas.height = window.innerHeight;
}

function stopAnim() {
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = null;
  animType  = null;
  particles.length = 0;
  if (animCtx && animCanvas) animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
}

function startAnim(bg) {
  stopAnim();
  if (!animCanvas) return;
  animCtx = animCanvas.getContext("2d");

  if (bg === "rainy")        startRain(false);
  else if (bg === "thunderstorm") startRain(true);
  else if (bg === "snow")    startSnow();
  else if (bg === "hot" || bg === "clear-day") startSunRays();
  else if (bg === "cloudy" || bg === "mist")   startClouds();
}

// ─── RAIN ────────────────────────────────────────────────────
function startRain(thunder) {
  animType = thunder ? "thunderstorm" : "rain";
  for (let i = 0; i < 180; i++) spawnDrop();
  let thunderTimer = 0;

  function loop() {
    animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
    particles.forEach(p => {
      animCtx.beginPath();
      animCtx.moveTo(p.x, p.y);
      animCtx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
      animCtx.strokeStyle = `rgba(180,210,255,${p.a})`;
      animCtx.lineWidth = p.w;
      animCtx.stroke();
      p.x += p.vx; p.y += p.vy;
      if (p.y > animCanvas.height) { p.y = -10; p.x = Math.random() * animCanvas.width; }
    });

    if (thunder) {
      thunderTimer++;
      if (thunderTimer > 180 + Math.random() * 300) {
        flashLightning();
        thunderTimer = 0;
      }
    }
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function spawnDrop() {
  particles.push({
    x: Math.random() * (animCanvas ? animCanvas.width : 800),
    y: Math.random() * (animCanvas ? animCanvas.height : 600),
    vx: 1.5, vy: 14 + Math.random() * 8,
    w: 0.8 + Math.random() * 0.8,
    a: 0.3 + Math.random() * 0.4
  });
}

function flashLightning() {
  let flashes = 0;
  const flash = () => {
    animCtx.fillStyle = `rgba(220,220,255,${0.08 + Math.random() * 0.12})`;
    animCtx.fillRect(0, 0, animCanvas.width, animCanvas.height);
    flashes++;
    if (flashes < 4) setTimeout(flash, 60 + Math.random() * 80);
  };
  flash();

  // Draw jagged bolt
  const bx = 100 + Math.random() * (animCanvas.width - 200);
  animCtx.beginPath();
  animCtx.moveTo(bx, 0);
  let y = 0;
  while (y < animCanvas.height * 0.6) {
    y += 30 + Math.random() * 40;
    animCtx.lineTo(bx + (Math.random() - 0.5) * 80, y);
  }
  animCtx.strokeStyle = "rgba(255,255,220,0.9)";
  animCtx.lineWidth   = 2;
  animCtx.shadowColor = "#fff";
  animCtx.shadowBlur  = 20;
  animCtx.stroke();
  animCtx.shadowBlur  = 0;
}

// ─── SNOW ────────────────────────────────────────────────────
function startSnow() {
  animType = "snow";
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 0.8 + Math.random() * 1.5,
      a: 0.4 + Math.random() * 0.5,
      drift: Math.random() * Math.PI * 2
    });
  }

  function loop() {
    animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
    particles.forEach(p => {
      p.drift += 0.01;
      p.x += p.vx + Math.sin(p.drift) * 0.4;
      p.y += p.vy;
      if (p.y > animCanvas.height) { p.y = -5; p.x = Math.random() * animCanvas.width; }
      animCtx.beginPath();
      animCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      animCtx.fillStyle = `rgba(255,255,255,${p.a})`;
      animCtx.fill();
    });
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

// ─── SUN RAYS ────────────────────────────────────────────────
function startSunRays() {
  animType = "sun";
  let angle = 0;

  function loop() {
    animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
    const cx = animCanvas.width * 0.78, cy = animCanvas.height * 0.12;
    const numRays = 14;

    for (let i = 0; i < numRays; i++) {
      const a = angle + (i / numRays) * Math.PI * 2;
      const inner = 60, outer = 180 + Math.sin(angle * 2 + i) * 30;
      const grad = animCtx.createLinearGradient(
        cx + Math.cos(a) * inner, cy + Math.sin(a) * inner,
        cx + Math.cos(a) * outer, cy + Math.sin(a) * outer
      );
      grad.addColorStop(0, "rgba(255,230,80,0.18)");
      grad.addColorStop(1, "rgba(255,180,0,0)");

      animCtx.beginPath();
      animCtx.moveTo(cx + Math.cos(a - 0.08) * inner, cy + Math.sin(a - 0.08) * inner);
      animCtx.lineTo(cx + Math.cos(a) * outer,         cy + Math.sin(a) * outer);
      animCtx.lineTo(cx + Math.cos(a + 0.08) * inner, cy + Math.sin(a + 0.08) * inner);
      animCtx.fillStyle = grad;
      animCtx.fill();
    }

    // Sun glow
    const glow = animCtx.createRadialGradient(cx, cy, 10, cx, cy, 80);
    glow.addColorStop(0, "rgba(255,230,80,0.3)");
    glow.addColorStop(1, "rgba(255,230,80,0)");
    animCtx.beginPath();
    animCtx.arc(cx, cy, 80, 0, Math.PI * 2);
    animCtx.fillStyle = glow;
    animCtx.fill();

    angle += 0.003;
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

// ─── CLOUDS ──────────────────────────────────────────────────
function startClouds() {
  animType = "clouds";
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: 30 + Math.random() * 200,
      w: 120 + Math.random() * 160,
      h: 50 + Math.random() * 50,
      speed: 0.15 + Math.random() * 0.3,
      a: 0.06 + Math.random() * 0.08
    });
  }

  function drawCloud(p) {
    animCtx.fillStyle = `rgba(255,255,255,${p.a})`;
    animCtx.beginPath();
    animCtx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
    animCtx.fill();
    animCtx.beginPath();
    animCtx.ellipse(p.x - p.w * 0.22, p.y + p.h * 0.1, p.w * 0.3, p.h * 0.4, 0, 0, Math.PI * 2);
    animCtx.fill();
    animCtx.beginPath();
    animCtx.ellipse(p.x + p.w * 0.22, p.y + p.h * 0.1, p.w * 0.28, p.h * 0.38, 0, 0, Math.PI * 2);
    animCtx.fill();
  }

  function loop() {
    animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
    particles.forEach(p => {
      drawCloud(p);
      p.x += p.speed;
      if (p.x - p.w > animCanvas.width) p.x = -p.w;
    });
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}
