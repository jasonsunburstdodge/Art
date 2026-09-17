(() => {
  "use strict";

  // Homepage-only background: a circuit-city flythrough. Scrolling moves the
  // camera forward through a canyon of close, oversized skyscrapers whose
  // facades are dark circuit-board glass until a pulse reaches them and
  // races up the surface, lighting a vertical word letter by letter. One
  // continuous city; each pillar section only changes which words appear,
  // how fast pulses move, and how open the canyon is. No node webs, no
  // literal neural network — everything is street, tower, bridge and pulse.

  const canvas = document.getElementById("synapse-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CYAN = [95, 205, 251];
  const BLUE = [47, 134, 245];
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

  const WORDS = {
    hero: ["SILVERXIS", "FORWARD", "MOMENTUM"],
    build: ["BUILD", "CREATE", "INNOVATE", "DEVELOP", "AUTOMATE", "INTEGRATE", "MODERNIZE", "TRANSFORM", "SOLVE", "SCALE"],
    connect: ["CONNECT", "TALENT", "TEAMS", "EXPERTISE", "CAPABILITY", "SUPPORT", "AUGMENT", "COLLABORATE", "EMPOWER", "DELIVER"],
    find: ["FIND", "DISCOVER", "VISIBLE", "ATTRACT", "ENGAGE", "REACH", "INFLUENCE", "CONVERT", "DEMAND", "OPPORTUNITY"],
    scale: ["SCALE", "GROWTH", "TOGETHER", "MOMENTUM", "PARTNERSHIP"]
  };
  const CLIMAX_WORDS = ["VISIBLE", "ENGAGE", "CONVERT", "GROW"];

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
    const counters = { hero: 0, build: 0, connect: 0, find: 0, scale: 0 };
    const climaxStart = bounds.find[1] - CLIMAX_WORDS.length * 95;
    let z = 40 + Math.random() * 60;
    let climaxIdx = 0;
    while (z < worldLength) {
      const segLen = 85 + Math.random() * 90;
      const district = districtAt(z + segLen * 0.3);
      let word = null;
      if (z >= climaxStart && z < bounds.find[1] && climaxIdx < CLIMAX_WORDS.length && (side < 0) === (climaxIdx % 2 === 0)) {
        word = CLIMAX_WORDS[climaxIdx++];
      } else if (district === "hero") {
        if (Math.random() < 0.35) word = WORDS.hero[counters.hero++ % WORDS.hero.length];
      } else {
        const list = WORDS[district];
        word = list[counters[district]++ % list.length];
      }
      wall.push({
        zStart: z, zEnd: z + segLen, side, district,
        wallX: () => 0, // set at draw time via halfWidthAt(z)
        height: district === "build" ? 480 + Math.random() * 480 : 380 + Math.random() * 520,
        word,
        climbSpan: district === "scale" ? 16 : district === "find" ? 34 : district === "connect" ? 46 : 55
      });
      z += segLen + 30 + Math.random() * 70;
    }
    return wall;
  }

  // ---------------------------------------------------------------------
  // Camera / projection
  // ---------------------------------------------------------------------
  let camZ = 0, camX = 0, camY = EYE_BASE, lookUpBoost = 0;

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

  // ---------------------------------------------------------------------
  // Street: curving lane lines + forward-motion dashes.
  // ---------------------------------------------------------------------
  let dashPhase = 0;
  function drawStreet() {
    const offsets = [0, 0.55, 1];
    for (const f of offsets) {
      for (const side of [-1, 1]) {
        if (f === 0 && side === 1) continue;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 26; i++) {
          const z = camZ + NEAR + (FAR - NEAR) * (i / 26);
          const hw = halfWidthAt(z);
          const wx = pathX(z) + side * hw * f;
          const p = project(wx, 0, z);
          if (!p) continue;
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
        const a = f === 0 ? 0.16 : 0.22;
        ctx.strokeStyle = rgba(f === 0 ? WHITE : CYAN, a);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (!reduceMotion) dashPhase = (dashPhase + 6) % 90;
    for (let i = 0; i < 14; i++) {
      const z = camZ + 20 + ((i * 90 + dashPhase) % (FAR - 20));
      const p = project(pathX(z), 0, z);
      if (!p || p.alpha <= 0.02) continue;
      ctx.fillStyle = rgba(WHITE, 0.35 * p.alpha);
      const s = Math.max(0.6, 6 * p.scale);
      ctx.fillRect(p.x - s / 2, p.y - 1, s, 2);
    }
  }

  function drawBridge(b, now) {
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
      const t = reduceMotion ? 0.5 : (now * 0.0004 + b.z * 0.01) % 1;
      const px = lerp(pL.x, pR.x, t), py = lerp(pL.y, pR.y, t);
      ctx.fillStyle = rgba(WHITE, 0.8 * a);
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------
  // Buildings: mullion lines + a bottom-to-top illuminated vertical word.
  // ---------------------------------------------------------------------
  function drawBuilding(b, now) {
    if (b.zEnd < camZ - 40 || b.zStart > camZ + FAR) return;
    const wallXAt = (z) => pathX(z) + b.side * halfWidthAt(z);
    const refZ = Math.max(b.zStart, camZ + NEAR + 1);
    const wallX = wallXAt(refZ);
    const base = project(wallX, 0, refZ);
    const top = project(wallX, b.height, refZ);
    if (!base || !top) return;
    const a = base.alpha;
    if (a <= 0.02) return;

    const climb = clamp01((camZ - b.zStart) / b.climbSpan);
    if (climb > 0.06 && climb < 0.94) lookUpBoost = Math.max(lookUpBoost, climb * (1 - climb) * 4);

    ctx.strokeStyle = rgba(DIM, 0.35 * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();

    for (const f of [0.35, 0.7]) {
      const z2 = b.zStart + (b.zEnd - b.zStart) * f;
      const wx2 = wallXAt(z2);
      const b2 = project(wx2, 0, z2), t2 = project(wx2, b.height * (0.6 + f * 0.3), z2);
      if (b2 && t2 && b2.alpha > 0.02) {
        ctx.strokeStyle = rgba(DIM, 0.22 * b2.alpha);
        ctx.beginPath();
        ctx.moveTo(b2.x, b2.y);
        ctx.lineTo(t2.x, t2.y);
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

    if (climb > 0.01 && climb < 1) {
      const py = climb * b.height;
      const p = project(wallX, py, refZ);
      if (p && p.alpha > 0.02) {
        ctx.fillStyle = rgba(WHITE, 0.85 * p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.4, 2.6 * p.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (climb <= 0.01 && camZ > b.zStart - 130 && camZ < b.zStart) {
      const t = clamp01((camZ - (b.zStart - 130)) / 130);
      const sx = lerp(pathX(refZ), wallX, t);
      const p = project(sx, 0, refZ);
      if (p && p.alpha > 0.02) {
        ctx.fillStyle = rgba(CYAN, 0.7 * p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, 2.4 * p.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!b.word) return;
    const letters = b.word.split("");
    const n = letters.length;
    const spacing = 34;
    const fontPx = Math.max(0, 22 * base.scale);
    if (fontPx < 3) return;
    ctx.font = `700 ${fontPx}px 'IBM Plex Mono', ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const lit = smoothstep(i / n, (i + 1) / n, climb);
      if (lit <= 0.02) continue;
      const wy = 60 + i * spacing;
      const p = project(wallX, wy, refZ);
      if (!p || p.alpha <= 0.02) continue;
      ctx.fillStyle = rgba(lit > 0.98 ? WHITE : CYAN, Math.min(0.95, lit) * p.alpha);
      ctx.shadowColor = rgba(CYAN, 0.8 * lit * p.alpha);
      ctx.shadowBlur = 6 * lit;
      ctx.fillText(letters[i], p.x, p.y);
    }
    ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------------
  // FIND: street-level runners — many paths, most fizzle, a few converge.
  // ---------------------------------------------------------------------
  let runners = [];
  function buildRunners() {
    runners = [];
    const span = bounds.find[1] - bounds.find[0];
    for (let i = 0; i < 30; i++) {
      const success = i < 6;
      runners.push({
        startZ: bounds.find[0] + Math.random() * span * 0.7,
        lane: (Math.random() * 2 - 1),
        success,
        travel: 260 + Math.random() * 220,
        seed: Math.random()
      });
    }
  }
  function drawRunners() {
    for (const r of runners) {
      const t = clamp01((camZ - r.startZ) / r.travel);
      if (t <= 0 || t >= 1) continue;
      const z = r.startZ + t * r.travel;
      const hw = halfWidthAt(z);
      const targetLane = r.success ? 0 : r.lane * 1.4;
      const laneNow = lerp(r.lane, targetLane, Math.pow(t, 1.3));
      const wx = pathX(z) + laneNow * hw * 0.8;
      const p = project(wx, 0, z);
      if (!p || p.alpha <= 0.02) continue;
      const fade = r.success ? 1 : 1 - smoothstep(0.55, 0.95, t);
      if (fade <= 0.02) continue;
      ctx.fillStyle = rgba(r.success ? WHITE : CYAN, 0.6 * fade * p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, 2 * p.scale), 0, Math.PI * 2);
      ctx.fill();
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
    buildRunners();
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

  function frame(now) {
    const animNow = reduceMotion ? 0 : now;
    const y = window.scrollY + height * 0.5;
    camZ = y * Z_PER_PIXEL;
    camX = pathX(camZ);
    lookUpBoost *= 0.9;
    camY = eyeY(camZ) + lookUpBoost * 22;

    const boost = animNow < burstUntil ? 1.35 : 1;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (boost > 1) ctx.globalAlpha = 1;

    drawStreet();
    for (const br of bridges) drawBridge(br, animNow);

    const district = districtAt(camZ);
    if (district === "find" || district === "scale") drawRunners();

    if (boost > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(CYAN, 0.05 * (boost - 1) * 3);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    for (const b of leftBuildings) drawBuilding(b, animNow);
    for (const b of rightBuildings) drawBuilding(b, animNow);

    ctx.restore();
    drawVignette();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", measureAndRebuild);
  requestAnimationFrame(frame);
})();
