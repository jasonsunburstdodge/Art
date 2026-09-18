(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Custom Software Development background: a dense, tangled bundle of
  // wires hangs from a glowing cloud at the top of the screen and
  // branches downward — splitting into two (occasionally three) groups
  // at each level — until each strand ends at a small glowing box.
  //
  // Idle, the cloud breathes gently and the wires sit dim. Scrolling
  // fires an electrical pulse down a random root-to-box path; the pulse
  // travels branch by branch, leaving each branch it crosses brighter
  // for a moment before that residual glow fades, and the box at the
  // end of its path flares briefly when the pulse arrives.
  //
  // Under prefers-reduced-motion: no breathing, no pulses, one static
  // render — nothing here moves without being asked to.
  // ---------------------------------------------------------------------

  const canvas = document.getElementById("csd-wires-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const MAX_DEPTH = 5;
  const EDGE_TRAVEL_MS = 210; // time for a pulse to cross one branch
  const AFTERGLOW_MS = 550; // how long a crossed branch stays lit after the pulse leaves
  const FLARE_MS = 650; // box flare duration on arrival
  const MAX_PULSES = 14;
  const SPAWN_THROTTLE_MS = 90;
  const SPAWN_STAGGER_MS = 260; // "different times"
  const STRAND_CAP = 9; // max parallel strands drawn per cable, however many leaves it feeds

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let edges = [];
  let leaves = [];
  let wisps = [];
  let pulses = [];
  let lastSpawnTime = 0;

  function bezierPoint(edge, t) {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
      x: a * edge.p0.x + b * edge.c1.x + c * edge.c2.x + d * edge.p1.x,
      y: a * edge.p0.y + b * edge.c1.y + c * edge.c2.y + d * edge.p1.y
    };
  }

  function makeEdge(ax, ay, bx, by, depth) {
    const dx = bx - ax, dy = by - ay;
    return {
      p0: { x: ax, y: ay },
      c1: { x: ax + dx * (0.22 + Math.random() * 0.22) + (Math.random() - 0.5) * 46, y: ay + dy * (0.12 + Math.random() * 0.18) },
      c2: { x: ax + dx * (0.62 + Math.random() * 0.22) + (Math.random() - 0.5) * 46, y: ay + dy * (0.72 + Math.random() * 0.18) },
      p1: { x: bx, y: by },
      width: Math.max(0.6, 2.4 - depth * 0.34),
      glowUntil: 0,
      strands: [],
      leafCount: 1
    };
  }

  // A "cable" carrying many leaves renders as several tangled parallel
  // strands (the crowded trunk look); one carrying a single leaf renders
  // as the one clean wire that actually reaches that box. Strands are
  // generated once at build time, not re-jittered per frame.
  function makeStrands(edge, count, depth) {
    const spread = Math.max(3, 22 - depth * 4);
    const strands = [];
    for (let i = 0; i < count; i++) {
      const j = () => (Math.random() - 0.5) * spread;
      strands.push({
        p0: { x: edge.p0.x + j() * 0.3, y: edge.p0.y + j() * 0.15 },
        c1: { x: edge.c1.x + j(), y: edge.c1.y + j() },
        c2: { x: edge.c2.x + j(), y: edge.c2.y + j() },
        p1: { x: edge.p1.x + j() * 0.3, y: edge.p1.y + j() * 0.15 }
      });
    }
    return strands;
  }

  // ---------------------------------------------------------------------
  // Tree build: recursive slot-partitioning so branches spread across the
  // width without every leaf colliding, while still allowing enough
  // overlap between neighboring slots to read as "tangled."
  // ---------------------------------------------------------------------
  function buildTree() {
    edges = [];
    leaves = [];

    const marginX = W * 0.05;
    const rootX = W * 0.5, rootY = H * 0.085;
    const yStep = (H * 0.8) / MAX_DEPTH;

    function branch(x, y, depth, xMin, xMax, parentEdge) {
      if (depth >= MAX_DEPTH) {
        leaves.push({ x, y, path: buildPath(parentEdge), flareStart: 0 });
        return 1;
      }
      let k = 2;
      const r = Math.random();
      if (depth <= 1 && r < 0.32) k = 3;
      else if (depth >= 3 && r < 0.14) k = 1;

      const range = xMax - xMin;
      const slot = range / k;
      const overlap = range * 0.025;
      let leafTotal = 0;
      for (let i = 0; i < k; i++) {
        const slotMin = xMin + i * slot;
        const slotMax = slotMin + slot;
        const pad = slot * 0.14;
        const cx = k === 1 ? (slotMin + slotMax) / 2 + (Math.random() - 0.5) * slot * 0.3
          : slotMin + pad + Math.random() * Math.max(1, slot - pad * 2);
        const cy = y + yStep + (Math.random() - 0.5) * yStep * 0.3;
        const edge = makeEdge(x, y, cx, cy, depth);
        edge.parent = parentEdge;
        edges.push(edge);
        const leafCount = branch(cx, cy, depth + 1, slotMin - overlap, slotMax + overlap, edge);
        edge.leafCount = leafCount;
        edge.strands = makeStrands(edge, Math.min(leafCount, STRAND_CAP), depth);
        leafTotal += leafCount;
      }
      return leafTotal;
    }

    function buildPath(edge) {
      const path = [];
      let e = edge;
      while (e) { path.unshift(e); e = e.parent; }
      return path;
    }

    branch(rootX, rootY, 0, marginX, W - marginX, null);

    // A handful of static decorative tendrils curling around the cloud,
    // purely atmospheric — not part of the branch/pulse system.
    wisps = [];
    for (let i = 0; i < 9; i++) {
      const ang = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
      const len = Math.min(W, H) * (0.18 + Math.random() * 0.16);
      const sx = rootX + Math.cos(ang) * len * 0.15;
      const sy = rootY + Math.sin(ang) * len * 0.1 - H * 0.02;
      wisps.push({
        p0: { x: rootX, y: rootY - H * 0.015 },
        c1: { x: sx, y: sy - len * 0.3 },
        c2: { x: sx + Math.cos(ang) * len * 0.6, y: sy + Math.sin(ang) * len * 0.4 },
        p1: { x: rootX + Math.cos(ang) * len, y: rootY + Math.sin(ang) * len * 0.55 }
      });
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
    buildTree();
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------
  function strokeBezier(e) {
    ctx.beginPath();
    ctx.moveTo(e.p0.x, e.p0.y);
    ctx.bezierCurveTo(e.c1.x, e.c1.y, e.c2.x, e.c2.y, e.p1.x, e.p1.y);
    ctx.stroke();
  }

  function drawWisps() {
    ctx.strokeStyle = "rgba(150, 195, 255, 0.16)";
    ctx.lineWidth = 0.8;
    for (const w of wisps) strokeBezier(w);
  }

  function drawCloud(now) {
    const cx = W * 0.5, cy = H * 0.07;
    const breathe = reduceMotion ? 0.5 : Math.sin(now * 0.0009) * 0.5 + 0.5;
    const R = Math.min(W * 0.16, 140) * (0.94 + breathe * 0.08);

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
    halo.addColorStop(0, "rgba(255,255,255,0.85)");
    halo.addColorStop(0.25, "rgba(190,225,255,0.5)");
    halo.addColorStop(0.6, "rgba(110,180,255,0.16)");
    halo.addColorStop(1, "rgba(110,180,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2);
    ctx.fill();

    const lumps = [[-0.55, 0.05, 0.55], [-0.2, -0.15, 0.62], [0.2, -0.12, 0.6], [0.55, 0.05, 0.5], [0, 0.1, 0.7]];
    for (const [ox, oy, scale] of lumps) {
      const lx = cx + ox * R, ly = cy + oy * R * 0.6, lr = R * 0.55 * scale;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lg.addColorStop(0, "rgba(230,242,255,0.55)");
      lg.addColorStop(1, "rgba(230,242,255,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEdges(now) {
    for (const e of edges) {
      const glowAlpha = e.glowUntil > now ? (e.glowUntil - now) / AFTERGLOW_MS : 0;

      ctx.strokeStyle = "rgba(120, 170, 230, 0.2)";
      ctx.lineWidth = e.width;
      for (const s of e.strands) strokeBezier(s);

      if (glowAlpha > 0.02) {
        ctx.strokeStyle = `rgba(255,255,255,${(glowAlpha * 0.9).toFixed(3)})`;
        ctx.lineWidth = e.width + 1.2;
        for (const s of e.strands) strokeBezier(s);
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLeaves(now) {
    for (const leaf of leaves) {
      const age = leaf.flareStart ? now - leaf.flareStart : Infinity;
      const flaring = age < FLARE_MS;
      const t = flaring ? age / FLARE_MS : 1;
      const boost = flaring ? 1 - t : 0;

      ctx.strokeStyle = `rgba(150, 205, 255, ${(0.35 + boost * 0.55).toFixed(3)})`;
      ctx.lineWidth = 1;
      roundRect(leaf.x - 7, leaf.y - 7, 14, 14, 3);
      ctx.stroke();

      const dot = ctx.createRadialGradient(leaf.x, leaf.y, 0, leaf.x, leaf.y, 5 + boost * 6);
      dot.addColorStop(0, `rgba(255,255,255,${(0.55 + boost * 0.45).toFixed(3)})`);
      dot.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, 5 + boost * 6, 0, Math.PI * 2);
      ctx.fill();

      if (flaring) {
        const ringR = 4 + t * 24;
        ctx.strokeStyle = `rgba(255,255,255,${((1 - t) * 0.85).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(leaf.x, leaf.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawPulses(now) {
    for (const p of pulses) {
      if (now < p.startAt || !p.pos) continue;
      const glow = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, 10);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.4, "rgba(150,205,255,0.65)");
      glow.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function updatePulses(now) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (now < p.startAt) continue;
      const elapsed = now - p.startAt;
      const edgeIdx = Math.floor(elapsed / EDGE_TRAVEL_MS);
      if (edgeIdx >= p.path.length) {
        p.leaf.flareStart = now;
        pulses.splice(i, 1);
        continue;
      }
      const edge = p.path[edgeIdx];
      const tInEdge = (elapsed % EDGE_TRAVEL_MS) / EDGE_TRAVEL_MS;
      edge.glowUntil = now + AFTERGLOW_MS;
      p.pos = bezierPoint(edge, tInEdge);
    }
  }

  // ---------------------------------------------------------------------
  // Scroll-triggered pulses
  // ---------------------------------------------------------------------
  function onScroll() {
    const now = performance.now();
    if (now - lastSpawnTime < SPAWN_THROTTLE_MS) return;
    lastSpawnTime = now;
    if (pulses.length >= MAX_PULSES || leaves.length === 0) return;
    const leaf = leaves[(Math.random() * leaves.length) | 0];
    pulses.push({ path: leaf.path, leaf, startAt: now + Math.random() * SPAWN_STAGGER_MS, pos: null });
  }
  if (!reduceMotion) {
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    updatePulses(now);
    drawCloud(now);
    drawWisps();
    drawEdges(now);
    drawPulses(now);
    drawLeaves(now);
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
