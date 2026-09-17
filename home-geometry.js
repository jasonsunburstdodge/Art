(() => {
  "use strict";

  // Homepage-only background: a circuit-city flythrough. Scrolling moves the
  // camera forward through a canyon of close, oversized skyscrapers whose
  // facades are dark circuit-board glass with pulses of light racing along
  // the street and up their surfaces. As you scroll, big words light up in
  // the open sky between the buildings — near the horizon, where the canyon
  // opens up — hold there, then fade, cycling through whichever pillar's
  // vocabulary the camera is currently passing through. No node webs, no
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
    let z = 40 + Math.random() * 60;
    while (z < worldLength) {
      const segLen = 85 + Math.random() * 90;
      const district = districtAt(z + segLen * 0.3);
      wall.push({
        zStart: z, zEnd: z + segLen, side, district,
        height: district === "build" ? 480 + Math.random() * 480 : 380 + Math.random() * 520,
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
  // Street: curving lane lines + a bright pulse train that only advances
  // with camZ (i.e. only while the page is actually being scrolled).
  // ---------------------------------------------------------------------
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

    // Pulses of light sit at fixed world-distance intervals, so their
    // screen position only changes when camZ itself changes (i.e. scrolling).
    const spacing = 130;
    const firstZ = Math.ceil((camZ + 20) / spacing) * spacing;
    for (let i = 0; i < 10; i++) {
      const z = firstZ + i * spacing;
      const p = project(pathX(z), 0, z);
      if (!p || p.alpha <= 0.02) continue;
      const s = Math.max(0.9, 8 * p.scale);
      ctx.fillStyle = rgba(WHITE, 0.95 * p.alpha);
      ctx.shadowColor = rgba(CYAN, 0.9 * p.alpha);
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x - s / 2, p.y - 1, s, 2);
      ctx.shadowBlur = 0;
    }
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
  // Buildings: mullion lines, story ticks, and the pulse that races up the
  // facade once the street energy reaches it. Words no longer live here —
  // see drawSkyWord below.
  // ---------------------------------------------------------------------
  function drawBuilding(b) {
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
        ctx.fillStyle = rgba(WHITE, p.alpha);
        ctx.shadowColor = rgba(CYAN, 0.95 * p.alpha);
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.4, 2.6 * p.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (climb <= 0.01 && camZ > b.zStart - 130 && camZ < b.zStart) {
      const t = clamp01((camZ - (b.zStart - 130)) / 130);
      const sx = lerp(pathX(refZ), wallX, t);
      const p = project(sx, 0, refZ);
      if (p && p.alpha > 0.02) {
        ctx.fillStyle = rgba(WHITE, 0.95 * p.alpha);
        ctx.shadowColor = rgba(CYAN, 0.9 * p.alpha);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, 2.4 * p.scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Junction buildings: at the start of each pillar district, a closer,
  // foreground tower briefly lights top-to-bottom spelling out that
  // pillar's actual service name. Purely a function of camZ, so it only
  // plays out while scrolling and can be scrubbed back and forth.
  // ---------------------------------------------------------------------
  let junctions = [];
  function buildJunctions() {
    junctions = [
      { z: bounds.build[0], side: -1, label: "SOFTWARE DEVELOPMENT" },
      { z: bounds.connect[0], side: 1, label: "IT STAFFING" },
      { z: bounds.find[0], side: -1, label: "DIGITAL MARKETING" }
    ];
  }

  function drawJunction(j) {
    // The flash has to finish while the building is still ahead of the
    // camera (positive depth) — it must not straddle j.z itself, or the
    // "brightest" moment would land exactly where depth hits zero and
    // clips. So the whole window sits in front of j.z, brief and close.
    const farZ = j.z - 260, nearZ = j.z - 90;
    const t = clamp01((camZ - farZ) / (nearZ - farZ));
    if (t <= 0.01 || t >= 0.99) return;

    const height = 640;
    const wx = pathX(j.z) + j.side * halfWidthAt(j.z) * 0.55;
    const base = project(wx, 0, j.z);
    const top = project(wx, height, j.z);
    if (!base || !top) return;
    const a = base.alpha;
    if (a <= 0.02) return;

    ctx.strokeStyle = rgba(DIM, 0.45 * a);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();

    const rise = clamp01(t / 0.4);
    const fall = clamp01((t - 0.6) / 0.4);
    const letters = j.label.split("");
    const n = letters.length;
    const spacing = 28;
    const fontPx = Math.max(0, 28 * base.scale);
    if (fontPx < 3) return;
    ctx.font = `700 ${fontPx}px 'IBM Plex Mono', ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const ch = letters[i];
      if (ch === " ") continue;
      const posFromTop = i / n;
      const litRise = smoothstep(posFromTop, posFromTop + 1 / n, rise);
      const litFall = smoothstep(posFromTop, posFromTop + 1 / n, fall);
      const lit = litRise * (1 - litFall);
      if (lit <= 0.02) continue;
      const wy = height - 70 - i * spacing;
      const p = project(wx, wy, j.z);
      if (!p || p.alpha <= 0.02) continue;
      ctx.fillStyle = rgba(WHITE, Math.min(1, lit) * p.alpha);
      ctx.shadowColor = rgba(CYAN, 0.95 * lit * p.alpha);
      ctx.shadowBlur = 10 * lit;
      ctx.fillText(ch, p.x, p.y);
    }
    ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------------
  // Sky words: big text that lights up in the open gap between the two
  // walls of buildings, near the horizon, holds, then fades — one word per
  // fixed stretch of world distance, so a new one only appears by scrolling
  // further into it. Which list plays is just whichever district camZ is
  // in; the FIND finale gets its own slower, dedicated slots.
  // ---------------------------------------------------------------------
  const WORD_SPACING = 320;
  const CLIMAX_SPACING = 260;

  function skyWordAt(z) {
    const climaxStart = bounds.find[1] - CLIMAX_WORDS.length * CLIMAX_SPACING;
    if (z >= climaxStart && z < bounds.find[1]) {
      const idx = Math.min(CLIMAX_WORDS.length - 1, Math.floor((z - climaxStart) / CLIMAX_SPACING));
      return { word: CLIMAX_WORDS[idx], slotStart: climaxStart + idx * CLIMAX_SPACING, slotSpan: CLIMAX_SPACING };
    }
    const district = districtAt(z);
    const list = WORDS[district];
    if (!list || !list.length) return null;
    const districtStart = district === "hero" ? 0 : district === "scale" ? bounds.scaleStart : bounds[district][0];
    const idx = Math.floor((z - districtStart) / WORD_SPACING);
    const word = list[((idx % list.length) + list.length) % list.length];
    return { word, slotStart: districtStart + idx * WORD_SPACING, slotSpan: WORD_SPACING };
  }

  function drawSkyWord(sw) {
    if (!sw) return;
    const rel = clamp01((camZ - sw.slotStart) / sw.slotSpan);
    const fadeIn = smoothstep(0, 0.12, rel);
    const fadeOut = 1 - smoothstep(0.68, 1, rel);
    const a = fadeIn * fadeOut;
    if (a <= 0.01) return;

    const fontPx = Math.min(width, height) * 0.1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `800 ${fontPx}px 'IBM Plex Mono', ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = rgba(CYAN, 0.85);
    ctx.shadowBlur = 18;
    ctx.fillStyle = rgba(WHITE, 1);
    ctx.fillText(sw.word, cx, cy - height * 0.22);
    ctx.shadowBlur = 0;
    ctx.restore();
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
    buildJunctions();
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
    for (const br of bridges) drawBridge(br);

    const district = districtAt(camZ);
    if (district === "find" || district === "scale") drawRunners();

    if (boost > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(CYAN, 0.05 * (boost - 1) * 3);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    for (const b of leftBuildings) drawBuilding(b);
    for (const b of rightBuildings) drawBuilding(b);
    for (const j of junctions) drawJunction(j);
    drawSkyWord(skyWordAt(camZ));

    ctx.restore();
    drawVignette();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", measureAndRebuild);
  requestAnimationFrame(frame);
})();
