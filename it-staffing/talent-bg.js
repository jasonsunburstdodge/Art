(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // IT Staffing background: a scattered network of talent nodes across
  // the screen, faint at rest. Scrolling sends bright pulses hopping
  // node to node along the network, each hop briefly lighting the node
  // it lands on. Occasionally a lit node flares and reveals a role or
  // skill tag (DevOps, QA, Cloud, Data...) before fading back to
  // invisible, mirroring the circuit-component reveals on the Custom
  // Software Development pillar but built around people instead of
  // wires.
  //
  // Under prefers-reduced-motion: the network is drawn once, static,
  // at its faint resting alpha — no pulses, no flares, nothing moves.
  // ---------------------------------------------------------------------

  const canvas = document.getElementById("talent-bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // White, blue, SilverXis blue, and orange — matches the palette used
  // on the Custom Software Development background for visual continuity
  // across pillars.
  const PULSE_COLORS = [
    [235, 244, 255],
    [140, 190, 255],
    [47, 134, 245],
    [255, 150, 60]
  ];

  const NODE_CELL = 150;
  const NODE_FILL_PROB = 0.62;
  const NODE_JITTER = 0.6;
  const NODE_BASE_RADIUS = 2.2;
  const NODE_BASE_ALPHA = 0.32;
  const MAX_NEIGHBORS = 3;
  const MAX_EDGE_DIST = 230;
  const EDGE_BASE_ALPHA = 0.05;

  const PULSE_SPEED = 0.5; // px/ms
  const PULSE_DOT_RADIUS = 2.6;
  const PULSE_TRAIL_MS = 220;
  const PULSE_MAX_HOPS = 5;
  const MAX_PULSES = 30;
  const SPAWN_THROTTLE_MS = 160;
  const SPAWN_BURST = 3;
  const SPAWN_STAGGER_MS = 110;

  const SKILL_TAGS = ["DEVOPS", "QA", "CLOUD", "FULL-STACK", "DATA", "UX/UI", "SECURITY", "PROJECT MGMT", "AI/ML", "NETWORK", "BACKEND", "SUPPORT"];
  const FLARE_CHANCE = 0.22;
  const FLARE_FADE_IN_MS = 150;
  const FLARE_HOLD_MS = 600;
  const FLARE_FADE_OUT_MS = 450;
  const MAX_FLARES = 10;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let nodes = [];
  let adj = [];
  let pulses = [];
  let flares = [];
  let lastSpawnTime = 0;

  function pathWithLengths(points) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 0.001;
      segs.push({ a, b, len, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, start: total });
      total += len;
    }
    return { segs, total };
  }

  // ---------------------------------------------------------------------
  // Build the talent network: a scattered grid of nodes, each connected
  // to its nearest few neighbors within reach.
  // ---------------------------------------------------------------------
  function buildNetwork() {
    nodes = [];
    const cols = Math.ceil(W / NODE_CELL) + 1;
    const rows = Math.ceil(H / NODE_CELL) + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() > NODE_FILL_PROB) continue;
        const baseX = col * NODE_CELL + NODE_CELL / 2;
        const baseY = row * NODE_CELL + NODE_CELL / 2;
        const x = baseX + (Math.random() - 0.5) * NODE_CELL * NODE_JITTER;
        const y = baseY + (Math.random() - 0.5) * NODE_CELL * NODE_JITTER;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        nodes.push({ x, y });
      }
    }

    adj = nodes.map(() => []);
    const seen = new Set();
    for (let i = 0; i < nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d <= MAX_EDGE_DIST) dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(MAX_NEIGHBORS, dists.length); k++) {
        const j = dists[k].j;
        const key = i < j ? i + "-" + j : j + "-" + i;
        if (seen.has(key)) continue;
        seen.add(key);
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildNetwork();
    pulses = [];
    flares = [];
  }

  // ---------------------------------------------------------------------
  // Flares: a lit node occasionally grows and reveals a role/skill tag,
  // then fades back to invisible.
  // ---------------------------------------------------------------------
  function flareAlpha(age) {
    if (age < FLARE_FADE_IN_MS) return age / FLARE_FADE_IN_MS;
    if (age < FLARE_FADE_IN_MS + FLARE_HOLD_MS) return 1;
    const t2 = age - FLARE_FADE_IN_MS - FLARE_HOLD_MS;
    if (t2 < FLARE_FADE_OUT_MS) return 1 - t2 / FLARE_FADE_OUT_MS;
    return -1;
  }

  function maybeSpawnFlare(node, color, litAt) {
    if (flares.length >= MAX_FLARES || Math.random() > FLARE_CHANCE) return;
    const label = SKILL_TAGS[(Math.random() * SKILL_TAGS.length) | 0];
    flares.push({ x: node.x, y: node.y, color, label, litAt });
  }

  function drawFlares(now) {
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = flares.length - 1; i >= 0; i--) {
      const f = flares[i];
      const age = now - f.litAt;
      if (age < 0) continue;
      const alpha = flareAlpha(age);
      if (alpha < 0) { flares.splice(i, 1); continue; }
      const [r, g, b] = f.color;
      const pillW = f.label.length * 6.4 + 18;
      const pillH = 20;
      const py = f.y - 20;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(6,10,22,0.82)";
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 1.3;
      roundedRect(f.x - pillW / 2, py - pillH / 2, pillW, pillH, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(f.label, f.x, py + 0.5);
      ctx.globalAlpha = 1;
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------------
  // The resting network: faint nodes and faint connecting lines, always
  // present so the structure reads even before anything happens.
  // ---------------------------------------------------------------------
  function drawNetwork() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(120,180,255,${EDGE_BASE_ALPHA})`;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      for (const j of adj[i]) {
        if (j < i) continue;
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
      }
    }
    ctx.stroke();

    ctx.fillStyle = `rgba(200,220,255,${NODE_BASE_ALPHA})`;
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_BASE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------
  // Pulses: bright dots that hop node to node along the network,
  // dragging a short glowing trail.
  // ---------------------------------------------------------------------
  function buildPulsePath(startIdx) {
    const pts = [nodes[startIdx]];
    const idxPath = [startIdx];
    let cur = startIdx;
    let prev = -1;
    for (let hop = 0; hop < PULSE_MAX_HOPS; hop++) {
      const options = adj[cur].filter((n) => n !== prev);
      const choices = options.length ? options : adj[cur];
      if (!choices.length) break;
      const next = choices[(Math.random() * choices.length) | 0];
      pts.push(nodes[next]);
      idxPath.push(next);
      prev = cur;
      cur = next;
    }
    return { pts, idxPath };
  }

  function spawnPulse(startIdx, now, colorIdx) {
    if (pulses.length >= MAX_PULSES || !nodes.length) return;
    const { pts, idxPath } = buildPulsePath(startIdx);
    if (pts.length < 2) return;
    const pathInfo = pathWithLengths(pts);
    const color = PULSE_COLORS[colorIdx];

    // Schedule an arrival ping (and maybe a skill-tag flare) for each
    // node along the hop path, timed to when the pulse actually reaches it.
    for (let k = 1; k < idxPath.length; k++) {
      const seg = pathInfo.segs[k - 1];
      const arriveAt = now + (seg.start + seg.len) / PULSE_SPEED;
      maybeSpawnFlare(nodes[idxPath[k]], color, arriveAt);
    }

    pulses.push({ pathInfo, startAt: now, color, pos: null, trail: [] });
  }

  function updatePulses(now) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (now < p.startAt) continue;
      const dist = PULSE_SPEED * (now - p.startAt);
      const segs = p.pathInfo.segs;
      if (dist >= p.pathInfo.total || segs.length === 0) {
        pulses.splice(i, 1);
        continue;
      }
      let seg = segs[segs.length - 1];
      for (const sg of segs) {
        if (dist <= sg.start + sg.len) { seg = sg; break; }
      }
      const localDist = dist - seg.start;
      p.pos = { x: seg.a.x + seg.dx * localDist, y: seg.a.y + seg.dy * localDist };

      p.trail.push({ x: p.pos.x, y: p.pos.y, t: now });
      while (p.trail.length > 1 && now - p.trail[0].t > PULSE_TRAIL_MS) p.trail.shift();
    }
  }

  function drawPulses(now) {
    for (const p of pulses) {
      if (now < p.startAt || !p.pos) continue;
      const [r, g, b] = p.color;

      if (p.trail.length > 1) {
        ctx.lineWidth = 1.4;
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        for (let i = 1; i < p.trail.length; i++) {
          const age = now - p.trail[i].t;
          if (age >= PULSE_TRAIL_MS) continue;
          const alpha = (1 - age / PULSE_TRAIL_MS) * 0.55;
          ctx.shadowBlur = 5 * (1 - age / PULSE_TRAIL_MS);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, PULSE_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------
  // Scroll-triggered spawning
  // ---------------------------------------------------------------------
  function onScroll() {
    const now = performance.now();
    if (now - lastSpawnTime < SPAWN_THROTTLE_MS || !nodes.length) return;
    lastSpawnTime = now;

    for (let b = 0; b < SPAWN_BURST; b++) {
      if (pulses.length >= MAX_PULSES) break;
      const startIdx = (Math.random() * nodes.length) | 0;
      const colorIdx = (Math.random() * PULSE_COLORS.length) | 0;
      const startAt = now + b * SPAWN_STAGGER_MS + Math.random() * SPAWN_STAGGER_MS * 0.5;
      spawnPulse(startIdx, startAt, colorIdx);
    }
  }
  if (!reduceMotion) {
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    drawNetwork();
    updatePulses(now);
    drawFlares(now);
    drawPulses(now);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) frame(performance.now());
  }, { passive: true });

  resize();
  if (reduceMotion) {
    frame(performance.now());
  } else {
    requestAnimationFrame(frame);
  }
})();
