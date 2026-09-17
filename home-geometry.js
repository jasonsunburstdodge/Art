(() => {
  "use strict";

  // Homepage-only background: a circuit-city flythrough. Scrolling moves the
  // camera forward through a canyon of close, oversized skyscrapers whose
  // facades are dark circuit-board glass — no text anywhere in the scene.
  // The canyon lines run uninterrupted from the top of each building down to
  // the bottom of the screen, with overhead bridges lighting up as the
  // camera passes beneath them. Every building line in the canyon glows
  // electric blue in lockstep: brightness snaps to full the instant the
  // page moves and stays there for as long as scrolling continues, then
  // holds and fades away smoothly over real time once scrolling stops.
  // Reduced-motion visitors get the on/off version with no lingering fade,
  // so nothing moves without their input. No node webs, no literal neural
  // network, no ground-level road — everything is tower, bridge and pulse.

  const canvas = document.getElementById("synapse-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CYAN = [95, 205, 251];
  const WHITE = [242, 246, 255];
  const DIM = [58, 78, 108];

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smoothstep(a, b, x) {
    if (a === b) return x < a ? 0 : 1;
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0, cx = 0, cy = 0;

  const FOCAL = 340;
  const NEAR = 6;
  const FAR = 1300;
  const EYE_BASE = 130;
  const HALF_WIDTH_BASE = 130;
  const Z_PER_PIXEL = 3.2;

  // Brightness snaps to full the instant camZ moves, then decays back to 0
  // over FADE_MS of real time once movement stops — "stays bright while
  // scrolling, fades out after."
  const FADE_MS = 700;
  const CLIMB_UNIT = 220;

  // ---------------------------------------------------------------------
  // Path: the canyon curves left/right and the camera rises/dives, purely
  // as a function of forward distance (z), so scrubbing scroll is exact.
  // ---------------------------------------------------------------------
  function pathX(z) {
    return Math.sin(z * 0.0016) * 150 + Math.sin(z * 0.00047 + 1.3) * 90;
  }
  function eyeY(z) {
    return EYE_BASE + Math.sin(z * 0.0011 + 0.6) * 34;
  }
  const PINCH_WINDOW = 70;
  let pinches = [];
  function halfWidthAt(z) {
    let w = HALF_WIDTH_BASE + Math.sin(z * 0.0021) * 22 + openingBoost(z);
    for (const p of pinches) {
      const d = Math.abs(z - p);
      if (d < PINCH_WINDOW) w -= (1 - d / PINCH_WINDOW) * 55;
    }
    return Math.max(46, w);
  }
  function openingBoost(z) {
    if (z < bounds.find[0]) return 0;
    return smoothstep(bounds.find[0], bounds.find[0] + 320, z) * 55;
  }

  // ---------------------------------------------------------------------
  // Section boundaries, converted from page pixels into world distance.
  // ---------------------------------------------------------------------
  let bounds = { heroEnd: 2000, build: [2000, 6000], connect: [6000, 10000], find: [10000, 14000], scaleStart: 14000, scaleEnd: 18000 };
  let worldLength = 18000;

  function measure() {
    const buildEl = document.getElementById("build");
    const connectEl = document.getElementById("connect");
    const findEl = document.getElementById("find");
    const scaleEl = document.getElementById("scale");
    const contactEl = document.getElementById("contact");
    const docHeight = document.documentElement.scrollHeight;

    const buildStart = (buildEl ? buildEl.offsetTop : height) * Z_PER_PIXEL;
    const connectStart = (connectEl ? connectEl.offsetTop : buildStart + height) * Z_PER_PIXEL;
    const findStart = (findEl ? findEl.offsetTop : connectStart + height) * Z_PER_PIXEL;
    const scaleStart = (scaleEl ? scaleEl.offsetTop : findStart + height) * Z_PER_PIXEL;
    const scaleEnd = (contactEl ? contactEl.offsetTop : scaleStart + height) * Z_PER_PIXEL;

    bounds = {
      heroEnd: buildStart,
      build: [buildStart, connectStart],
      connect: [connectStart, findStart],
      find: [findStart, scaleStart],
      scaleStart, scaleEnd
    };
    worldLength = Math.max(scaleEnd, docHeight * Z_PER_PIXEL);
    pinches = [lerp(bounds.build[0], bounds.build[1], 0.32), lerp(bounds.build[0], bounds.build[1], 0.68)];
  }

  function districtAt(z) {
    if (z < bounds.heroEnd) return "hero";
    if (z < bounds.build[1]) return "build";
    if (z < bounds.connect[1]) return "connect";
    if (z < bounds.find[1]) return "find";
    return "scale";
  }

  // ---------------------------------------------------------------------
  // Procedural city: two walls of building segments plus overhead bridges.
  // ---------------------------------------------------------------------
  let leftBuildings = [], rightBuildings = [], bridges = [];

  function buildCity() {
    leftBuildings = generateWall(-1);
    rightBuildings = generateWall(1);
    bridges = [];
    let z = bounds.connect[0] + 60;
    while (z < bounds.connect[1]) {
      bridges.push({ z, y: 260 + Math.random() * 240 });
      z += 190 + Math.random() * 170;
    }
    let hz = bounds.heroEnd * 0.35;
    while (hz < bounds.heroEnd) {
      bridges.push({ z: hz, y: 300 + Math.random() * 200 });
      hz += 900 + Math.random() * 400;
    }
  }

  function generateWall(side) {
    const wall = [];
    let z = 40 + Math.random() * 60;
    while (z < worldLength) {
      const segLen = 85 + Math.random() * 90;
      const district = districtAt(z + segLen * 0.3);
      wall.push({
        zStart: z, zEnd: z + segLen, side, district,
        height: district === "build" ? 480 + Math.random() * 480 : 380 + Math.random() * 520
      });
      z += segLen + 30 + Math.random() * 70;
    }
    return wall;
  }

  // ---------------------------------------------------------------------
  // Camera / projection
  // ---------------------------------------------------------------------
  let camZ = 0, camX = 0, camY = EYE_BASE;

  function project(wx, wy, wz) {
    const depth = wz - camZ;
    if (depth < NEAR || depth > FAR) return null;
    const scale = FOCAL / depth;
    const sx = cx + (wx - camX) * scale;
    const sy = cy - (wy - camY) * scale;
    const fadeNear = Math.min(1, (depth - NEAR) / 60);
    const fadeFar = Math.min(1, (FAR - depth) / (FAR * 0.4));
    return { x: sx, y: sy, scale, depth, alpha: Math.max(0, Math.min(fadeNear, fadeFar)) };
  }

  function drawBridge(b) {
    const lit = smoothstep(b.z - 90, b.z + 10, camZ);
    const hw = halfWidthAt(b.z);
    const xL = pathX(b.z) - hw, xR = pathX(b.z) + hw;
    const pL = project(xL, b.y, b.z);
    const pR = project(xR, b.y, b.z);
    if (!pL || !pR) return;
    const a = Math.min(pL.alpha, pR.alpha);
    if (a <= 0.02) return;
    const color = lit > 0.5 ? CYAN : DIM;
    ctx.strokeStyle = rgba(color, (lit > 0.5 ? 0.5 : 0.22) * a);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pL.x, pL.y);
    ctx.lineTo(pR.x, pR.y);
    ctx.stroke();
    if (lit > 0.5) {
      // A single bright sweep across the span as the camera passes beneath
      // it — position comes only from camZ, so it only moves on scroll.
      const t = clamp01((camZ - (b.z - 60)) / 130);
      const px = lerp(pL.x, pR.x, t), py = lerp(pL.y, pR.y, t);
      ctx.fillStyle = rgba(WHITE, a);
      ctx.shadowColor = rgba(CYAN, 0.9 * a);
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // ---------------------------------------------------------------------
  // Buildings: mullion lines and story ticks. Screen-x from project()
  // depends only on depth (wz), not on world-height (wy), so the same x
  // used for a line's reference point is reused at both the screen's top
  // and bottom edges to carry every line the full height of the frame —
  // there's no separate "ground" or "sky" point to project for that.
  // ---------------------------------------------------------------------
  function drawBuilding(b, flash, climbT) {
    if (b.zEnd < camZ - 40 || b.zStart > camZ + FAR) return;
    const wallXAt = (z) => pathX(z) + b.side * halfWidthAt(z);
    const refZ = Math.max(b.zStart, camZ + NEAR + 1);
    const wallX = wallXAt(refZ);
    const top = project(wallX, b.height, refZ);
    if (!top) return;
    const a = top.alpha;
    if (a <= 0.02) return;

    ctx.strokeStyle = rgba(DIM, 0.35 * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x, height);
    ctx.lineTo(top.x, 0);
    ctx.stroke();

    // City-wide flash: `flash`/`climbT` are the same for every building this
    // frame, so every line brightens and fades in lockstep.
    if (flash > 0.02) {
      ctx.strokeStyle = rgba(CYAN, 0.5 * flash * a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(top.x, height);
      ctx.lineTo(top.x, 0);
      ctx.stroke();

      const p = project(wallX, climbT * b.height, refZ);
      if (p && p.alpha > 0.02) {
        ctx.fillStyle = rgba(WHITE, 0.7 * flash * p.alpha);
        ctx.shadowColor = rgba(CYAN, 0.6 * flash * p.alpha);
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.4, 2.4 * p.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (const f of [0.35, 0.7]) {
      const z2 = b.zStart + (b.zEnd - b.zStart) * f;
      const wx2 = wallXAt(z2);
      const t2 = project(wx2, b.height * (0.6 + f * 0.3), z2);
      if (t2 && t2.alpha > 0.02) {
        ctx.strokeStyle = rgba(DIM, 0.22 * t2.alpha);
        ctx.beginPath();
        ctx.moveTo(t2.x, height);
        ctx.lineTo(t2.x, 0);
        ctx.stroke();
      }
    }

    const storyStep = 46;
    for (let hy = storyStep; hy < b.height; hy += storyStep) {
      const p = project(wallX, hy, refZ);
      if (!p || p.alpha <= 0.02 || p.scale < 0.05) continue;
      const tickW = Math.max(1, 5 * p.scale);
      ctx.strokeStyle = rgba(DIM, 0.28 * p.alpha);
      ctx.beginPath();
      ctx.moveTo(p.x - tickW, p.y);
      ctx.lineTo(p.x + tickW, p.y);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------
  // Menu-open burst: brief brightness wash instead of a synapse fire.
  // ---------------------------------------------------------------------
  let burstUntil = 0;
  window.fireAllSynapses = function fireBurst() {
    if (reduceMotion) return;
    burstUntil = performance.now() + 500;
  };

  // ---------------------------------------------------------------------
  // Setup / loop
  // ---------------------------------------------------------------------
  function measureAndRebuild() {
    measure();
    buildCity();
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    cx = width / 2;
    cy = height * 0.56;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureAndRebuild();
  }

  function drawVignette() {
    const r = Math.max(width, height) * 0.8;
    const g = ctx.createRadialGradient(width / 2, height * 0.45, r * 0.25, width / 2, height * 0.45, r);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(2,3,8,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  let brightness = 0;
  let prevCamZ = null;
  let prevFrameTime = null;

  function frame(now) {
    const animNow = reduceMotion ? 0 : now;
    const y = window.scrollY + height * 0.5;
    camZ = y * Z_PER_PIXEL;
    camX = pathX(camZ);
    camY = eyeY(camZ);

    const scrolling = prevCamZ !== null && Math.abs(camZ - prevCamZ) > 0.01;
    prevCamZ = camZ;

    let flash;
    if (reduceMotion) {
      // Strictly on/off with scroll position — no lingering real-time fade.
      flash = scrolling ? 1 : 0;
    } else {
      const dt = prevFrameTime !== null ? now - prevFrameTime : 16;
      brightness = scrolling ? 1 : Math.max(0, brightness - dt / FADE_MS);
      flash = brightness;
    }
    prevFrameTime = now;
    const climbT = clamp01((((camZ % CLIMB_UNIT) + CLIMB_UNIT) % CLIMB_UNIT) / CLIMB_UNIT);

    const boost = animNow < burstUntil ? 1.35 : 1;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (boost > 1) ctx.globalAlpha = 1;

    for (const br of bridges) drawBridge(br);

    if (boost > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(CYAN, 0.05 * (boost - 1) * 3);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    for (const b of leftBuildings) drawBuilding(b, flash, climbT);
    for (const b of rightBuildings) drawBuilding(b, flash, climbT);

    ctx.restore();
    drawVignette();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", measureAndRebuild);
  requestAnimationFrame(frame);
})();
