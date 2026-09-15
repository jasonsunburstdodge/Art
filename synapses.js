(() => {
  "use strict";

  const canvas = document.getElementById("synapse-canvas");
  const ctx = canvas.getContext("2d");

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------
  const NODE_COUNT = 420;
  const WORLD_X = 1100;
  const WORLD_Y = 750;
  const TOTAL_DEPTH = 3600;
  const FOCAL = 480;
  const NEAR_CLIP = 30;
  const FAR_CLIP = 1500;
  const CONNECT_MAX_DIST = 260;
  const MAX_NEIGHBORS = 3;
  const ACCENT_RATIO = 0.14;

  const WORDS = [
    "Creative", "Innovation", "Function", "Value", "Vision", "Impact",
    "Growth", "Strategy", "Momentum", "Brand", "Reach", "Results",
    "Insight", "Spark", "Craft", "Bold"
  ];

  const BLUE = [110, 175, 255];
  const AMBER = [255, 165, 80];

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;

  const camera = { z: 0, targetZ: 0, x: 0, y: 0 };
  const pointer = { x: null, y: null, lastSpawn: 0 };

  let nodes = [];
  let edges = [];
  let visibleEdges = []; // recomputed each frame: projected screen coords
  let signals = [];
  let flares = [];
  let lastWord = null;
  let startTime = performance.now();

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildNetwork() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        id: i,
        x: (Math.random() * 2 - 1) * WORLD_X,
        y: (Math.random() * 2 - 1) * WORLD_Y,
        z: Math.random() * TOTAL_DEPTH,
        accent: Math.random() < ACCENT_RATIO,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        degree: 0,
        lastFlare: -Infinity
      });
    }

    // Build edges: connect each node to its nearest few neighbors within range.
    const edgeSet = new Set();
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const dists = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < CONNECT_MAX_DIST) dists.push([d, j]);
      }
      dists.sort((p, q) => p[0] - q[0]);
      for (let k = 0; k < Math.min(MAX_NEIGHBORS, dists.length); k++) {
        const j = dists[k][1];
        const key = i < j ? `${i}_${j}` : `${j}_${i}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ a: i, b: j });
        }
      }
    }

    edges.forEach(e => {
      nodes[e.a].degree++;
      nodes[e.b].degree++;
    });
  }

  // ---------------------------------------------------------------------
  // Scroll -> camera depth
  // ---------------------------------------------------------------------
  function updateCameraTarget() {
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    camera.targetZ = progress * (TOTAL_DEPTH - FAR_CLIP - 50);
  }

  // ---------------------------------------------------------------------
  // Projection
  // ---------------------------------------------------------------------
  function project(node, t) {
    const depth = node.z - camera.z;
    if (depth < NEAR_CLIP || depth > FAR_CLIP) return null;
    const scale = FOCAL / depth;
    const wobbleX = Math.sin(t * 0.0004 * node.speed + node.phase) * 6;
    const wobbleY = Math.cos(t * 0.00035 * node.speed + node.phase) * 6;
    const sx = width / 2 + (node.x - camera.x + wobbleX) * scale;
    const sy = height / 2 + (node.y - camera.y + wobbleY) * scale;
    const fadeNear = Math.min(1, (depth - NEAR_CLIP) / 120);
    const fadeFar = Math.min(1, (FAR_CLIP - depth) / 400);
    const alpha = Math.max(0, Math.min(fadeNear, fadeFar));
    return { x: sx, y: sy, scale, depth, alpha };
  }

  // ---------------------------------------------------------------------
  // Pointer handling -> spawn signals toward nearest junction
  // ---------------------------------------------------------------------
  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: ax + dx * t, y: ay + dy * t, t };
  }

  function trySpawnSignal(px, py) {
    const now = performance.now();
    if (now - pointer.lastSpawn < 160) return;
    if (signals.length >= 6) return;
    if (!visibleEdges.length) return;

    let best = null;
    let bestDist = 70; // px threshold
    for (const e of visibleEdges) {
      const cp = closestPointOnSegment(px, py, e.ax, e.ay, e.bx, e.by);
      const dx = px - cp.x, dy = py - cp.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = { edge: e, cp };
      }
    }
    if (!best) return;

    const { edge, cp } = best;
    const nodeA = nodes[edge.a];
    const nodeB = nodes[edge.b];
    // Prefer the higher-degree endpoint as the "junction" target.
    const target = nodeA.degree >= nodeB.degree ? edge : { a: edge.b, b: edge.a };
    const targetNode = nodes[target.a];
    const targetProj = target.a === edge.a ? edge.aProj : edge.bProj;

    signals.push({
      startX: cp.x,
      startY: cp.y,
      endX: targetProj.x,
      endY: targetProj.y,
      targetNodeId: targetNode.id,
      t: 0,
      duration: 380 + Math.random() * 220,
      born: now
    });
    pointer.lastSpawn = now;
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    trySpawnSignal(pointer.x, pointer.y);
  }

  function onTouchMove(e) {
    if (!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    pointer.x = t.clientX - rect.left;
    pointer.y = t.clientY - rect.top;
    trySpawnSignal(pointer.x, pointer.y);
  }

  function pickWord() {
    let w = WORDS[(Math.random() * WORDS.length) | 0];
    let guard = 0;
    while (w === lastWord && guard++ < 5) {
      w = WORDS[(Math.random() * WORDS.length) | 0];
    }
    lastWord = w;
    return w;
  }

  function fireFlare(nodeId, x, y) {
    const node = nodes[nodeId];
    if (node) node.lastFlare = performance.now();
    flares.push({
      x, y,
      born: performance.now(),
      duration: 1300,
      word: pickWord()
    });
  }

  // ---------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------
  function drawBackgroundDrift(t) {
    camera.x = Math.sin(t * 0.00006) * 40;
    camera.y = Math.cos(t * 0.00008) * 24;
  }

  function drawEdges(t) {
    visibleEdges = [];
    ctx.lineCap = "round";
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      const pa = project(a, t);
      const pb = project(b, t);
      if (!pa || !pb) continue;
      if (pa.alpha <= 0.02 && pb.alpha <= 0.02) continue;

      const alpha = Math.min(pa.alpha, pb.alpha) * 0.55;
      const avgScale = (pa.scale + pb.scale) / 2;
      const color = a.accent || b.accent ? AMBER : BLUE;

      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
      ctx.lineWidth = Math.max(0.4, avgScale * 1.1);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();

      visibleEdges.push({ a: e.a, b: e.b, ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y, aProj: pa, bProj: pb });
    }
  }

  function drawNodes(t) {
    for (const n of nodes) {
      const p = project(n, t);
      if (!p || p.alpha <= 0.02) continue;

      const twinkle = 0.75 + 0.25 * Math.sin(t * 0.002 * n.speed + n.phase);
      const flareAge = t - n.lastFlare;
      const flareBoost = flareAge < 600 ? (1 - flareAge / 600) : 0;

      const baseR = Math.max(0.6, p.scale * 2.4) * twinkle;
      const r = baseR + flareBoost * baseR * 3.5;
      const color = n.accent ? AMBER : BLUE;
      const alpha = p.alpha * (0.55 + flareBoost * 0.45);

      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      glow.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
      glow.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, r * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSignals(now) {
    signals = signals.filter(s => now - s.born < s.duration + 40);
    for (const s of signals) {
      let t = (now - s.born) / s.duration;
      t = Math.min(1, Math.max(0, t));
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

      const x = s.startX + (s.endX - s.startX) * eased;
      const y = s.startY + (s.endY - s.startY) * eased;

      // trailing glow line
      const grad = ctx.createLinearGradient(s.startX, s.startY, x, y);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,255,0.9)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.startX, s.startY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // traveling glow dot
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.4, "rgba(150,200,255,0.6)");
      glow.addColorStop(1, "rgba(150,200,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();

      if (t >= 1 && !s.fired) {
        s.fired = true;
        fireFlare(s.targetNodeId, s.endX, s.endY);
      }
    }
  }

  function drawFlares(now) {
    flares = flares.filter(f => now - f.born < f.duration);
    for (const f of flares) {
      const t = (now - f.born) / f.duration;

      // expanding ring at the junction
      const ringT = Math.min(1, t / 0.5);
      const ringR = 6 + ringT * 46;
      const ringAlpha = (1 - ringT) * 0.8;
      ctx.strokeStyle = `rgba(200,225,255,${Math.max(0, ringAlpha)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(f.x, f.y, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // word: quick flare in, hold briefly, fade out, drifting upward
      let scale, alpha;
      if (t < 0.18) {
        const p = t / 0.18;
        scale = 0.6 + p * 0.6;
        alpha = p;
      } else if (t < 0.55) {
        scale = 1.2 - (t - 0.18) / 0.37 * 0.2;
        alpha = 1;
      } else {
        const p = (t - 0.55) / 0.45;
        scale = 1.0 + p * 0.15;
        alpha = Math.max(0, 1 - p);
      }
      const rise = t * 22;

      ctx.save();
      ctx.translate(f.x, f.y - 26 - rise);
      ctx.scale(scale, scale);
      ctx.font = "600 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = `rgba(150,200,255,${alpha})`;
      ctx.shadowBlur = 18;
      ctx.fillStyle = `rgba(235,244,255,${alpha})`;
      ctx.fillText(f.word, 0, 0);
      ctx.restore();
    }
  }

  function frame() {
    const now = performance.now();
    const t = now - startTime;

    camera.z += (camera.targetZ - camera.z) * 0.06;

    ctx.clearRect(0, 0, width, height);
    drawBackgroundDrift(t);
    drawEdges(t);
    drawNodes(t);
    drawSignals(now);
    drawFlares(now);

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  resize();
  buildNetwork();
  updateCameraTarget();

  window.addEventListener("resize", () => { resize(); });
  window.addEventListener("scroll", updateCameraTarget, { passive: true });
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchstart", onTouchMove, { passive: true });

  requestAnimationFrame(frame);
})();
